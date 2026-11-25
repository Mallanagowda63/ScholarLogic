import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { env } from '../src/config/env';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { Student } from '../src/models/Student';
import { User } from '../src/models/User';
import { BiometricPunch } from '../src/models/BiometricPunch';
import { OnlineAttendance } from '../src/models/OnlineAttendance';

// Runs on the in-memory DB (see vitest.config.ts)
describe('Online students: QR attendance', () => {
  let student: string;
  let admin: string;
  let studentDoc: any;
  let token: string;

  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;
  const tokenFrom = (url: string) => decodeURIComponent(new URL(url).searchParams.get('t')!);

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    student = await login('student@scholarlogic.edu', 'Student@123');
    admin = await login('admin@scholarlogic.edu', 'Admin@123');
    const u = await User.findOne({ email: 'student@scholarlogic.edu' });
    studentDoc = await Student.findOne({ userId: u!._id });
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it('offline students get no QR code', async () => {
    await Student.updateOne({ _id: studentDoc._id }, { $set: { 'enrollment.mode': 'OFFLINE' } });
    const res = await request(app).get('/api/online-attendance/qr').set('Authorization', `Bearer ${student}`);
    expect(res.status).toBe(403);
  });

  it('an online student gets a QR link that opens their details', async () => {
    await Student.updateOne({ _id: studentDoc._id }, { $set: { 'enrollment.mode': 'ONLINE' } });
    const res = await request(app).get('/api/online-attendance/qr').set('Authorization', `Bearer ${student}`);
    expect(res.status).toBe(200);
    expect(res.body.data.checkInUrl).toContain('/attendance/check-in?t=');
    expect(res.body.data.markedToday).toBeNull();
    token = tokenFrom(res.body.data.checkInUrl);

    const info = await request(app).get('/api/online-attendance/check-in').query({ t: token });
    expect(info.status).toBe(200);
    expect(info.body.data.student.fullName).toBe('Alex Morgan');
    expect(info.body.data.student.studentId).toBe('SL-2026-00001');
    expect(info.body.data.alreadyMarked).toBeNull();
  });

  it('needs the topic and the confirmation tick', async () => {
    expect((await request(app).post('/api/online-attendance/check-in').send({ t: token, topic: '', confirm: true })).status).toBe(400);
    expect((await request(app).post('/api/online-attendance/check-in').send({ t: token, topic: 'Python loops' })).status).toBe(400);
  });

  it('marks attendance once a day, separate from eSSL punches', async () => {
    const punchesBefore = await BiometricPunch.countDocuments({});
    const first = await request(app).post('/api/online-attendance/check-in').send({ t: token, topic: 'Python loops', note: 'joined late', confirm: true });
    expect(first.status).toBe(201);
    const again = await request(app).post('/api/online-attendance/check-in').send({ t: token, topic: 'Again', confirm: true });
    expect(again.body.data.alreadyMarked).toBe(true);
    expect(await OnlineAttendance.countDocuments({ studentId: studentDoc._id })).toBe(1);
    expect(await BiometricPunch.countDocuments({})).toBe(punchesBefore);

    const qr = await request(app).get('/api/online-attendance/qr').set('Authorization', `Bearer ${student}`);
    expect(qr.body.data.markedToday.topic).toBe('Python loops');
    const me = await request(app).get('/api/online-attendance/me').set('Authorization', `Bearer ${student}`);
    expect(me.body.data.records).toHaveLength(1);
    expect(me.body.data.thisMonth).toBe(1);
  });

  it('expired or forged QR links are refused', async () => {
    const day = new Date(Date.now() + env.BIOMETRIC_TZ_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
    const expired = jwt.sign({ typ: 'online-attendance', sid: String(studentDoc._id), day, exp: Math.floor(Date.now() / 1000) - 10 }, env.JWT_SECRET);
    expect((await request(app).get('/api/online-attendance/check-in').query({ t: expired })).status).toBe(410);
    const forged = jwt.sign({ typ: 'online-attendance', sid: String(studentDoc._id), day }, 'not-the-server-secret');
    expect((await request(app).get('/api/online-attendance/check-in').query({ t: forged })).status).toBe(400);
    const loginToken = (await request(app).post('/api/auth/login').send({ email: 'student@scholarlogic.edu', password: 'Student@123' })).body.data.tokens.accessToken;
    expect((await request(app).get('/api/online-attendance/check-in').query({ t: loginToken })).status).toBe(400);
  });

  it('admins see who is present and which online students have not marked', async () => {
    const res = await request(app).get('/api/online-attendance').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.data.present.map((p: any) => p.studentId)).toContain('SL-2026-00001');
    expect(res.body.data.present[0].topic).toBe('Python loops');
    expect((await request(app).get('/api/online-attendance').set('Authorization', `Bearer ${student}`)).status).toBe(403);
  });
});
