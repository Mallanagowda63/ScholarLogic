import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { env } from '../src/config/env';
import { seedDatabase } from '../src/scripts/seed';
import { Student } from '../src/models/Student';
import { BiometricPunch } from '../src/models/BiometricPunch';
import { BiometricCommand } from '../src/models/BiometricIntegration';
import { createStudentAccount } from '../src/services/studentAccountService';
import { ensureENumber } from '../src/services/esslService';
import { toLocalParts } from '../src/services/biometricService';
import { deviceCardCandidates, normalizeCard } from '../src/services/biometricShared';

// Runs on the in-memory DB (see vitest.config.ts). The "machine" here is this test speaking the
// ADMS protocol to the app, so these are LOCAL tests: they prove ScholarLogic's side of the
// protocol, not that the real eSSL S990 behaves the same way.
const SN = env.BIOMETRIC_DEVICE_SERIALS[0] || 'TESTSN0001';

const device = {
  handshake: () => request(app).get(`/iclock/cdata?SN=${SN}&options=all&pushver=2.4.1`),
  attlog: (lines: string[]) =>
    request(app).post(`/iclock/cdata?SN=${SN}&table=ATTLOG&Stamp=${Date.now()}`).set('Content-Type', 'text/plain').send(lines.join('\n') + '\n'),
  poll: () => request(app).get(`/iclock/getrequest?SN=${SN}`),
  reply: (lines: string[]) => request(app).post(`/iclock/devicecmd?SN=${SN}`).set('Content-Type', 'text/plain').send(lines.join('\n')),
  operlog: (lines: string[]) => request(app).post(`/iclock/cdata?SN=${SN}&table=OPERLOG&Stamp=1`).set('Content-Type', 'text/plain').send(lines.join('\n')),
};

// state 0 = check-in, 1 = check-out; verify 4 = card
const punch = (pin: string, date: string, time: string, dir: 'IN' | 'OUT') => `${pin}\t${date} ${time}\t${dir === 'IN' ? 0 : 1}\t4\t0\t0`;

const sheet = (rows: (string | number)[][], headers = ['E Number', 'Name', 'Company', 'Department', 'Designation', 'Apply Type']) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
};

