import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { seedTracking } from '../src/scripts/seedTracking';
import { normalizePhone } from '../src/services/googleFormService';
import { courseLetters, generateStudentId } from '../src/services/studentAccountService';

// Runs on the in-memory DB (see vitest.config.ts). Secret = 'test-form-secret'.
const SECRET = 'test-form-secret';

// Mirrors what the Apps Script sends for the live form (note the two questions titled "Course")
const formPayload = (overrides: Record<string, any> = {}, answerOverrides: Record<string, string> = {}) => {
  const answers: Record<string, string> = {
    Name: 'Test Student',
    Email: 'test@student.com',
    Address: 'Bengaluru',
    'Phone number': '9812345670',
    'Course#1': 'Online',
    'Preferred Timing': '07:00:00',
    'Joining Month / Joining Date': '2026-10-05',
    'Course#2': 'Data Analytics',
    'Preferred Time': '7:00–8:00 AM',
    ...answerOverrides,
  };
  return {
    submissionId: `sheet:row-${Math.random().toString(36).slice(2)}`,
    submittedAt: '2026-09-28T09:30:00.000Z',
    answers: Object.entries(answers).map(([q, a]) => ({ question: q.replace(/#\d$/, ''), answer: a })),
    ...overrides,
  };
};

const send = (body: any, secret = SECRET) =>
  request(app).post('/api/integrations/google-form/student').set('X-ScholarLogic-Secret', secret).send(body);

describe('Google Form → ScholarLogic intake', () => {
  let adminToken: string;

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    await seedTracking(); // Data Analytics course (code DA)
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@scholarlogic.edu', password: 'Admin@123' });
    adminToken = login.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await disconnectDB();
  });

  const admin = (method: 'get' | 'post' | 'put', url: string) => (request(app) as any)[method](url).set('Authorization', `Bearer ${adminToken}`);
  const findReg = async (name: string) => {
    const res = await admin('get', '/api/tracking/registrations');
    return res.body.data.registrations.filter((r: any) => r.fullName === name);
  };

  it('auto Student ID = FIRSTNAME-CC-NN and counts up for the same name and course', async () => {
    expect(courseLetters('Data Analytics')).toBe('DA');
    expect(courseLetters('Cloud Computing')).toBe('CC');
    expect(courseLetters('Python Full Stack')).toBe('PF');
    const course = { name: 'Data Analytics', code: 'DA' };
    expect(await generateStudentId('Mohit Sharma', course)).toBe('MOHIT-DA-01');
    const res = await admin('post', '/api/tracking/students').send({ fullName: 'Mohit Sharma', phone: '9000000201', password: 'Welcome@1', courseId: (await admin('get', '/api/tracking/courses')).body.data.courses.find((c: any) => c.code === 'DA')._id });
    expect(res.body.data.student.studentId).toBe('MOHIT-DA-01');
    expect(await generateStudentId('Mohit Kumar', course)).toBe('MOHIT-DA-02');
  });

  it('normalises Indian phone formats', () => {
    for (const p of ['+91 98765 43210', '9876543210', '91-9876543210', '098765 43210']) expect(normalizePhone(p)).toBe('9876543210');
  });

  it('rejects requests without the correct secret', async () => {
    expect((await send(formPayload(), 'wrong')).status).toBe(401);
    expect((await request(app).post('/api/integrations/google-form/student').send(formPayload())).status).toBe(401);
  });

  it('CASE 1 + 4 + 5: new submission becomes a pending registration with mapped course, mode and timing preference', async () => {
    const res = await send(formPayload());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PROCESSED');
    const [reg] = await findReg('Test Student');
    expect(reg.verificationStatus).toBe('PENDING');
    expect(reg.allocationStatus).toBe('WAITING_FOR_ALLOCATION');
    expect(reg.source).toBe('GOOGLE_FORM');
    expect(reg.courseId?.code).toBe('DA'); // "Data Analytics" from the second "Course" question
    expect(reg.preferredMode).toBe('ONLINE'); // "Online" from the first "Course" question
    expect(reg.preferredTiming).toBe('7:00–8:00 AM'); // dropdown range preferred over the time picker
    expect(reg.phoneNormalized).toBe('9812345670');
    expect(new Date(reg.submittedAt).toISOString()).toBe('2026-09-28T09:30:00.000Z');
  });

  it('CASE 2: same phone in another format does not create a duplicate', async () => {
    const res = await send(formPayload({}, { 'Phone number': '+91 98123-45670', Address: 'Mysuru' }));
    expect(res.body.data.status).toBe('DUPLICATE');
    const regs = await findReg('Test Student');
    expect(regs).toHaveLength(1);
    expect(regs[0].submissionCount).toBe(2);
    expect(regs[0].address).toBe('Mysuru'); // latest answers win while still pending
  });

  it('re-sending the same submissionId is idempotent', async () => {
    const body = formPayload({}, { Name: 'Retry Student', Email: 'retry@student.com', 'Phone number': '9000000001' });
    await send(body);
    const again = await send(body);
    expect(again.body.data.alreadyReceived).toBe(true);
    const regs = await findReg('Retry Student');
    expect(regs).toHaveLength(1);
    expect(regs[0].submissionCount).toBe(1);
  });

  it('a time-picker answer stored as a date ("1899-12-30") does not replace the chosen timing', async () => {
    await send(
      formPayload({}, { Name: 'Timing Student', Email: 'timing@student.com', 'Phone number': '9000000005', 'Preferred Timing': '1899-12-30', 'Preferred Time': '10:00–11:00 AM' })
    );
    const [reg] = await findReg('Timing Student');
    expect(reg.preferredTiming).toBe('10:00–11:00 AM');
  });

  it('CASE 3: empty email still creates a registration', async () => {
    const res = await send(formPayload({}, { Name: 'No Email Student', Email: '', 'Phone number': '9000000002' }));
    expect(res.body.data.status).toBe('PROCESSED');
    expect(await findReg('No Email Student')).toHaveLength(1);
  });

  it('CASE 5: course spelling/case variants map to the same course', async () => {
    await send(formPayload({}, { Name: 'Spelling Student', Email: 'spell@student.com', 'Phone number': '9000000003', 'Course#2': 'data  ANALYST' }));
    const [reg] = await findReg('Spelling Student');
    expect(reg.courseId?.code).toBe('DA');
  });

  it('CASE 6: unprocessable response is stored as FAILED and can be retried', async () => {
    const res = await send(formPayload({}, { Name: '', Email: 'broken@student.com', 'Phone number': '9000000004' }));
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe('FAILED');
    const failed = await admin('get', '/api/tracking/registrations/submissions?status=FAILED');
    const sub = failed.body.data.submissions.find((s: any) => s.rawPayload.answers.some((a: any) => a.answer === 'broken@student.com'));
    expect(sub.errorMessage).toMatch(/name/i);
    const retry = await admin('post', `/api/tracking/registrations/submissions/${sub._id}/retry`);
    expect(retry.body.data.status).toBe('FAILED'); // still invalid, but nothing was lost
  });

  it('CASE 7: admin verifies → Student ID generated, student joins normal workflow, batch allocation works', async () => {
    const [reg] = await findReg('Test Student');
    const detail = await admin('get', `/api/tracking/registrations/${reg._id}`);
    expect(detail.body.data.suggestedStudentId).toBe('TEST-DA-01'); // first name + course letters + 2 digits

    const verify = await admin('post', `/api/tracking/registrations/${reg._id}/verify`).send({ password: 'Welcome@123' });
    expect(verify.status).toBe(201);
    const { _id: studentMongoId, studentId } = verify.body.data.student;
    expect(studentId).toBe(detail.body.data.suggestedStudentId);

    const students = await admin('get', '/api/tracking/students');
    const s = students.body.data.students.find((x: any) => x._id === studentMongoId);
    expect(s.registrationSource).toBe('GOOGLE_FORM');
    expect(s.course.code).toBe('DA');
    expect(s.mode).toBe('ONLINE');
    expect(s.preferredTiming).toBe('7:00–8:00 AM');
    expect(s.currentBatch).toBeNull(); // timing is only a preference — no auto-allocation

    const batches = await admin('get', '/api/tracking/batches');
    const py = batches.body.data.batches.find((b: any) => b.batchCode === 'PY-B01');
    expect((await admin('post', `/api/tracking/students/${studentMongoId}/allocate`).send({ batchId: py._id })).status).toBe(201);
    const [after] = await findReg('Test Student');
    expect(after.status).toBe('ALLOCATED');

    // The new student can log in with Student ID + password
    const login = await request(app).post('/api/auth/login').send({ email: studentId, password: 'Welcome@123' });
    expect(login.status).toBe(200);

    // A later form submission from the same phone is linked to the existing student, not a new registration
    const again = await send(formPayload({}, { 'Phone number': '98123 45670' }));
    expect(again.body.data.status).toBe('DUPLICATE');
    expect(again.body.data.note).toContain(studentId);
    expect(await findReg('Test Student')).toHaveLength(1);
  });

  it('Sync button pulls responses from the Apps Script web app and skips ones already imported', async () => {
    const fromSheet = [
      formPayload({ submissionId: 'sheet:1:10:111' }, { Name: 'Sheet Student One', Email: 'one@sheet.com', 'Phone number': '9000000101' }),
      formPayload({ submissionId: 'sheet:1:11:222' }, { Name: 'Sheet Student Two', Email: '', 'Phone number': '9000000102', 'Course#2': 'Cloud Computing' }),
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any, init: any) => {
      const sent = JSON.parse(init.body);
      const ok = sent.secret === 'test-form-secret';
      return new Response(JSON.stringify(ok ? { success: true, count: fromSheet.length, responses: fromSheet } : { success: false, message: 'Invalid secret' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    try {
      const first = await admin('post', '/api/tracking/registrations/sync');
      expect(first.status).toBe(200);
      expect(first.body.data.created).toBe(2);
      expect(fetchSpy.mock.calls[0][0]).toBe('https://script.google.com/macros/s/test-deployment/exec');
      expect(await findReg('Sheet Student One')).toHaveLength(1);
      expect(await findReg('Sheet Student Two')).toHaveLength(1);

      // Clicking again imports nothing new
      const second = await admin('post', '/api/tracking/registrations/sync');
      expect(second.body.data.created).toBe(0);
      expect(second.body.data.alreadyImported).toBe(2);
      expect(await findReg('Sheet Student One')).toHaveLength(1);

      const status = await admin('get', '/api/tracking/registrations/sync-status');
      expect(status.body.data.configured).toBe(true);
      expect(status.body.data.lastSync.ok).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('Sync reports a clear error when Google returns a login page instead of data', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('<!DOCTYPE html><html>Sign in</html>', { status: 200 }));
    try {
      const res = await admin('post', '/api/tracking/registrations/sync');
      expect(res.status).toBe(502);
      expect(res.body.message).toMatch(/Anyone/);
      expect(fetchSpy).toHaveBeenCalledTimes(4); // retried before giving up
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('Sync retries when Google intermittently returns "Page not found"', async () => {
    let calls = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      calls += 1;
      if (calls === 1) return new Response('<!DOCTYPE html><title>Page not found</title>', { status: 404 });
      return new Response(JSON.stringify({ success: true, count: 0, responses: [] }), { status: 200 });
    });
    try {
      const res = await admin('post', '/api/tracking/registrations/sync');
      expect(res.status).toBe(200);
      expect(calls).toBe(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('admin can reject a registration with a reason', async () => {
    const [reg] = await findReg('Spelling Student');
    const res = await admin('post', `/api/tracking/registrations/${reg._id}/reject`).send({ reason: 'Duplicate enquiry' });
    expect(res.status).toBe(200);
    const [after] = await findReg('Spelling Student');
    expect(after.verificationStatus).toBe('REJECTED');
  });
});
