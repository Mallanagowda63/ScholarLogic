import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { User } from '../src/models/User';
import { AuditLog } from '../src/models/AuditLog';

// Runs on the in-memory DB (see vitest.config.ts)
describe('Admin → Staff Access', () => {
  let admin: string;
  let trainer: string;
  let created: any;
  let password: string;

  const login = (email: string, pw: string) => request(app).post('/api/auth/login').send({ email, password: pw });
  const as = (token: string) => ({
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
  });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    admin = (await login('admin@scholarlogic.edu', 'Admin@123')).body.data.tokens.accessToken;
    trainer = (await login('trainer@scholarlogic.edu', 'Trainer@123')).body.data.tokens.accessToken;
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it('public sign-up is closed, so nobody can make themselves an admin', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'sneaky@x.com', password: 'Pass@1234', fullName: 'Sneaky', role: 'ADMIN' });
    expect(res.status).toBe(404);
    expect(await User.exists({ email: 'sneaky@x.com' })).toBeNull();
  });

  it('admin creates a placement-team login with a generated password that works', async () => {
    const res = await as(admin).post('/api/admin/staff').send({ fullName: 'Priya Placement', email: 'Priya@Campus.com', role: 'PLACEMENT_MANAGER' });
    expect(res.status).toBe(201);
    created = res.body.data.staff;
    password = res.body.data.password;
    expect(created.email).toBe('priya@campus.com');
    expect(password).toMatch(/^[A-Za-z2-9]{9}@\d[!#$%&*]$/);
    const ok = await login('priya@campus.com', password);
    expect(ok.status).toBe(200);
    expect(ok.body.data.user.role).toBe('PLACEMENT_MANAGER');
    expect(await AuditLog.exists({ action: 'STAFF_CREATED', 'metadata.targetEmail': 'priya@campus.com' })).toBeTruthy();
  });

  it('only admins can manage staff; the list never contains passwords', async () => {
    expect((await as(trainer).get('/api/admin/staff')).status).toBe(403);
    expect((await as(trainer).post('/api/admin/staff').send({ fullName: 'x', email: 'x@y.com', role: 'TRAINER' })).status).toBe(403);
    const list = await as(admin).get('/api/admin/staff');
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|refreshToken/);
    expect(list.body.data.staff.some((s: any) => s.email === 'priya@campus.com')).toBe(true);
  });

  it('rejects duplicates, bad emails and roles other than trainer / placement', async () => {
    expect((await as(admin).post('/api/admin/staff').send({ fullName: 'P', email: 'priya@campus.com', role: 'TRAINER' })).status).toBe(409);
    expect((await as(admin).post('/api/admin/staff').send({ fullName: 'P', email: 'nope', role: 'TRAINER' })).status).toBe(400);
    expect((await as(admin).post('/api/admin/staff').send({ fullName: 'P', email: 'p2@campus.com', role: 'ADMIN' })).status).toBe(400);
  });

  it('reset: new password works, the old one and old sessions stop', async () => {
    const session = (await login('priya@campus.com', password)).body.data.tokens.accessToken;
    expect((await as(session).get('/api/placement-referrals')).status).toBe(200);
    await wait(1100); // tokens carry whole-second timestamps
    const res = await as(admin).post(`/api/admin/staff/${created._id}/reset-password`);
    expect(res.status).toBe(200);
    const fresh = res.body.data.password;
    expect(fresh).not.toBe(password);
    expect((await login('priya@campus.com', password)).status).toBe(401);
    expect((await login('priya@campus.com', fresh)).status).toBe(200);
    const old = await as(session).get('/api/placement-referrals');
    expect(old.status).toBe(401);
    expect(old.body.code).toBe('SESSION_REVOKED');
    password = fresh;
  });

  it('remove access: login refused and open sessions end; restore brings it back', async () => {
    const session = (await login('priya@campus.com', password)).body.data.tokens.accessToken;
    const removed = await as(admin).put(`/api/admin/staff/${created._id}`).send({ isActive: false });
    expect(removed.status).toBe(200);
    expect((await login('priya@campus.com', password)).status).toBe(403);
    expect((await as(session).get('/api/placement-referrals')).status).toBe(401);
    await as(admin).put(`/api/admin/staff/${created._id}`).send({ isActive: true });
    expect((await login('priya@campus.com', password)).status).toBe(200);
  });

  it('delete: refused while active, works after access is removed, batches lose the link', async () => {
    const res = await as(admin).post('/api/admin/staff').send({ fullName: 'Temp Trainer', email: 'temp.trainer@campus.com', role: 'TRAINER' });
    const id = res.body.data.staff._id;
    const pw = res.body.data.password;
    const { Batch } = await import('../src/models/tracking/Batch');
    const { Subject } = await import('../src/models/tracking/Subject');
    const subj = await Subject.create({ name: 'Temp Subject', code: 'TMPS', expectedDurationDays: 10 });
    const batch = await Batch.create({ batchCode: 'TMPS-B01', subjectId: subj._id, trainerId: id, timing: '9-10', startDate: new Date(), expectedEndDate: new Date() });

    expect((await request(app).delete(`/api/admin/staff/${id}`).set('Authorization', `Bearer ${admin}`)).status).toBe(409);
    await as(admin).put(`/api/admin/staff/${id}`).send({ isActive: false });
    expect((await request(app).delete(`/api/admin/staff/${id}`).set('Authorization', `Bearer ${trainer}`)).status).toBe(403);
    const del = await request(app).delete(`/api/admin/staff/${id}`).set('Authorization', `Bearer ${admin}`);
    expect(del.status).toBe(200);
    expect(await User.exists({ _id: id })).toBeNull();
    expect((await Batch.findById(batch._id))!.trainerId).toBeUndefined();
    expect((await login('temp.trainer@campus.com', pw)).status).toBe(401);
    expect(await AuditLog.exists({ action: 'STAFF_DELETED', 'metadata.targetEmail': 'temp.trainer@campus.com' })).toBeTruthy();
  });

  it('admins cannot use this screen to touch admin or student accounts', async () => {
    const adminUser = await User.findOne({ email: 'admin@scholarlogic.edu' });
    expect((await as(admin).post(`/api/admin/staff/${adminUser!._id}/reset-password`)).status).toBe(404);
    const studentUser = await User.findOne({ role: 'STUDENT' });
    expect((await as(admin).put(`/api/admin/staff/${studentUser!._id}`).send({ isActive: false })).status).toBe(404);
  });
});
