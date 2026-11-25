import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { User } from '../src/models/User';
import { Course } from '../src/models/Course';

// Runs on the in-memory DB (see vitest.config.ts)
describe('Trainer writes a course name when adding a recording', () => {
  let newTrainer: string;

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    const bcrypt = await import('bcryptjs');
    await User.create({ email: 'fresh.trainer@test.local', passwordHash: await bcrypt.hash('Fresh@12345', 10), fullName: 'Fresh Trainer', role: 'TRAINER' });
    newTrainer = (await request(app).post('/api/auth/login').send({ email: 'fresh.trainer@test.local', password: 'Fresh@12345' })).body.data.tokens.accessToken;
  });
  afterAll(async () => {
    await disconnectDB();
  });

  const write = (title: string) => request(app).post('/api/trainer/courses').set('Authorization', `Bearer ${newTrainer}`).send({ title });
  const mine = async () => (await request(app).get('/api/trainer/courses').set('Authorization', `Bearer ${newTrainer}`)).body.data.courses.map((c: any) => c.title);

  it('a trainer with no courses can write a new one, and then adds a module to it', async () => {
    expect(await mine()).toEqual([]);
    const res = await write('  Data Engineering  ');
    expect(res.status).toBe(201);
    expect(res.body.data.course.title).toBe('Data Engineering');
    expect(await mine()).toEqual(['Data Engineering']);
    const mod = await request(app).post(`/api/trainer/courses/${res.body.data.course._id}/modules`).set('Authorization', `Bearer ${newTrainer}`).send({ title: 'Live Recordings' });
    expect(mod.status).toBe(201);
  });

  it('writing an existing course name (any case) reuses it instead of making a copy', async () => {
    const existing = await Course.findOne({ title: 'Python Full Stack Development' });
    const res = await write('python full stack development');
    expect(res.status).toBe(200);
    expect(String(res.body.data.course._id)).toBe(String(existing!._id));
    expect(await Course.countDocuments({ title: /^python full stack development$/i })).toBe(1);
    expect(await mine()).toContain('Python Full Stack Development');
    expect((await write('')).status).toBe(400);
  });
});
