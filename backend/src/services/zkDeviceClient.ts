import net from 'net';

/**
 * Read-only client for eSSL / ZKTeco machines over the TCP "PC connection" port (usually 4370).
 * It only sends CONNECT, AUTH, OPTIONS_RRQ, GET_FREE_SIZES, PREPARE/READ_BUFFER, FREE_DATA and EXIT,
 * so nothing on the machine is changed. The machine keeps pushing to eSSL Web (ADMS) as before.
 */

export interface DeviceUser {
  uid: number;
  userId: string; // the code enrolled on the machine, e.g. SCLR245
  name: string;
  card: string; // '' when no card
  privilege: number; // 0 = normal user, > 0 = machine admin / enroller
}

export interface DevicePunch {
  userId: string;
  localTime: string; // YYYY-MM-DD HH:mm:ss, machine clock
  state: number; // 0 check-in, 1 check-out, 4/5 overtime in/out
  verify: number; // 1 fingerprint, 4 card, 15 face, ...
}

export interface DeviceSnapshot {
  serialNumber: string;
  firmware: string;
  users: DeviceUser[];
  punches: DevicePunch[];
  userCount: number;
  recordCount: number;
}

const USHRT_MAX = 65535;
const CMD = {
  CONNECT: 1000,
  EXIT: 1001,
  OPTIONS_RRQ: 11,
  FREE_SIZES: 50,
  GET_VERSION: 1100,
  AUTH: 1102,
  PREPARE_DATA: 1500,
  DATA: 1501,
  FREE_DATA: 1502,
  PREPARE_BUFFER: 1503,
  READ_BUFFER: 1504,
  USERTEMP_RRQ: 9,
  ATTLOG_RRQ: 13,
  ACK_OK: 2000,
  ACK_UNAUTH: 2005,
};
const MAX_CHUNK = 0xffc0;

function checksum(buf: Buffer) {
  let sum = 0;
  let i = 0;
  for (; i + 1 < buf.length; i += 2) {
    sum += buf.readUInt16LE(i);
    if (sum > USHRT_MAX) sum -= USHRT_MAX;
  }
  if (i < buf.length) sum += buf[buf.length - 1];
  while (sum > USHRT_MAX) sum -= USHRT_MAX;
  sum = ~sum;
  while (sum < 0) sum += USHRT_MAX;
  return sum & 0xffff;
}

// Comm Key login, same scheme as the vendor SDK (needed even when the key is 0 on some firmware)
function commKeyPayload(key: number, sessionId: number, ticks = 50) {
  let k = 0;
  for (let i = 0; i < 32; i++) k = key & (1 << i) ? ((k << 1) | 1) >>> 0 : (k << 1) >>> 0;
  k = (k + sessionId) >>> 0;
  const b = Buffer.alloc(4);
  b.writeUInt32LE(k, 0);
  const x = Buffer.from([b[0] ^ 0x5a, b[1] ^ 0x4b, b[2] ^ 0x53, b[3] ^ 0x4f]);
  const s = Buffer.concat([x.subarray(2, 4), x.subarray(0, 2)]);
  const t = ticks & 0xff;
  return Buffer.from([s[0] ^ t, s[1] ^ t, t, s[3] ^ t]);
}

const cstr = (b: Buffer) => b.toString('latin1').replace(/\0[\s\S]*$/, '').trim();

