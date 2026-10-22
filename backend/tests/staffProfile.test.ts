import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { User } from '../src/models/User';

// Runs on the in-memory DB (see vitest.config.ts)
describe('My Profile for admin, trainer and placement team', () => {
  const tokens: Record<string, string> = {};
  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    tokens.admin = await login('admin@scholarlogic.edu', 'Admin@123');
    tokens.trainer = await login('trainer@scholarlogic.edu', 'Trainer@123');
    tokens.placement = await login('placement@scholarlogic.edu', 'Placement@123');
    tokens.student = await login('student@scholarlogic.edu', 'Student@123');
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it.each(['admin', 'trainer', 'placement'])('%s can edit and read back their details', async (who) => {
    const put = await request(app)
      .put('/api/auth/my-profile')
      .set('Authorization', `Bearer ${tokens[who]}`)
      .send({ fullName: `New ${who} name`, phone: '+91 90086 25716', designation: 'Coordinator', department: 'Training', bio: 'Hello' });
    expect(put.status).toBe(200);
    const get = await request(app).get('/api/auth/my-profile').set('Authorization', `Bearer ${tokens[who]}`);
    expect(get.body.data.fullName).toBe(`New ${who} name`);
    expect(get.body.data.profile.phone).toBe('+91 90086 25716');
    expect(get.body.data.profile.department).toBe('Training');
  });

  it('cannot change login email, password or role from here', async () => {
    for (const extra of [{ email: 'x@y.com' }, { password: 'Whatever123' }, { newPassword: 'Whatever123' }, { role: 'ADMIN' }]) {
      const res = await request(app).put('/api/auth/my-profile').set('Authorization', `Bearer ${tokens.trainer}`).send({ fullName: 'Trainer', ...extra });
      expect(res.status).toBe(403);
    }
    const trainer = await User.findOne({ email: 'trainer@scholarlogic.edu' });
    expect(trainer!.role).toBe('TRAINER');
    expect((await request(app).post('/api/auth/login').send({ email: 'trainer@scholarlogic.edu', password: 'Trainer@123' })).status).toBe(200);
  });

  it('rejects a bad phone number or empty name', async () => {
    const bad = (body: any) => request(app).put('/api/auth/my-profile').set('Authorization', `Bearer ${tokens.placement}`).send(body);
    expect((await bad({ phone: 'call me' })).status).toBe(400);
    expect((await bad({ fullName: ' ' })).status).toBe(400);
  });

  it('staff can upload, view and remove a profile photo', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const up = await request(app).put('/api/auth/my-photo').set('Authorization', `Bearer ${tokens.placement}`).attach('photo', png, { filename: 'me.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    expect(up.body.data.avatarUrl).toMatch(/^\/api\/auth\/photo\/[a-f\d]{24}\?v=\d+$/);
    const img = await request(app).get(up.body.data.avatarUrl);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    const me = await request(app).get('/api/auth/my-profile').set('Authorization', `Bearer ${tokens.placement}`);
    expect(me.body.data.avatarUrl).toBe(up.body.data.avatarUrl);

    const big = Buffer.alloc(2 * 1024 * 1024 + 10, 1);
    const tooBig = await request(app).put('/api/auth/my-photo').set('Authorization', `Bearer ${tokens.placement}`).attach('photo', big, { filename: 'big.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(400);
    const pdf = await request(app).put('/api/auth/my-photo').set('Authorization', `Bearer ${tokens.placement}`).attach('photo', Buffer.from('%PDF'), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(pdf.status).toBe(400);

    const del = await request(app).delete('/api/auth/my-photo').set('Authorization', `Bearer ${tokens.placement}`);
    expect(del.status).toBe(200);
    expect((await request(app).get(up.body.data.avatarUrl)).status).toBe(404);
  });

  it('students cannot use it', async () => {
    expect((await request(app).put('/api/auth/my-photo').set('Authorization', `Bearer ${tokens.student}`).attach('photo', Buffer.from('x'), { filename: 'a.png', contentType: 'image/png' })).status).toBe(403);
    expect((await request(app).get('/api/auth/my-profile').set('Authorization', `Bearer ${tokens.student}`)).status).toBe(403);
  });
});
