import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { Student } from '../src/models/Student';
import { User } from '../src/models/User';
import { BiometricPunch } from '../src/models/BiometricPunch';
import { OnlineAttendance } from '../src/models/OnlineAttendance';

// Runs on the in-memory DB (see vitest.config.ts)
describe('Admin: delete a student', () => {
  let admin: string;
  let trainer: string;
  let studentDoc: any;

  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    admin = await login('admin@scholarlogic.edu', 'Admin@123');
    trainer = await login('trainer@scholarlogic.edu', 'Trainer@123');
    const u = await User.findOne({ email: 'student@scholarlogic.edu' });
    studentDoc = await Student.findOne({ userId: u!._id });
    await BiometricPunch.create({ deviceSerial: 'TEST1', userPin: '77', punchTime: new Date(), localDate: '2026-10-22', localTime: '09:00:00', studentId: studentDoc._id });
    await OnlineAttendance.create({ studentId: studentDoc._id, userId: u!._id, date: '2026-10-22', topic: 'Python loops' } as any).catch(() => undefined);
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it('only admins can delete', async () => {
    const res = await request(app).delete(`/api/tracking/students/${studentDoc._id}`).set('Authorization', `Bearer ${trainer}`);
    expect(res.status).toBe(403);
    expect(await Student.exists({ _id: studentDoc._id })).toBeTruthy();
  });

  it('removes the student and their login, keeps machine punches unlinked', async () => {
    const res = await request(app).delete(`/api/tracking/students/${studentDoc._id}`).set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Alex Morgan');
    expect(await Student.exists({ _id: studentDoc._id })).toBeNull();
    expect(await User.exists({ email: 'student@scholarlogic.edu' })).toBeNull();
    expect(await OnlineAttendance.countDocuments({ studentId: studentDoc._id })).toBe(0);
    const punch = await BiometricPunch.findOne({ deviceSerial: 'TEST1', userPin: '77' }).lean();
    expect(punch).toBeTruthy();
    expect(punch!.studentId).toBeUndefined();
    // The deleted student can no longer sign in
    const again = await request(app).post('/api/auth/login').send({ email: 'student@scholarlogic.edu', password: 'Student@123' });
    expect(again.status).toBe(401);
  });

  it('a second delete says not found; admins are never touched', async () => {
    const res = await request(app).delete(`/api/tracking/students/${studentDoc._id}`).set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(404);
    expect(await User.exists({ email: 'admin@scholarlogic.edu' })).toBeTruthy();
  });
});