// Machine timestamps are packed as seconds counted in 31-day months from 2000
function decodeTime(t: number) {
  const sec = t % 60;
  t = Math.floor(t / 60);
  const min = t % 60;
  t = Math.floor(t / 60);
  const hour = t % 24;
  t = Math.floor(t / 24);
  const day = (t % 31) + 1;
  t = Math.floor(t / 31);
  const month = (t % 12) + 1;
  t = Math.floor(t / 12);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t + 2000}-${p(month)}-${p(day)} ${p(hour)}:${p(min)}:${p(sec)}`;
}

interface Reply {
  code: number;
  session: number;
  data: Buffer;
}

class Connection {
  private sock: net.Socket;
  private buf = Buffer.alloc(0);
  private queue: Reply[] = [];
  private waiter: (() => void) | null = null;
  private failure: Error | null = null;
  private session = 0;
  private replyId = USHRT_MAX - 1;

  constructor(private host: string, private port: number, private timeoutMs: number) {
    this.sock = new net.Socket();
    this.sock.setTimeout(timeoutMs);
    this.sock.on('data', (d) => this.onData(d));
    this.sock.on('timeout', () => {
      this.fail(new Error(`The machine at ${host}:${port} stopped responding`));
      this.sock.destroy();
    });
    this.sock.on('error', (e) => this.fail(new Error(`Cannot reach the machine at ${host}:${port} (${e.message})`)));
    this.sock.on('close', () => this.fail(new Error('The machine closed the connection')));
  }

  open() {
    return new Promise<void>((resolve, reject) => {
      // A machine busy with another PC connection may never accept; give up instead of waiting forever
      const timer = setTimeout(() => {
        this.sock.destroy();
        reject(new Error(`The machine at ${this.host}:${this.port} did not accept the connection (it may be busy with another program)`));
      }, this.timeoutMs);
      const onError = (e: Error) => {
        clearTimeout(timer);
        reject(new Error(`Cannot reach the machine at ${this.host}:${this.port} (${e.message})`));
      };
      this.sock.once('error', onError);
      this.sock.connect(this.port, this.host, () => {
        clearTimeout(timer);
        this.sock.off('error', onError);
        resolve();
      });
    });
  }

  close() {
    this.sock.destroy();
  }

  private fail(err: Error) {
    if (!this.failure) this.failure = err;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w();
    }
  }

  private onData(d: Buffer) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 8) {
      const len = this.buf.readUInt32LE(4);
      if (this.buf.length < 8 + len) return;
      const body = this.buf.subarray(8, 8 + len);
      this.buf = this.buf.subarray(8 + len);
      this.queue.push({ code: body.readUInt16LE(0), session: body.readUInt16LE(4), data: Buffer.from(body.subarray(8)) });
      if (this.waiter) {
        const w = this.waiter;
        this.waiter = null;
        w();
      }
    }
  }

  next(): Promise<Reply> {
    return new Promise((resolve, reject) => {
      const take = () => {
        if (this.queue.length) resolve(this.queue.shift()!);
        else reject(this.failure || new Error('The machine did not reply'));
      };
      if (this.queue.length || this.failure) return take();
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error('The machine did not reply in time'));
      }, this.timeoutMs);
      this.waiter = () => {
        clearTimeout(timer);
        take();
      };
    });
  }

  send(command: number, data: Buffer = Buffer.alloc(0)) {
    const pre = Buffer.alloc(8);
    pre.writeUInt16LE(command, 0);
    pre.writeUInt16LE(0, 2);
    pre.writeUInt16LE(this.session, 4);
    pre.writeUInt16LE(this.replyId, 6);
    const sum = checksum(Buffer.concat([pre, data]));
    this.replyId = (this.replyId + 1) % USHRT_MAX;
    const head = Buffer.alloc(8);
    head.writeUInt16LE(command, 0);
    head.writeUInt16LE(sum, 2);
    head.writeUInt16LE(this.session, 4);
    head.writeUInt16LE(this.replyId, 6);
    const body = Buffer.concat([head, data]);
    const top = Buffer.alloc(8);
    top.writeUInt16LE(0x5050, 0);
    top.writeUInt16LE(0x7d82, 2);
    top.writeUInt32LE(body.length, 4);
    this.sock.write(Buffer.concat([top, body]));
    return this.next();
  }

  async login(commKey: number) {
    const c = await this.send(CMD.CONNECT);
    this.session = c.session;
    if (c.code === CMD.ACK_UNAUTH) {
      const a = await this.send(CMD.AUTH, commKeyPayload(commKey, this.session));
      if (a.code !== CMD.ACK_OK) throw new Error('The machine rejected the Comm Key (check ESSL_COMM_KEY)');
    } else if (c.code !== CMD.ACK_OK) {
      throw new Error(`The machine refused the connection (reply ${c.code})`);
    }
  }

  async option(name: string) {
    const r = await this.send(CMD.OPTIONS_RRQ, Buffer.from(`~${name}\0`, 'latin1'));
    return cstr(r.data).split('=').slice(1).join('=');
  }

  private async readChunk(start: number, size: number) {
    const req = Buffer.alloc(8);
    req.writeInt32LE(start, 0);
    req.writeInt32LE(size, 4);
    const r = await this.send(CMD.READ_BUFFER, req);
    if (r.code === CMD.DATA) return r.data;
    if (r.code !== CMD.PREPARE_DATA) throw new Error(`Unexpected reply ${r.code} while reading data`);
    const total = r.data.readUInt32LE(0);
    const parts: Buffer[] = [];
    let got = 0;
    while (got < total) {
      const m = await this.next();
      if (m.code === CMD.DATA) {
        parts.push(m.data);
        got += m.data.length;
      }
    }
    const ack = await this.next();
    if (ack.code !== CMD.ACK_OK) throw new Error(`Data transfer not acknowledged (${ack.code})`);
    return Buffer.concat(parts);
  }

  async readTable(command: number, fct = 0) {
    const req = Buffer.alloc(11);
    req.writeInt8(1, 0);
    req.writeInt16LE(command, 1);
    req.writeInt32LE(fct, 3);
    req.writeInt32LE(0, 7);
    const r = await this.send(CMD.PREPARE_BUFFER, req);
    let raw: Buffer;
    if (r.code === CMD.DATA) raw = r.data;
    else {
      const size = r.data.readUInt32LE(1);
      const parts: Buffer[] = [];
      for (let start = 0; start < size; start += MAX_CHUNK) parts.push(await this.readChunk(start, Math.min(MAX_CHUNK, size - start)));
      await this.send(CMD.FREE_DATA);
      raw = Buffer.concat(parts);
    }
    if (raw.length < 4) return Buffer.alloc(0);
    const total = raw.readUInt32LE(0);
    return raw.subarray(4, 4 + total);
  }
}

export async function readDevice(opts: { host: string; port?: number; commKey?: number; timeoutMs?: number }): Promise<DeviceSnapshot> {
  const conn = new Connection(opts.host, opts.port || 4370, opts.timeoutMs || 20000);
  await conn.open();
  try {
    await conn.login(opts.commKey || 0);
    const serialNumber = await conn.option('SerialNumber');
    const firmware = cstr((await conn.send(CMD.GET_VERSION)).data);
    const sizes = (await conn.send(CMD.FREE_SIZES)).data;
    const userCount = sizes.length >= 80 ? sizes.readInt32LE(16) : 0;
    const recordCount = sizes.length >= 80 ? sizes.readInt32LE(32) : 0;

    const userData = await conn.readTable(CMD.USERTEMP_RRQ, 5);
    const uSize = userCount ? userData.length / userCount : 72;
    const users: DeviceUser[] = [];
    for (let o = 0; o + uSize <= userData.length; o += uSize) {
      const r = userData.subarray(o, o + uSize);
      const user: DeviceUser =
        uSize === 28
          ? { uid: r.readUInt16LE(0), privilege: r[2], name: cstr(r.subarray(8, 16)), card: '', userId: String(r.readUInt32LE(24)) }
          : { uid: r.readUInt16LE(0), privilege: r[2], name: cstr(r.subarray(11, 35)), card: '', userId: cstr(r.subarray(48, 72)) };
      const card = r.readUInt32LE(uSize === 28 ? 16 : 35);
      user.card = card ? String(card) : '';
      user.name = user.name.replace(/\s+/g, ' ');
      if (user.userId) users.push(user);
    }

    const logData = await conn.readTable(CMD.ATTLOG_RRQ);
    const rSize = recordCount ? logData.length / recordCount : 40;
    const byUid = new Map(users.map((u) => [u.uid, u.userId]));
    const punches: DevicePunch[] = [];
    for (let o = 0; o + rSize <= logData.length; o += rSize) {
      const r = logData.subarray(o, o + rSize);
      if (rSize === 8) {
        punches.push({ userId: byUid.get(r.readUInt16LE(0)) || String(r.readUInt16LE(0)), verify: r[2], localTime: decodeTime(r.readUInt32LE(3)), state: r[7] });
      } else if (rSize === 16) {
        punches.push({ userId: String(r.readUInt32LE(0)), localTime: decodeTime(r.readUInt32LE(4)), verify: r[8], state: r[9] });
      } else {
        punches.push({ userId: cstr(r.subarray(2, 26)), verify: r[26], localTime: decodeTime(r.readUInt32LE(27)), state: r[31] });
      }
    }
    await conn.send(CMD.EXIT).catch(() => undefined);
    return { serialNumber, firmware, users, punches: punches.filter((p) => p.userId), userCount, recordCount };
  } finally {
    conn.close();
  }
}
