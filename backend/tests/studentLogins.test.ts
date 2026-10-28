import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { Student } from '../src/models/Student';
import { User } from '../src/models/User';

// Runs on the in-memory DB (see vitest.config.ts)
describe('Admin: Student Login & ID Card', () => {
  let admin: string;
  let trainer: string;
  let studentDoc: any;

  const login = async (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });
  const token = async (email: string, password: string) => (await login(email, password)).body.data.tokens.accessToken;

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    admin = await token('admin@scholarlogic.edu', 'Admin@123');
    trainer = await token('trainer@scholarlogic.edu', 'Trainer@123');
    const u = await User.findOne({ email: 'student@scholarlogic.edu' });
    studentDoc = await Student.findOne({ userId: u!._id });
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it('only admins can use it', async () => {
    expect((await request(app).get('/api/admin/student-logins').set('Authorization', `Bearer ${trainer}`)).status).toBe(403);
  });

  it('checks an ID card by Student ID in any letter case, without needing the eSSL machine code', async () => {
    const res = await request(app).get('/api/admin/student-logins/check/sl-2026-00001').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.data.student.fullName).toBe('Alex Morgan');
    expect(res.body.data.student.loginId).toBe('SL-2026-00001');
    expect(res.body.data.student.machineCode).toBe('');
    const missing = await request(app).get('/api/admin/student-logins/check/SCLR99999').set('Authorization', `Bearer ${admin}`);
    expect(missing.status).toBe(404);
  });

  it('creates an automatic password that works for login and is shown afterwards', async () => {
    const res = await request(app).post(`/api/admin/student-logins/${studentDoc._id}/generate-password`).set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    const { loginId, password } = res.body.data;
    expect(password).toMatch(/^[A-Za-z0-9]{8}@\d$/);
    expect((await login(loginId, password)).status).toBe(200);
    expect((await login('student@scholarlogic.edu', 'Student@123')).status).toBe(401);
    const list = await request(app).get('/api/admin/student-logins').set('Authorization', `Bearer ${admin}`);
    expect(list.body.data.students.find((s: any) => s.studentId === 'SL-2026-00001').password).toBe(password);
  });
});
