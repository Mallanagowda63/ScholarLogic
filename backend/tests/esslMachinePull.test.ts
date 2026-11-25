import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'net';
import request from 'supertest';
import app from '../src/app';
import { env } from '../src/config/env';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { seedTracking } from '../src/scripts/seedTracking';
import { pullFromMachine } from '../src/services/esslPullService';
import { createStudentAccount } from '../src/services/studentAccountService';
import { Student } from '../src/models/Student';
import { BiometricPunch } from '../src/models/BiometricPunch';

// A fake eSSL machine speaking the TCP 4370 protocol, with the same record layouts as the real S990
// (72-byte users, 40-byte attendance). Runs on the in-memory DB (see vitest.config.ts).
const encodeTime = (s: string) => {
  const [d, t] = s.split(' ');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi, se] = t.split(':').map(Number);
  return ((((((y - 2000) * 12 + (mo - 1)) * 31 + (da - 1)) * 24 + h) * 60 + mi) * 60 + se) >>> 0;
};
const userRec = (uid: number, code: string, name: string, privilege = 0) => {
  const b = Buffer.alloc(72);
  b.writeUInt16LE(uid, 0);
  b[2] = privilege;
  b.write(name, 11, 'latin1');
  b.write(code, 48, 'latin1');
  return b;
};
const punchRec = (uid: number, code: string, time: string, state: number) => {
  const b = Buffer.alloc(40);
  b.writeUInt16LE(uid, 0);
  b.write(code, 2, 'latin1');
  b[26] = 1;
  b.writeUInt32LE(encodeTime(time), 27);
  b[31] = state;
  return b;
};

const machine = {
  users: [userRec(1, 'SCLR500', 'Test Learner'), userRec(2, '1', 'Prasad', 14)],
  punches: [punchRec(1, 'SCLR500', '2026-10-14 09:00:00', 0), punchRec(1, 'SCLR500', '2026-10-14 17:00:00', 1), punchRec(2, '1', '2026-10-14 08:30:00', 0)],
  writes: 0,
};
const READ_ONLY = new Set([1000, 1001, 1102, 11, 50, 1100, 1503, 1502]);

const reply = (code: number, data = Buffer.alloc(0), session = 77) => {
  const head = Buffer.alloc(8);
  head.writeUInt16LE(code, 0);
  head.writeUInt16LE(session, 4);
  const body = Buffer.concat([head, data]);
  const top = Buffer.alloc(8);
  top.writeUInt16LE(0x5050, 0);
  top.writeUInt16LE(0x7d82, 2);
  top.writeUInt32LE(body.length, 4);
  return Buffer.concat([top, body]);
};
const table = (records: Buffer[]) => {
  const data = Buffer.concat(records);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length, 0);
  return Buffer.concat([size, data]);
};

const server = net.createServer((sock) => {
  let buf = Buffer.alloc(0);
  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 8 && buf.length >= 8 + buf.readUInt32LE(4)) {
      const len = buf.readUInt32LE(4);
      const body = buf.subarray(8, 8 + len);
      buf = buf.subarray(8 + len);
      const cmd = body.readUInt16LE(0);
      const data = body.subarray(8);
      if (!READ_ONLY.has(cmd)) machine.writes += 1;
      if (cmd === 1000) sock.write(reply(2005));
      else if (cmd === 11) sock.write(reply(2000, Buffer.from('~SerialNumber=CUB7254300566\0')));
      else if (cmd === 1100) sock.write(reply(2000, Buffer.from('Ver 6.60 Oct 12 2021\0')));
      else if (cmd === 50) {
        const sizes = Buffer.alloc(92);
        sizes.writeInt32LE(machine.users.length, 16);
        sizes.writeInt32LE(machine.punches.length, 32);
        sock.write(reply(2000, sizes));
      } else if (cmd === 1503) sock.write(reply(1501, data.readInt16LE(1) === 9 ? table(machine.users) : table(machine.punches)));
      else sock.write(reply(2000));
    }
  });
});

describe('Reading users and punches straight from the eSSL machine', () => {
  let adminToken: string;
  let student: any;

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    env.ESSL_DEVICE_HOST = '127.0.0.1';
    env.ESSL_DEVICE_PORT = (server.address() as net.AddressInfo).port;
    env.BIOMETRIC_DEVICE_SERIALS = ['CUB7254300566'];
    env.BIOMETRIC_AUTO_ENUMBER = false; // production behaviour: codes come from eSSL Web
    await connectDB();
    await seedDatabase();
    await seedTracking();
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@scholarlogic.edu', password: 'Admin@123' })).body.data.tokens.accessToken;
    student = (await createStudentAccount({ fullName: 'Test Learner', phone: '9000000001', password: 'Learner@123' })).student;
  });

  afterAll(async () => {
    env.ESSL_DEVICE_HOST = '';
    env.BIOMETRIC_AUTO_ENUMBER = true;
    server.close();
    await disconnectDB();
  });

  const admin = (method: 'get' | 'post' | 'put', url: string) => (request(app) as any)[method](url).set('Authorization', `Bearer ${adminToken}`);

  it('new students get no made-up E Number, and bulk assignment is refused', async () => {
    expect((await Student.findById(student._id))!.biometricId).toBeFalsy();
    const res = await admin('post', '/api/attendance/biometric/e-numbers/assign').send({});
    expect(res.status).toBe(409);
  });

  it('reads the machine without writing to it; unknown codes wait for review', async () => {
    const r = await pullFromMachine('manual');
    expect(r.ok).toBe(true);
    expect(r.serialNumber).toBe('CUB7254300566');
    expect(r.users).toBe(2);
    expect(r.newPunches).toBe(3);
    expect(r.unlinkedPunches).toBe(3);
    expect(machine.writes).toBe(0);
    expect(await BiometricPunch.countDocuments({ studentId: { $exists: true } })).toBe(0);
  });

  it('review suggests the same-name student and marks machine admins', async () => {
    const res = await admin('get', '/api/attendance/biometric/review');
    const rows = res.body.data.unknownIds;
    const learner = rows.find((u: any) => u.userPin === 'SCLR500');
    expect(learner.machineName).toBe('Test Learner');
    expect(learner.suggestion.studentId).toBe(student.studentId);
    const prasad = rows.find((u: any) => u.userPin === '1');
    expect(prasad.isMachineAdmin).toBe(true);
    expect(prasad.suggestion).toBeNull();
  });

  it('confirming links the punches, and the student can log in with the machine code', async () => {
    const res = await admin('put', `/api/attendance/students/${student._id}/biometric-id`).send({ biometricId: 'SCLR500' });
    expect(res.status).toBe(200);
    expect(res.body.data.relinked).toBe(2);

    const login = await request(app).post('/api/auth/login').send({ email: 'sclr500', password: 'Learner@123' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('STUDENT');
  });

  it('reading again stores nothing twice', async () => {
    const r = await pullFromMachine('manual');
    expect(r.newPunches).toBe(0);
    expect(await BiometricPunch.countDocuments({})).toBe(3);
  });

  it('a wrong machine (serial not allowed) is refused', async () => {
    env.BIOMETRIC_DEVICE_SERIALS = ['SOMETHING-ELSE'];
    const r = await pullFromMachine('manual');
    env.BIOMETRIC_DEVICE_SERIALS = ['CUB7254300566'];
    expect(r.ok).toBe(false);
    expect(r.message).toContain('CUB7254300566');
  });
});
