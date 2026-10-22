import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { seedTracking } from '../src/scripts/seedTracking';
import { supabaseStorageService } from '../src/services/storage/SupabaseStorageService';
import { Course } from '../src/models/Course';
import { Module } from '../src/models/Module';
import { Student } from '../src/models/Student';
import { User } from '../src/models/User';
import { Batch } from '../src/models/tracking/Batch';
import { StudentBatchAllocation } from '../src/models/tracking/StudentBatchAllocation';

// Runs on the in-memory DB (see vitest.config.ts). Uploads are stubbed so nothing reaches Supabase.
describe('Trainer sends notes to selected batches', () => {
  let trainerToken: string;
  let studentToken: string;
  let courseId: string;
  let moduleId: string;
  let b01: any;
  let b02: any;
  let otherTrainersBatch: any;
  let studentDocId: any;

  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;
  const asTrainer = (method: 'get' | 'post', url: string) => (request(app) as any)[method](url).set('Authorization', `Bearer ${trainerToken}`);
  const asStudent = (url: string) => request(app).get(url).set('Authorization', `Bearer ${studentToken}`);
  const lessonTitles = (res: any) => (res.body.data.modules || []).flatMap((m: any) => m.lessons.map((l: any) => l.title));

  const uploadNotes = async (title: string, batchIds?: string[]) => {
    const created = await asTrainer('post', `/api/trainer/modules/${moduleId}/lessons`).send({ courseId, title, type: 'NOTES' });
    const lessonId = created.body.data.lesson._id;
    const res = await asTrainer('post', `/api/trainer/lessons/${lessonId}/media`).send({
      type: 'NOTES',
      fileBuffer: Buffer.from('%PDF-1.4 notes').toString('base64'),
      fileName: `${title}.pdf`,
      mimeType: 'application/pdf',
      ...(batchIds ? { batchIds } : {}),
    });
    return { lessonId, res };
  };

  beforeAll(async () => {
    vi.spyOn(supabaseStorageService, 'uploadFile').mockImplementation(async (bucket: any, filePath: string) => ({
      bucket,
      storagePath: filePath,
      publicUrl: `https://test.local/${bucket}/${filePath}`,
    }) as any);
    await connectDB();
    await seedDatabase();
    await seedTracking(); // PY-B01 and PY-B02, both run by the seeded trainer
    trainerToken = await login('trainer@scholarlogic.edu', 'Trainer@123');
    studentToken = await login('student@scholarlogic.edu', 'Student@123');

    const course = await Course.findOne({ title: 'Python Full Stack Development' });
    courseId = String(course!._id);
    moduleId = String((await Module.findOne({ courseId: course!._id }))!._id);
    b01 = await Batch.findOne({ batchCode: 'PY-B01' });
    b02 = await Batch.findOne({ batchCode: 'PY-B02' });
    const otherTrainer = await User.create({ email: 'other.trainer@test.local', passwordHash: 'x', fullName: 'Other Trainer', role: 'TRAINER' });
    otherTrainersBatch = await Batch.create({
      batchCode: 'PY-B99',
      subjectId: b01.subjectId,
      trainerId: otherTrainer._id,
      timing: '6-7 PM',
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 30 * 86400000),
    });

    const studentUser = await User.findOne({ email: 'student@scholarlogic.edu' });
    studentDocId = (await Student.findOne({ userId: studentUser!._id }))!._id;
    await StudentBatchAllocation.deleteMany({ studentId: studentDocId });
    await StudentBatchAllocation.create({ studentId: studentDocId, batchId: b01._id, subjectId: b01.subjectId, startDate: new Date() });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await disconnectDB();
  });

  it('trainer sees their own batches to choose from', async () => {
    const res = await asTrainer('get', '/api/tracking/trainer/batches');
    const codes = res.body.data.batches.map((b: any) => b.batchCode);
    expect(codes).toEqual(expect.arrayContaining(['PY-B01', 'PY-B02']));
    expect(codes).not.toContain('PY-B99');
  });

  it('notes sent to B01 reach a B01 student but not a B02-only student or a visitor', async () => {
    const { res } = await uploadNotes('B01 Notes', [String(b01._id)]);
    expect(res.status).toBe(200);
    expect(res.body.data.lesson.batchIds.map(String)).toEqual([String(b01._id)]);

    expect(lessonTitles(await asStudent(`/api/courses/${courseId}`))).toContain('B01 Notes');
    const progress = await asStudent(`/api/students/courses/${courseId}/progress`);
    expect(JSON.stringify(progress.body)).toContain('B01 Notes');
    expect(lessonTitles(await request(app).get(`/api/courses/${courseId}`))).not.toContain('B01 Notes');

    // Same student, now only ever in B02
    await StudentBatchAllocation.deleteMany({ studentId: studentDocId });
    await StudentBatchAllocation.create({ studentId: studentDocId, batchId: b02._id, subjectId: b02.subjectId, startDate: new Date() });
    expect(lessonTitles(await asStudent(`/api/courses/${courseId}`))).not.toContain('B01 Notes');
    expect(JSON.stringify((await asStudent(`/api/students/courses/${courseId}/progress`)).body)).not.toContain('B01 Notes');
  });

  it('a student who moved on from a batch keeps that batch’s notes', async () => {
    await StudentBatchAllocation.create({ studentId: studentDocId, batchId: b01._id, subjectId: b01.subjectId, startDate: new Date(), status: 'MOVED' });
    expect(lessonTitles(await asStudent(`/api/courses/${courseId}`))).toContain('B01 Notes');
  });

  it('"Whole course" (empty list) is visible to everyone', async () => {
    const { res } = await uploadNotes('Course Notes', []);
    expect(res.status).toBe(200);
    expect(lessonTitles(await asStudent(`/api/courses/${courseId}`))).toContain('Course Notes');
    expect(lessonTitles(await request(app).get(`/api/courses/${courseId}`))).toContain('Course Notes');
  });

  it('trainer sees every lesson with the batches it was sent to', async () => {
    const res = await asTrainer('get', `/api/courses/${courseId}`);
    const lesson = res.body.data.modules.flatMap((m: any) => m.lessons).find((l: any) => l.title === 'B01 Notes');
    expect(lesson.batchIds.map(String)).toEqual([String(b01._id)]);
  });

  it('a trainer cannot send notes to another trainer’s batch', async () => {
    const { res } = await uploadNotes('Sneaky Notes', [String(b01._id), String(otherTrainersBatch._id)]);
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('PY-B99');
  });

  it('rejects malformed batch IDs', async () => {
    const { res } = await uploadNotes('Bad Notes', ['not-an-id']);
    expect(res.status).toBe(400);
  });
});