describe('eSSL integration (local protocol tests)', () => {
  let adminToken: string;
  let trainerToken: string;
  const today = toLocalParts(new Date()).date;
  // Fixed past days inside the calendar's default range
  const day = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

  const admin = (method: 'get' | 'post' | 'put', url: string) => (request(app) as any)[method](url).set('Authorization', `Bearer ${adminToken}`);
  const newStudent = async (fullName: string, extra: Record<string, any> = {}) =>
    (await createStudentAccount({ fullName, password: 'Passw0rd!', ...extra })).student;
  const overviewRow = async (id: any) => (await admin('get', '/api/attendance/biometric/overview')).body.data.students.find((s: any) => s._id === String(id));
  const dayOf = async (id: any, date: string) => (await admin('get', `/api/attendance/students/${id}`)).body.data.tabs[0].days[date];

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    const login = async (email: string, password: string) => (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;
    adminToken = await login('admin@scholarlogic.edu', 'Admin@123');
    trainerToken = await login('trainer@scholarlogic.edu', 'Trainer@123');
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('E Number = Biometric ID', () => {
    it('gives every new student the next number, separate from the Student ID', async () => {
      const a = await newStudent('Asha Rao');
      const b = await newStudent('Bharat Kumar');
      expect(a.biometricId).toMatch(/^[1-9]\d*$/);
      expect(Number(b.biometricId)).toBe(Number(a.biometricId) + 1);
      expect(a.biometricId).not.toBe(a.studentId);
    });

    it('stays unique when many students are numbered at the same time', async () => {
      const students = await Promise.all(Array.from({ length: 12 }, (_, i) => newStudent(`Concurrent Student ${i}`)));
      await Student.updateMany({ _id: { $in: students.map((s) => s._id) } }, { $unset: { biometricId: 1 } });

      const results = await Promise.all(students.map((s) => ensureENumber(s._id)));
      const numbers = results.map((r) => Number(r.biometricId));
      expect(new Set(numbers).size).toBe(12);
      // The 12 earlier numbers were released above and must not come back
      const before = students.map((s) => Number(s.biometricId));
      expect(numbers.some((n) => before.includes(n))).toBe(false);
    });

    it('never replaces a number a student already has, and never reuses one', async () => {
      const s = await newStudent('Keeps Number');
      const again = await ensureENumber(s._id);
      expect(again).toEqual({ biometricId: s.biometricId, assigned: false });

      const bulk = await admin('post', '/api/attendance/biometric/e-numbers/assign').send({});
      expect(bulk.body.data.assigned.find((a: any) => a.studentId === s.studentId)).toBeUndefined();

      // A hand-entered number lifts the sequence past it
      const manual = await admin('put', `/api/attendance/students/${s._id}/biometric-id`).send({ biometricId: '5000' });
      expect(manual.status).toBe(200);
      expect((await newStudent('After Manual')).biometricId).toBe('5001');

      // Freeing 5000 does not put it back in the sequence
      await admin('put', `/api/attendance/students/${s._id}/biometric-id`).send({ biometricId: '' });
      expect((await ensureENumber(s._id)).biometricId).toBe('5002');
    });

    it('rejects a Biometric ID that another student holds', async () => {
      const a = await newStudent('Dup One');
      const b = await newStudent('Dup Two');
      const res = await admin('put', `/api/attendance/students/${b._id}/biometric-id`).send({ biometricId: a.biometricId });
      expect(res.status).toBe(409);
    });
  });

  describe('Card Number', () => {
    it('links a card to the student, normalised, and refuses a card in use', async () => {
      const a = await newStudent('Card Holder');
      const b = await newStudent('Card Thief');
      const ok = await admin('put', `/api/attendance/students/${a._id}/card-number`).send({ cardNumber: '0007654321' });
      expect(ok.body.data).toMatchObject({ cardNumber: '7654321', biometricId: a.biometricId });

      expect((await admin('put', `/api/attendance/students/${b._id}/card-number`).send({ cardNumber: '7654321' })).status).toBe(409);
      expect((await admin('put', `/api/attendance/students/${b._id}/card-number`).send({ cardNumber: '12AB' })).status).toBe(400);

      const row = await overviewRow(a._id);
      expect(row).toMatchObject({ biometricId: a.biometricId, cardNumber: '7654321', studentId: a.studentId });
    });

    it('reads both card formats a machine may report', () => {
      expect(normalizeCard('0001234567')).toBe('1234567');
      expect(deviceCardCandidates('1234567')).toEqual(['1234567']);
      expect(deviceCardCandidates('0')).toEqual([]);
      // 0x0012D687 = 1234567, least significant byte first
      expect(deviceCardCandidates('[87D6120000]')).toContain('1234567');
    });
  });

  describe('Master sheet import / export', () => {
    it('previews with row-level validation and duplicate checks, then imports and is safe to repeat', async () => {
      const link = await newStudent('Import Link');
      const taken = await newStudent('Import Taken');
      const twinA = await newStudent('Import Twin');
      await newStudent('Import Twin');
      await Student.updateMany({ _id: { $in: [link._id, twinA._id] } }, { $unset: { biometricId: 1 } });

      const file = sheet([
        [7001, 'Import Link', 'ScholarLogic', 'Data Analytics', 'Student', 'Regular'], // links by exact name
        [7002, 'Nobody Here', 'ScholarLogic', 'Data Analytics', 'Student', 'Regular'], // no such student → skipped
        [7003, '', 'ScholarLogic', 'Data Analytics', 'Student', 'Regular'], // blank name
        [7004, 'Dup A', 'ScholarLogic', 'DA', 'Student', 'Regular'], // duplicate E Number ↓
        [7004, 'Dup B', 'ScholarLogic', 'DA', 'Student', 'Regular'],
        [7005, 'Import Taken', 'ScholarLogic', 'DA', 'Student', 'Regular'], // already has another E Number
        [7006, 'Import Twin', 'ScholarLogic', 'DA', 'Student', 'Regular'], // two students share the name
        ['', 'No Number', 'ScholarLogic', 'DA', 'Student', 'Regular'], // blank E Number
        [7007, 'Blank Fields', '', '', '', ''], // warnings only (and no such student)
      ]);

      const preview = await admin('post', '/api/attendance/biometric/import/preview').attach('file', file, 'master.xlsx');
      expect(preview.status).toBe(200);
      const rows = preview.body.data.rows;
      expect(preview.body.data.summary).toMatchObject({ total: 9, link: 1, skip: 2, error: 6 });
      expect(rows[0]).toMatchObject({ row: 2, action: 'LINK', eNumber: '7001' });
      expect(rows[2].errors.join()).toMatch(/Name is blank/);
      expect(rows[3].errors.join()).toMatch(/appears 2 times/);
      expect(rows[5].errors.join()).toMatch(new RegExp(`already has E Number ${taken.biometricId}`));
      expect(rows[6].errors.join()).toMatch(/2 students are named/);
      expect(rows[7].errors.join()).toMatch(/E Number is blank/);
      expect(rows[8].warnings.join()).toMatch(/Company is blank/);
      // Preview changed nothing
      expect((await Student.findById(link._id))!.biometricId).toBeUndefined();

      const commit = await admin('post', '/api/attendance/biometric/import/commit').attach('file', file, 'master.xlsx');
      expect(commit.body.data.results).toMatchObject({ total: 9, applied: 1, skipped: 2, invalid: 6, failed: 0 });
      const linked = (await Student.findById(link._id))!;
      expect(linked.biometricId).toBe('7001');
      expect(linked.essl).toMatchObject({ company: 'ScholarLogic', department: 'Data Analytics', designation: 'Student', applyType: 'Regular' });
      expect((await Student.findById(taken._id))!.biometricId).toBe(taken.biometricId);

      // Importing the same file again applies nothing
      const repeat = await admin('post', '/api/attendance/biometric/import/commit').attach('file', file, 'master.xlsx');
      expect(repeat.body.data.results).toMatchObject({ applied: 0, unchanged: 1 });

      // The sequence moved past the imported number
      expect(Number((await newStudent('After Import')).biometricId)).toBeGreaterThan(7001);
    });

    it('rejects a file without the master columns and enforces Apply Type once allowed values are set', async () => {
      const bad = await admin('post', '/api/attendance/biometric/import/preview').attach('file', sheet([[1, 'x']], ['Code', 'Person']), 'bad.xlsx');
      expect(bad.status).toBe(400);
      expect(bad.body.message).toMatch(/E Number/);

      expect((await admin('post', '/api/attendance/biometric/import/preview').attach('file', Buffer.from('x'), 'notes.txt')).status).toBe(400);

      await admin('put', '/api/attendance/biometric/settings').send({ applyTypeAllowed: ['Regular'] });
      const s = await newStudent('Apply Type Case');
      const res = await admin('post', '/api/attendance/biometric/import/preview').attach(
        'file',
        sheet([[Number(s.biometricId), 'Apply Type Case', 'ScholarLogic', 'DA', 'Student', 'Weird']]),
        'm.xlsx'
      );
      expect(res.body.data.rows[0].errors.join()).toMatch(/Apply Type "Weird" is not one of: Regular/);
      await admin('put', '/api/attendance/biometric/settings').send({ applyTypeAllowed: [] });
    });

    it('exports the master columns for students with an E Number', async () => {
      const res = await admin('get', '/api/attendance/biometric/export?format=xlsx').buffer(true).parse((r: any, cb: any) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      const wb = XLSX.read(res.body, { type: 'buffer' });
      const grid = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      expect(grid[0]).toEqual(['E Number', 'Name', 'Company', 'Department', 'Designation', 'Apply Type']);
      const row = grid.find((r) => r[0] === 7001);
      expect(row).toEqual([7001, 'Import Link', 'ScholarLogic', 'Data Analytics', 'Student', 'Regular']);
      expect(grid.length - 1).toBe(await Student.countDocuments({ biometricId: { $exists: true } }));
    });
  });

  describe('Push to the machine', () => {
    it('reports only what the machine itself confirms, and does not duplicate on retry', async () => {
      const a = await newStudent('Push Accept');
      const b = await newStudent('Push Reject');
      const none = await newStudent('Push NoNumber');
      await Student.updateOne({ _id: none._id }, { $unset: { biometricId: 1 } });
      await admin('put', `/api/attendance/students/${a._id}/card-number`).send({ cardNumber: '1234567' });

      // Machine has never connected: queued, explicitly not delivered
      const push = await admin('post', '/api/attendance/biometric/push').send({ studentIds: [a._id, b._id, none._id] });
      const result = (id: any, body = push.body) => body.data.results.find((r: any) => r.studentMongoId === String(id));
      expect(push.body.data.deviceOnline).toBe(false);
      expect(result(a._id)).toMatchObject({ outcome: 'QUEUED' });
      expect(result(a._id).message).toMatch(/nothing has been delivered/);
      expect(result(none._id)).toMatchObject({ outcome: 'NOT_QUEUED', message: 'No E Number assigned' });
      expect((await overviewRow(a._id)).device.status).toBe('QUEUED');

      // Retry: same commands, no duplicates
      const retry = await admin('post', '/api/attendance/biometric/push').send({ studentIds: [a._id, b._id] });
      expect(result(a._id, retry.body).outcome).toBe('ALREADY_QUEUED');
      expect(await BiometricCommand.countDocuments({ studentId: { $in: [a._id, b._id] }, kind: 'USER_UPSERT' })).toBe(2);

      // The machine polls and collects both commands
      await device.handshake();
      const poll = await device.poll();
      const lines = poll.text.split('\n');
      const lineA = lines.find((l) => l.includes(`PIN=${a.biometricId}\t`))!;
      const lineB = lines.find((l) => l.includes(`PIN=${b.biometricId}\t`))!;
      expect(lineA).toMatch(new RegExp(`^C:\\d+:DATA UPDATE USERINFO PIN=${a.biometricId}\\tName=Push Accept\\tCard=1234567$`));
      expect(lineB).not.toMatch(/Card=/);
      expect((await device.poll()).text).toBe('OK'); // not handed out twice
      expect((await overviewRow(a._id)).device.status).toBe('SENT');

      // It accepts one and rejects the other
      const idA = lineA.split(':')[1];
      const idB = lineB.split(':')[1];
      await device.reply([`ID=${idA}&Return=0&CMD=DATA`, `ID=${idB}&Return=-1&CMD=DATA`]);
      expect((await overviewRow(a._id)).device.status).toBe('CONFIRMED');
      const rejected = await overviewRow(b._id);
      expect(rejected.device.status).toBe('FAILED');
      expect(rejected.device.message).toMatch(/Return=-1/);

      // A repeated reply changes nothing
      await device.reply([`ID=${idB}&Return=0&CMD=DATA`]);
      expect((await overviewRow(b._id)).device.status).toBe('FAILED');

      // After accepting, ScholarLogic asks the machine to send the stored record back
      const readback = (await device.poll()).text;
      expect(readback).toMatch(new RegExp(`^C:\\d+:DATA QUERY USERINFO PIN=${a.biometricId}$`));

      // Only the machine's own record makes it VERIFIED
      await device.operlog([`USER PIN=${a.biometricId}\tName=Push Accept\tPri=0\tPasswd=\tCard=1234567\tGrp=1\tTZ=0000000000000000`]);
      const verified = await overviewRow(a._id);
      expect(verified.device.status).toBe('VERIFIED');

      // A different card on the machine is reported as a mismatch, not as success
      await device.operlog([`USER PIN=${a.biometricId}\tName=Push Accept\tPri=0\tPasswd=\tCard=999\tGrp=1`]);
      expect((await overviewRow(a._id)).device.status).toBe('CARD_MISMATCH');

      // Pushing the rejected student again creates a fresh command
      const again = await admin('post', '/api/attendance/biometric/push').send({ studentIds: [b._id] });
      expect(result(b._id, again.body).outcome).toBe('QUEUED');
    });

    it('will not overwrite an ID the machine already holds under another name unless told to', async () => {
      const s = await newStudent('Real Student');
      await device.operlog([`USER PIN=${s.biometricId}\tName=Someone Else\tPri=0\tCard=0`]);
      const blocked = await admin('post', '/api/attendance/biometric/push').send({ studentIds: [s._id] });
      expect(blocked.body.data.results[0]).toMatchObject({ outcome: 'NOT_QUEUED' });
      expect(blocked.body.data.results[0].message).toMatch(/already on the machine as "Someone Else"/);
      const forced = await admin('post', '/api/attendance/biometric/push').send({ studentIds: [s._id], force: true });
      expect(forced.body.data.results[0].outcome).toBe('QUEUED');
    });
  });

  describe('Attendance sync', () => {
    it('IN + OUT in the window = Present for that student only; resending stores nothing new', async () => {
      const a = await newStudent('Sync Present');
      const b = await newStudent('Sync Other');
      const lines = [punch(a.biometricId!, day(3), '09:02:11', 'IN'), punch(a.biometricId!, day(3), '17:31:40', 'OUT')];

      expect((await device.attlog(lines)).text).toBe('OK: 2');
      expect(await dayOf(a._id, day(3))).toMatchObject({ status: 'PRESENT', source: 'BIOMETRIC', inTime: '09:02:11', outTime: '17:31:40' });
      expect((await dayOf(b._id, day(3)))?.source).not.toBe('BIOMETRIC');

      // Original record kept as sent
      const stored = await BiometricPunch.find({ userPin: a.biometricId }).sort({ punchTime: 1 }).lean();
      expect(stored.map((p) => [p.localDate, p.localTime, p.direction, p.stateCode])).toEqual([
        [day(3), '09:02:11', 'IN', 0],
        [day(3), '17:31:40', 'OUT', 1],
      ]);
      expect(stored[0].punchTime.toISOString()).toBe(new Date(`${day(3)}T09:02:11+05:30`).toISOString());

      // The machine re-uploads after a restart
      await device.attlog(lines);
      await device.attlog(lines);
      expect(await BiometricPunch.countDocuments({ userPin: a.biometricId })).toBe(2);
    });

    it('an IN with no OUT stays Incomplete, with no late or minimum-duration rule', async () => {
      const a = await newStudent('Sync Incomplete');
      await device.attlog([punch(a.biometricId!, day(4), '11:45:00', 'IN')]);
      expect(await dayOf(a._id, day(4))).toMatchObject({ status: 'INCOMPLETE', inTime: '11:45:00' });

      // Late arrival and a short stay are still Present
      await device.attlog([punch(a.biometricId!, day(4), '11:50:00', 'OUT')]);
      expect(await dayOf(a._id, day(4))).toMatchObject({ status: 'PRESENT', inTime: '11:45:00', outTime: '11:50:00' });
    });

    it('keeps punches outside 7 AM – 8 PM for review without counting them', async () => {
      const a = await newStudent('Sync Early');
      await device.attlog([punch(a.biometricId!, day(5), '06:40:00', 'IN'), punch(a.biometricId!, day(5), '20:30:00', 'OUT')]);
      expect((await dayOf(a._id, day(5)))?.source).not.toBe('BIOMETRIC');

      const review = (await admin('get', '/api/attendance/biometric/review')).body.data;
      const mine = review.outOfWindow.filter((p: any) => p.studentId === a.studentId).map((p: any) => p.time);
      expect(mine.sort()).toEqual(['06:40:00', '20:30:00']);
    });

    it('never guesses: unknown IDs and Student-ID look-alikes go to the review queue', async () => {
      // The seeded student SL-2026-00001 has no Biometric ID
      await device.attlog([punch('SL-2026-00001', day(6), '09:00:00', 'IN'), punch('00001', day(6), '09:01:00', 'IN'), punch('88888', day(6), '09:02:00', 'IN')]);
      expect(await BiometricPunch.countDocuments({ userPin: { $in: ['SL-2026-00001', '00001', '88888'] }, studentId: { $exists: true } })).toBe(0);

      const review = (await admin('get', '/api/attendance/biometric/review')).body.data;
      expect(review.unknownIds.map((u: any) => u.userPin)).toEqual(expect.arrayContaining(['SL-2026-00001', '00001', '88888']));

      // Once an admin gives a student that ID, its punches move to exactly that student
      const s = await newStudent('Sync Late Link');
      const res = await admin('put', `/api/attendance/students/${s._id}/biometric-id`).send({ biometricId: '88888' });
      expect(res.body.data.relinked).toBe(1);
      expect(await dayOf(s._id, day(6))).toMatchObject({ status: 'INCOMPLETE', inTime: '09:02:00' });
    });

    it('holds punches when the machine has the ID under a card registered to another student', async () => {
      const owner = await newStudent('Conflict Owner');
      const other = await newStudent('Conflict Other');
      await admin('put', `/api/attendance/students/${other._id}/card-number`).send({ cardNumber: '424242' });
      await device.operlog([`USER PIN=${owner.biometricId}\tName=Conflict Owner\tPri=0\tCard=424242`]);

      await device.attlog([punch(owner.biometricId!, day(7), '09:00:00', 'IN'), punch(owner.biometricId!, day(7), '17:00:00', 'OUT')]);
      expect((await dayOf(owner._id, day(7)))?.source).not.toBe('BIOMETRIC');
      expect((await dayOf(other._id, day(7)))?.source).not.toBe('BIOMETRIC');

      const review = (await admin('get', '/api/attendance/biometric/review')).body.data;
      const conflict = review.conflicts.find((c: any) => c.userPin === owner.biometricId);
      expect(conflict.punches).toBe(2);
      expect(conflict.note).toMatch(new RegExp(`registered to ${other.studentId}`));

      // Fixing the card and re-matching releases them to the right student
      await admin('put', `/api/attendance/students/${other._id}/card-number`).send({ cardNumber: '' });
      expect(await dayOf(owner._id, day(7))).toMatchObject({ status: 'PRESENT' });
    });

    it('skips unreadable lines without losing the readable ones', async () => {
      const a = await newStudent('Sync Garbage');
      const res = await device.attlog(['not a punch', `${a.biometricId}\t2026-13-45 99:99:99\t0\t4`, punch(a.biometricId!, day(8), '10:00:00', 'IN')]);
      expect(res.status).toBe(200);
      expect(await BiometricPunch.countDocuments({ userPin: a.biometricId })).toBe(1);
    });

    it('refuses machines that are not on the allow-list', async () => {
      if (!env.BIOMETRIC_DEVICE_SERIALS.length) return;
      const res = await request(app).post('/iclock/cdata?SN=NOTMINE&table=ATTLOG').set('Content-Type', 'text/plain').send(punch('1', day(3), '09:00:00', 'IN'));
      expect(res.status).toBe(403);
    });
  });

  describe('Access and existing features', () => {
    it('a student sees only their own attendance; setup endpoints are admin-only', async () => {
      const a = await newStudent('Access One', { email: 'access.one@test.com' });
      const b = await newStudent('Access Two', { email: 'access.two@test.com' });
      await device.attlog([punch(a.biometricId!, day(9), '09:00:00', 'IN'), punch(a.biometricId!, day(9), '17:00:00', 'OUT')]);

      const tokenB = (await request(app).post('/api/auth/login').send({ email: 'access.two@test.com', password: 'Passw0rd!' })).body.data.tokens.accessToken;
      const asB = (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokenB}`);

      const mine = await asB('/api/attendance/me');
      expect(mine.status).toBe(200);
      expect(mine.body.data.tabs[0].days[day(9)]?.source).not.toBe('BIOMETRIC');
      expect((await asB(`/api/attendance/students/${a._id}`)).status).toBe(403);
      expect((await asB('/api/attendance/biometric/overview')).status).toBe(403);
      expect((await asB('/api/attendance/biometric/review')).status).toBe(403);
      expect((await request(app).get('/api/attendance/biometric/overview').set('Authorization', `Bearer ${trainerToken}`)).status).toBe(403);
      expect(b.biometricId).not.toBe(a.biometricId);
    });

    it('trainers can still mark attendance by hand for online students', async () => {
      const online = await newStudent('Online Learner', { mode: 'ONLINE' });
      const res = await request(app)
        .post('/api/trainer/attendance')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ courseId: new mongoose.Types.ObjectId(), sessionName: 'Online class', records: [{ studentId: online._id, status: 'PRESENT' }] });
      expect(res.status).toBe(201);
      expect(await dayOf(online._id, today)).toMatchObject({ status: 'PRESENT', source: 'MANUAL' });
    });

    it('shows sync status, last successful sync and a log of what happened', async () => {
      const overview = (await admin('get', '/api/attendance/biometric/overview')).body.data;
      const d = overview.devices.find((x: any) => x.serialNumber === SN);
      expect(d.online).toBe(true);
      expect(d.pushVersion).toBe('2.4.1');
      expect(new Date(d.lastSyncAt).getTime()).toBeGreaterThan(Date.now() - 60000);
      expect(overview.counts.unknownIds).toBeGreaterThan(0);

      const logs = (await admin('get', '/api/attendance/biometric/logs')).body.data;
      const kinds = new Set(logs.map((l: any) => l.kind));
      ['ATTLOG', 'COMMAND', 'PUSH', 'IMPORT', 'USERS'].forEach((k) => expect(kinds.has(k)).toBe(true));
      expect(logs.some((l: any) => l.level === 'ERROR' && /rejected ID/.test(l.message))).toBe(true);
      const warnOnly = (await admin('get', '/api/attendance/biometric/logs?level=WARN')).body.data;
      expect(warnOnly.every((l: any) => l.level === 'WARN')).toBe(true);
    });
  });
});
