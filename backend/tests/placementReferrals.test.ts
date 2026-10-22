import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { User } from '../src/models/User';
import { Notification } from '../src/models/Notification';

// Runs on the in-memory DB (see vitest.config.ts)
describe('Trainer pushes a student to the placement team', () => {
  let trainer: string;
  let placement: string;
  let student: string;
  let target: any;
  let referralId: string;

  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;
  const as = (token: string) => ({
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
  });

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    trainer = await login('trainer@scholarlogic.edu', 'Trainer@123');
    placement = await login('placement@scholarlogic.edu', 'Placement@123');
    student = await login('student@scholarlogic.edu', 'Student@123');
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it('trainer sees the student list (real data, no random numbers)', async () => {
    const res = await as(trainer).get('/api/placement-referrals/students');
    expect(res.status).toBe(200);
    target = res.body.data.students.find((s: any) => s.studentId === 'SL-2026-00001');
    expect(target.fullName).toBe('Alex Morgan');
    expect(target.referral).toBeNull();
    expect(target).not.toHaveProperty('courseProgressPct');
  });

  it('pushing notifies every placement manager and is not allowed twice while open', async () => {
    const managers = await User.find({ role: 'PLACEMENT_MANAGER' }).select('_id');
    const before = await Notification.countDocuments({ userId: { $in: managers.map((m) => m._id) } });
    const res = await as(trainer).post('/api/placement-referrals').send({ studentId: target._id, note: 'Strong in SQL' });
    expect(res.status).toBe(201);
    referralId = res.body.data.referral._id;
    const after = await Notification.countDocuments({ userId: { $in: managers.map((m) => m._id) } });
    expect(after - before).toBe(managers.length);
    const n = await Notification.findOne({ userId: managers[0]._id }).sort({ createdAt: -1 });
    expect(n!.message).toContain('Alex Morgan');
    expect(n!.linkUrl).toMatch(/^\/placement\/ready-students/);

    const again = await as(trainer).post('/api/placement-referrals').send({ studentId: target._id });
    expect(again.status).toBe(409);
  });

  it('the placement team sees the student with course, trainer and note', async () => {
    const res = await as(placement).get('/api/placement-referrals');
    expect(res.status).toBe(200);
    const r = res.body.data.referrals.find((x: any) => x._id === referralId);
    expect(r.student.fullName).toBe('Alex Morgan');
    expect(r.note).toBe('Strong in SQL');
    expect(r.status).toBe('NEW');
    expect(typeof r.courseName).toBe('string');
    expect(r.pushedBy).toBeTruthy();
  });

  it('only trainers push, only the placement team reads and updates', async () => {
    expect((await as(student).post('/api/placement-referrals').send({ studentId: target._id })).status).toBe(403);
    expect((await as(trainer).get('/api/placement-referrals')).status).toBe(403);
    expect((await as(trainer).put(`/api/placement-referrals/${referralId}`).send({ status: 'PLACED' })).status).toBe(403);
  });

  it('once placed or closed, the trainer sees it and can push again', async () => {
    const upd = await as(placement).put(`/api/placement-referrals/${referralId}`).send({ status: 'CLOSED', placementNote: 'Not interested now' });
    expect(upd.status).toBe(200);
    const list = await as(trainer).get('/api/placement-referrals/students');
    expect(list.body.data.students.find((s: any) => s._id === target._id).referral.status).toBe('CLOSED');
    const again = await as(trainer).post('/api/placement-referrals').send({ studentId: target._id });
    expect(again.status).toBe(201);
  });
});
