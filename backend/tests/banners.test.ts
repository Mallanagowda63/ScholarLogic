import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { Banner } from '../src/models/Banner';

// Runs on the in-memory DB (see vitest.config.ts)
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const PNG2 = Buffer.concat([PNG, Buffer.from('second')]);

describe('Student dashboard banners', () => {
  let admin: string;
  let placement: string;
  let student: string;
  let id: string;

  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;
  const as = (token: string) => ({
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    del: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
  });

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    admin = await login('admin@scholarlogic.edu', 'Admin@123');
    placement = await login('placement@scholarlogic.edu', 'Placement@123');
    student = await login('student@scholarlogic.edu', 'Student@123');
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it('admin adds a banner; the image is stored in the database and served from its URL', async () => {
    const res = await as(admin).post('/api/banners').field('title', 'Ranjith Kumar placed at TCS, 7 LPA').attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    id = res.body.data.banner._id;
    expect(res.body.data.banner.imageUrl).toMatch(new RegExp(`^/api/banners/${id}/image\\?v=\\d+$`));

    const stored = await Banner.findById(id).select('+imageData').lean();
    expect(Buffer.from((stored!.imageData as any).buffer ?? stored!.imageData).equals(PNG)).toBe(true);

    const img = await request(app).get(res.body.data.banner.imageUrl);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(Buffer.from(img.body).equals(PNG)).toBe(true);
  });

  it('the placement team can add banners too; students cannot', async () => {
    const ok = await as(placement).post('/api/banners').field('title', 'Vishal placed at vivo, 4 LPA').attach('image', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    const denied = await as(student).post('/api/banners').field('title', 'x').attach('image', PNG, { filename: 'c.png', contentType: 'image/png' });
    expect(denied.status).toBe(403);
    expect((await as(student).get('/api/banners/manage')).status).toBe(403);
  });

  it('rejects files that are not images, and banners without a title', async () => {
    const pdf = await as(admin).post('/api/banners').field('title', 'x').attach('image', Buffer.from('%PDF'), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(pdf.status).toBe(400);
    const untitled = await as(admin).post('/api/banners').attach('image', PNG, { filename: 'd.png', contentType: 'image/png' });
    expect(untitled.status).toBe(400);
  });

  it('students see only active banners, in order, without the image bytes', async () => {
    const res = await as(student).get('/api/banners');
    expect(res.body.data.banners.map((b: any) => b.title)).toEqual(['Ranjith Kumar placed at TCS, 7 LPA', 'Vishal placed at vivo, 4 LPA']);
    expect(res.body.data.banners[0].imageData).toBeUndefined();
  });

  it('edit: rename, hide, and replace the image (new URL, new bytes)', async () => {
    const before = (await Banner.findById(id).lean())!.imageUrl;
    await new Promise((r) => setTimeout(r, 5));
    const res = await as(admin).put(`/api/banners/${id}`).field('title', 'Ranjith Kumar, TCS, 7 LPA').field('isActive', 'false').attach('image', PNG2, { filename: 'e.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data.banner.imageUrl).not.toBe(before);
    const img = await request(app).get(res.body.data.banner.imageUrl);
    expect(Buffer.from(img.body).equals(PNG2)).toBe(true);
    const visible = await as(student).get('/api/banners');
    expect(visible.body.data.banners.map((b: any) => b.title)).toEqual(['Vishal placed at vivo, 4 LPA']);
  });

  it('reorder changes the order students see', async () => {
    await as(admin).put(`/api/banners/${id}`).field('isActive', 'true');
    const all = (await as(admin).get('/api/banners/manage')).body.data.banners.map((b: any) => b._id);
    await as(admin).put('/api/banners/reorder').send({ ids: [...all].reverse() });
    const res = await as(student).get('/api/banners');
    expect(res.body.data.banners[0].title).toBe('Vishal placed at vivo, 4 LPA');
  });

  it('delete removes the banner and its image from the database', async () => {
    const res = await as(admin).del(`/api/banners/${id}`);
    expect(res.status).toBe(200);
    expect(await Banner.exists({ _id: id })).toBeNull();
    expect((await request(app).get(`/api/banners/${id}/image`)).status).toBe(404);
    expect((await as(admin).del(`/api/banners/${id}`)).status).toBe(404);
  });
});
