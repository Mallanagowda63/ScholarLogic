import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { seedTracking } from '../src/scripts/seedTracking';
import { Student } from '../src/models/Student';
import { User } from '../src/models/User';
import { Notification } from '../src/models/Notification';
import { Batch } from '../src/models/tracking/Batch';
import { StudentBatchAllocation } from '../src/models/tracking/StudentBatchAllocation';

// Runs on the in-memory DB (see vitest.config.ts)
describe('One recordings link per batch', () => {
  let trainer: string;
  let student: string;
  let b01: any;
  let otherBatch: any;
  let studentUserId: any;
  const ZOHO = 'https://workdrive.zoho.in/folder/abc123';

  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;
  const setLink = (batchId: string, recordingsLink: string, token = trainer) =>
    request(app).put(`/api/tracking/batches/${batchId}/recordings-link`).set('Authorization', `Bearer ${token}`).send({ recordingsLink });

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    await seedTracking();
    trainer = await login('trainer@scholarlogic.edu', 'Trainer@123');
    student = await login('student@scholarlogic.edu', 'Student@123');
    b01 = await Batch.findOne({ batchCode: 'PY-B01' });
    const otherTrainer = await User.create({ email: 'rec.trainer@test.local', passwordHash: 'x', fullName: 'Other Trainer', role: 'TRAINER' });
    otherBatch = await Batch.create({
      batchCode: 'PY-B98',
      subjectId: b01.subjectId,
      trainerId: otherTrainer._id,
      timing: '6-7 PM',
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 30 * 86400000),
    });
    const u = await User.findOne({ email: 'student@scholarlogic.edu' });
    studentUserId = u!._id;
    const studentDocId = (await Student.findOne({ userId: u!._id }))!._id;
    await StudentBatchAllocation.deleteMany({ studentId: studentDocId });
    await StudentBatchAllocation.create({ studentId: studentDocId, batchId: b01._id, subjectId: b01.subjectId, startDate: new Date() });
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it("a trainer can't set the link on someone else's batch, and bad links are refused", async () => {
    expect((await setLink(String(otherBatch._id), ZOHO)).status).toBe(403);
    expect((await setLink(String(b01._id), 'not a link')).status).toBe(400);
    expect((await setLink(String(b01._id), ZOHO, student)).status).toBe(403);
  });

  it('the trainer saves the Zoho link once; the batch students are told and see it', async () => {
    const res = await setLink(String(b01._id), ZOHO);
    expect(res.status).toBe(200);
    expect(res.body.data.notified).toBeGreaterThanOrEqual(1);
    expect(await Notification.countDocuments({ userId: studentUserId, title: 'Class recordings link added' })).toBe(1);

    const detail = await request(app).get(`/api/tracking/batches/${b01._id}`).set('Authorization', `Bearer ${trainer}`);
    expect(detail.body.data.batch.recordingsLink).toBe(ZOHO);

    const mine = await request(app).get('/api/tracking/me/recordings').set('Authorization', `Bearer ${student}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.recordings).toHaveLength(1);
    expect(mine.body.data.recordings[0]).toMatchObject({ batchCode: 'PY-B01', recordingsLink: ZOHO, current: true });

    // Saving the same link again doesn't notify again
    await setLink(String(b01._id), ZOHO);
    expect(await Notification.countDocuments({ userId: studentUserId, title: { $regex: /^Class recordings link/ } })).toBe(1);
  });

  it('an empty link removes it', async () => {
    expect((await setLink(String(b01._id), '')).body.data.recordingsLink).toBe('');
    const mine = await request(app).get('/api/tracking/me/recordings').set('Authorization', `Bearer ${student}`);
    expect(mine.body.data.recordings[0].recordingsLink).toBe('');
  });
});
