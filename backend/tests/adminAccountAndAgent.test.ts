import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { env } from '../src/config/env';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { BiometricPunch } from '../src/models/BiometricPunch';
import { BiometricDeviceUser } from '../src/models/BiometricIntegration';

// Runs on the in-memory DB (see vitest.config.ts)
const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Admin changes their own login', () => {
  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
  });

  it('needs the current password and a strong new one', async () => {
    const token = (await login('admin@scholarlogic.edu', 'Admin@123')).body.data.tokens.accessToken;
    const put = (body: any) => request(app).put('/api/auth/my-credentials').set('Authorization', `Bearer ${token}`).send(body);
    expect((await put({ currentPassword: 'wrong', newPassword: 'NewStrong2026pw' })).status).toBe(400);
    expect((await put({ currentPassword: 'Admin@123', newPassword: 'short1' })).status).toBe(400);
    expect((await put({ currentPassword: 'Admin@123', newPassword: 'Admin@123456' })).status).toBe(400);
    expect((await put({ currentPassword: 'Admin@123' })).status).toBe(400);
  });

  it('changes email and password: old ones stop working, old sessions end, this browser gets a new session', async () => {
    const oldToken = (await login('admin@scholarlogic.edu', 'Admin@123')).body.data.tokens.accessToken;
    await wait(1100); // tokens carry whole-second timestamps
    const res = await request(app)
      .put('/api/auth/my-credentials')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'Admin@123', newEmail: 'Owner@Institute.in', newPassword: 'Kv9#mountain2026' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('owner@institute.in');

    expect((await login('admin@scholarlogic.edu', 'Admin@123')).status).toBe(401);
    expect((await login('owner@institute.in', 'Admin@123')).status).toBe(401);
    expect((await login('owner@institute.in', 'Kv9#mountain2026')).status).toBe(200);
    expect((await request(app).get('/api/admin/staff').set('Authorization', `Bearer ${oldToken}`)).status).toBe(401);
    expect((await request(app).get('/api/admin/staff').set('Authorization', `Bearer ${res.body.data.tokens.accessToken}`)).status).toBe(200);
  });

  it('changing only the email keeps the same password', async () => {
    const token = (await login('owner@institute.in', 'Kv9#mountain2026')).body.data.tokens.accessToken;
    const res = await request(app).put('/api/auth/my-credentials').set('Authorization', `Bearer ${token}`).send({ currentPassword: 'Kv9#mountain2026', newEmail: 'head@institute.in' });
    expect(res.status).toBe(200);
    expect((await login('head@institute.in', 'Kv9#mountain2026')).status).toBe(200);
    expect((await login('owner@institute.in', 'Kv9#mountain2026')).status).toBe(401);
    // This browser's session keeps working
    expect((await request(app).get('/api/auth/my-profile').set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('trainers and the placement team cannot change their own password', async () => {
    const t = (await login('trainer@scholarlogic.edu', 'Trainer@123')).body.data.tokens.accessToken;
    const res = await request(app).put('/api/auth/my-credentials').set('Authorization', `Bearer ${t}`).send({ currentPassword: 'Trainer@123', newPassword: 'Trainer2026strong' });
    expect(res.status).toBe(403);
  });
});

describe('Campus eSSL helper → server', () => {
  const SECRET = 'test-agent-secret-0123456789';
  const push = (body: any, secret = SECRET) => request(app).post('/api/integrations/essl-agent/push').set('X-ESSL-Agent-Secret', secret).send(body);

  beforeAll(() => {
    env.ESSL_AGENT_SECRET = SECRET;
    env.BIOMETRIC_DEVICE_SERIALS = ['CUB7254300566'];
  });
  afterAll(async () => {
    env.ESSL_AGENT_SECRET = '';
    await disconnectDB();
  });

  const snapshot = {
    serialNumber: 'CUB7254300566',
    users: [{ uid: 1, userId: 'SCLR900', name: 'Helper Test', card: '123', privilege: 0 }],
    punches: [
      { userId: 'SCLR900', localTime: '2026-10-20 09:00:00', state: 0, verify: 4 },
      { userId: 'SCLR900', localTime: '2026-10-20 17:30:00', state: 0, verify: 4 },
      { userId: 'SCLR900', localTime: 'not a time', state: 0, verify: 4 },
    ],
  };

  it('refuses a wrong secret', async () => {
    expect((await push(snapshot, 'wrong')).status).toBe(401);
    expect((await request(app).get('/api/integrations/essl-agent/cursor?serial=CUB7254300566')).status).toBe(401);
  });

  it('stores users and well-formed punches once, and tells the helper where to resume', async () => {
    const first = await push(snapshot);
    expect(first.status).toBe(200);
    expect(first.body.data.newPunches).toBe(2);
    expect(await BiometricDeviceUser.exists({ pin: 'SCLR900', name: 'Helper Test' })).toBeTruthy();
    const again = await push(snapshot);
    expect(again.body.data.newPunches).toBe(0);
    expect(await BiometricPunch.countDocuments({ userPin: 'SCLR900' })).toBe(2);
    const cursor = await request(app).get('/api/integrations/essl-agent/cursor?serial=CUB7254300566').set('X-ESSL-Agent-Secret', SECRET);
    expect(cursor.body.data.cutoff).toBe('2026-10-18');
  });

  it('refuses a machine with another serial', async () => {
    const res = await push({ ...snapshot, serialNumber: 'SOMEONE-ELSE' });
    expect(res.status).toBe(403);
    expect(await BiometricPunch.countDocuments({ deviceSerial: 'SOMEONE-ELSE' })).toBe(0);
  });
});
