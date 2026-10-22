#!/usr/bin/env node
/**
 * ScholarLogic campus helper for the eSSL / ZKTeco attendance machine.
 *
 * Runs on a computer inside the campus network (the only place the machine can be reached), reads the
 * machine's users and punches every few minutes over its PC-connection port (read-only), and sends new
 * punches to the ScholarLogic server. Nothing on the machine is changed; eSSL Web keeps working as before.
 * If this computer or the internet is off, punches wait on the machine and are sent on the next run.
 *
 * Needs Node.js 18 or newer and no other packages. Settings: agent.config.json next to this file.
 *   node essl-agent.js          run continuously
 *   node essl-agent.js --once   one read and send, then exit (for testing)
 */
const net = require('net');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const VERSION = '1.0.0';
const LOG_FILE = path.join(DIR, 'agent.log');

function loadConfig() {
  const file = path.join(DIR, 'agent.config.json');
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Copy agent.config.example.json to agent.config.json and fill it in.`);
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const k of ['serverUrl', 'secret', 'deviceHost']) if (!c[k]) throw new Error(`agent.config.json: "${k}" is required`);
  return {
    serverUrl: String(c.serverUrl).replace(/\/+$/, ''),
    secret: String(c.secret),
    deviceHost: String(c.deviceHost),
    devicePort: Number(c.devicePort || 4370),
    commKey: Number(c.commKey || 0),
    intervalMinutes: Math.max(1, Number(c.intervalMinutes || 5)),
  };
}

function log(msg) {
  const line = `${new Date().toISOString()}  ${msg}`;
  console.log(line);
  try {
    // Keep the log small: start over once it passes ~1 MB
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 1024 * 1024) fs.renameSync(LOG_FILE, `${LOG_FILE}.old`);
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch {
    // Logging must never stop the helper
  }
}

// ---------------------------------------------------------------------------
// Read-only ZKTeco TCP client (same protocol as the server's zkDeviceClient)
// ---------------------------------------------------------------------------
const USHRT_MAX = 65535;
const CMD = { CONNECT: 1000, EXIT: 1001, OPTIONS_RRQ: 11, FREE_SIZES: 50, AUTH: 1102, PREPARE_DATA: 1500, DATA: 1501, FREE_DATA: 1502, PREPARE_BUFFER: 1503, READ_BUFFER: 1504, USERTEMP_RRQ: 9, ATTLOG_RRQ: 13, ACK_OK: 2000, ACK_UNAUTH: 2005 };
const MAX_CHUNK = 0xffc0;

function checksum(buf) {
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
function commKeyPayload(key, sessionId, ticks = 50) {
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
const cstr = (b) => b.toString('latin1').replace(/\0[\s\S]*$/, '').trim();
function decodeTime(t) {
  const sec = t % 60; t = Math.floor(t / 60);
  const min = t % 60; t = Math.floor(t / 60);
  const hour = t % 24; t = Math.floor(t / 24);
  const day = (t % 31) + 1; t = Math.floor(t / 31);
  const month = (t % 12) + 1; t = Math.floor(t / 12);
  const p = (n) => String(n).padStart(2, '0');
  return `${t + 2000}-${p(month)}-${p(day)} ${p(hour)}:${p(min)}:${p(sec)}`;
}

function readDevice({ host, port, commKey, timeoutMs = 20000 }) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let buf = Buffer.alloc(0);
    const queue = [];
    let waiter = null;
    let failure = null;
    let session = 0;
    let replyId = USHRT_MAX - 1;
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardLimit);
      sock.destroy();
      err ? reject(err) : resolve(value);
    };
    const hardLimit = setTimeout(() => finish(new Error('Reading the machine took longer than 2 minutes')), 120000);
    const fail = (err) => {
      if (!failure) failure = err;
      if (waiter) { const w = waiter; waiter = null; w(); }
    };
    sock.setTimeout(timeoutMs);
    sock.on('timeout', () => { fail(new Error(`The machine at ${host}:${port} stopped responding`)); sock.destroy(); });
    sock.on('error', (e) => fail(new Error(`Cannot reach the machine at ${host}:${port} (${e.message})`)));
    sock.on('close', () => fail(new Error('The machine closed the connection')));
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8 && buf.length >= 8 + buf.readUInt32LE(4)) {
        const len = buf.readUInt32LE(4);
        const body = buf.subarray(8, 8 + len);
        buf = buf.subarray(8 + len);
        queue.push({ code: body.readUInt16LE(0), session: body.readUInt16LE(4), data: Buffer.from(body.subarray(8)) });
        if (waiter) { const w = waiter; waiter = null; w(); }
      }
    });
    const next = () => new Promise((res, rej) => {
      const take = () => (queue.length ? res(queue.shift()) : rej(failure || new Error('The machine did not reply')));
      if (queue.length || failure) return take();
      const t = setTimeout(() => { waiter = null; rej(new Error('The machine did not reply in time')); }, timeoutMs);
      waiter = () => { clearTimeout(t); take(); };
    });
    const send = (command, data = Buffer.alloc(0)) => {
      const pre = Buffer.alloc(8);
      pre.writeUInt16LE(command, 0); pre.writeUInt16LE(0, 2); pre.writeUInt16LE(session, 4); pre.writeUInt16LE(replyId, 6);
      const sum = checksum(Buffer.concat([pre, data]));
      replyId = (replyId + 1) % USHRT_MAX;
      const head = Buffer.alloc(8);
      head.writeUInt16LE(command, 0); head.writeUInt16LE(sum, 2); head.writeUInt16LE(session, 4); head.writeUInt16LE(replyId, 6);
      const body = Buffer.concat([head, data]);
      const top = Buffer.alloc(8);
      top.writeUInt16LE(0x5050, 0); top.writeUInt16LE(0x7d82, 2); top.writeUInt32LE(body.length, 4);
      sock.write(Buffer.concat([top, body]));
      return next();
    };
    const readChunk = async (start, size) => {
      const req = Buffer.alloc(8); req.writeInt32LE(start, 0); req.writeInt32LE(size, 4);
      const r = await send(CMD.READ_BUFFER, req);
      if (r.code === CMD.DATA) return r.data;
      if (r.code !== CMD.PREPARE_DATA) throw new Error(`Unexpected reply ${r.code} while reading data`);
      const total = r.data.readUInt32LE(0);
      const parts = []; let got = 0;
      while (got < total) { const m = await next(); if (m.code === CMD.DATA) { parts.push(m.data); got += m.data.length; } }
      const ack = await next();
      if (ack.code !== CMD.ACK_OK) throw new Error(`Data transfer not acknowledged (${ack.code})`);
      return Buffer.concat(parts);
    };
    const readTable = async (command, fct = 0) => {
      const req = Buffer.alloc(11); req.writeInt8(1, 0); req.writeInt16LE(command, 1); req.writeInt32LE(fct, 3); req.writeInt32LE(0, 7);
      const r = await send(CMD.PREPARE_BUFFER, req);
      let raw;
      if (r.code === CMD.DATA) raw = r.data;
      else {
        const size = r.data.readUInt32LE(1);
        const parts = [];
        for (let start = 0; start < size; start += MAX_CHUNK) parts.push(await readChunk(start, Math.min(MAX_CHUNK, size - start)));
        await send(CMD.FREE_DATA);
        raw = Buffer.concat(parts);
      }
      if (raw.length < 4) return Buffer.alloc(0);
      return raw.subarray(4, 4 + raw.readUInt32LE(0));
    };

    sock.connect(port, host, async () => {
      try {
        const c = await send(CMD.CONNECT);
        session = c.session;
        if (c.code === CMD.ACK_UNAUTH) {
          if ((await send(CMD.AUTH, commKeyPayload(commKey, session))).code !== CMD.ACK_OK) throw new Error('The machine rejected the Comm Key');
        } else if (c.code !== CMD.ACK_OK) throw new Error(`The machine refused the connection (reply ${c.code})`);
        const serialNumber = cstr((await send(CMD.OPTIONS_RRQ, Buffer.from('~SerialNumber\0', 'latin1'))).data).split('=').slice(1).join('=');
        const sizes = (await send(CMD.FREE_SIZES)).data;
        const userCount = sizes.length >= 80 ? sizes.readInt32LE(16) : 0;
        const recordCount = sizes.length >= 80 ? sizes.readInt32LE(32) : 0;

        const userData = await readTable(CMD.USERTEMP_RRQ, 5);
        const uSize = userCount ? userData.length / userCount : 72;
        const users = [];
        for (let o = 0; o + uSize <= userData.length; o += uSize) {
          const r = userData.subarray(o, o + uSize);
          const u = uSize === 28
            ? { uid: r.readUInt16LE(0), privilege: r[2], name: cstr(r.subarray(8, 16)), userId: String(r.readUInt32LE(24)) }
            : { uid: r.readUInt16LE(0), privilege: r[2], name: cstr(r.subarray(11, 35)), userId: cstr(r.subarray(48, 72)) };
          const card = r.readUInt32LE(uSize === 28 ? 16 : 35);
          u.card = card ? String(card) : '';
          u.name = u.name.replace(/\s+/g, ' ');
          if (u.userId) users.push(u);
        }

        const logData = await readTable(CMD.ATTLOG_RRQ);
        const rSize = recordCount ? logData.length / recordCount : 40;
        const byUid = new Map(users.map((u) => [u.uid, u.userId]));
        const punches = [];
        for (let o = 0; o + rSize <= logData.length; o += rSize) {
          const r = logData.subarray(o, o + rSize);
          if (rSize === 8) punches.push({ userId: byUid.get(r.readUInt16LE(0)) || String(r.readUInt16LE(0)), verify: r[2], localTime: decodeTime(r.readUInt32LE(3)), state: r[7] });
          else if (rSize === 16) punches.push({ userId: String(r.readUInt32LE(0)), localTime: decodeTime(r.readUInt32LE(4)), verify: r[8], state: r[9] });
          else punches.push({ userId: cstr(r.subarray(2, 26)), verify: r[26], localTime: decodeTime(r.readUInt32LE(27)), state: r[31] });
        }
        await send(CMD.EXIT).catch(() => undefined);
        finish(null, { serialNumber, users, punches: punches.filter((p) => p.userId) });
      } catch (err) {
        finish(err);
      }
    });
    sock.on('error', (e) => { if (!sock.connecting) return; finish(new Error(`Cannot reach the machine at ${host}:${port} (${e.message})`)); });
  });
}

// ---------------------------------------------------------------------------
// Send to the server
// ---------------------------------------------------------------------------
async function api(cfg, method, route, body) {
  const res = await fetch(`${cfg.serverUrl}/api/integrations/essl-agent${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-ESSL-Agent-Secret': cfg.secret, 'User-Agent': `scholarlogic-essl-agent/${VERSION}` },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(`Server replied ${res.status}: ${json.message || res.statusText}`);
  return json.data;
}

let lastUsersSent = '';

async function runOnce(cfg) {
  let snap;
  for (let attempt = 1; !snap; attempt += 1) {
    try {
      snap = await readDevice({ host: cfg.deviceHost, port: cfg.devicePort, commKey: cfg.commKey });
    } catch (err) {
      if (attempt >= 3) {
        log(`Could not read the machine: ${err.message}`);
        await api(cfg, 'POST', '/error', { message: err.message }).catch(() => undefined);
        return false;
      }
      await new Promise((r) => setTimeout(r, attempt * 5000));
    }
  }
  const { cutoff } = await api(cfg, 'GET', `/cursor?serial=${encodeURIComponent(snap.serialNumber)}`);
  const punches = cutoff ? snap.punches.filter((p) => p.localTime.slice(0, 10) >= cutoff) : snap.punches;
  const usersSignature = JSON.stringify(snap.users.map((u) => [u.userId, u.name, u.card, u.privilege]));
  const users = usersSignature === lastUsersSent ? [] : snap.users;
  const result = await api(cfg, 'POST', '/push', { serialNumber: snap.serialNumber, users, punches, agentVersion: VERSION });
  lastUsersSent = usersSignature;
  log(`Machine ${snap.serialNumber}: ${snap.users.length} users, ${snap.punches.length} punches on the machine; sent ${punches.length} from ${cutoff || 'the start'}; ${result.newPunches} new on the server`);
  return true;
}

async function main() {
  const cfg = loadConfig();
  log(`ScholarLogic eSSL helper ${VERSION} starting: machine ${cfg.deviceHost}:${cfg.devicePort} → ${cfg.serverUrl}, every ${cfg.intervalMinutes} min`);
  if (process.argv.includes('--once')) {
    const ok = await runOnce(cfg).catch((err) => (log(`Failed: ${err.message}`), false));
    process.exit(ok ? 0 : 1);
  }
  for (;;) {
    await runOnce(cfg).catch((err) => log(`Failed this round, will try again: ${err.message}`));
    await new Promise((r) => setTimeout(r, cfg.intervalMinutes * 60000));
  }
}

main().catch((err) => {
  log(`Cannot start: ${err.message}`);
  process.exit(1);
});
