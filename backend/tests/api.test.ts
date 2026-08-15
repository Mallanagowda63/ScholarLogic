import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';

describe('ScholarLogic End-to-End API Test Suite', () => {
  let studentToken: string;
  let adminToken: string;
  let studentMongoId: string;

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('1. Central Auth — Login as Student', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'student@scholarlogic.edu',
        password: 'Student@123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('STUDENT');
    expect(res.body.data.user.studentId).toMatch(/^SL-2026-\d{5}$/);
    studentToken = res.body.data.tokens.accessToken;
  });

  it('2. Central Auth — Register New Student & Generate Unique Student ID', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'newstudent@scholarlogic.edu',
        password: 'StudentPass@123',
        fullName: 'Jane Doe',
        college: 'ScholarLogic Academy',
        degree: 'B.Tech',
        branch: 'Computer Science',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.studentId).toBe('SL-2026-00002');
  });

  it('3. Student Dashboard API — Returns Real Data & Student ID', async () => {
    const res = await request(app)
      .get('/api/students/dashboard')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.student.studentId).toBe('SL-2026-00001');
    expect(res.body.data.metrics.atsScore).toBeDefined();
  });

  it('4. LMS Module — Fetch Courses List (4 Seeded Initial Courses)', async () => {
    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.courses.length).toBeGreaterThanOrEqual(4);
  });

  it('5. Exam Module — Get Assessment Exams List', async () => {
    const res = await request(app)
      .get('/api/exams')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.exams.length).toBeGreaterThan(0);
  });

  it('6. AI Resume Builder — Run Resume ATS Analysis', async () => {
    const res = await request(app)
      .post('/api/resumes/analyze')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        resumeText: 'Experienced Python developer proficient in React, Express, MongoDB, REST APIs, and SQL.',
        jobDescriptionText: 'Looking for a Python Full Stack Engineer with expertise in React, Node.js, and Cloud APIs.',
        jobTitle: 'Python Engineer',
        companyName: 'Tech Corp',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.analysis.atsScore).toBeGreaterThan(50);
    expect(res.body.data.analysis.breakdown).toBeDefined();
  });

  it('7. Placement Portal — Fetch Open Jobs with Dynamic Skill Match %', async () => {
    const res = await request(app)
      .get('/api/placements/jobs')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobs.length).toBeGreaterThan(0);
    expect(res.body.data.jobs[0].matchScore).toBeGreaterThan(0);
  });

  it('8. Certificate Portal — Public Verification Endpoint works without Auth', async () => {
    const res = await request(app)
      .get('/api/certificates/verify/CERT-2026-INVALID');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('INVALID_CERTIFICATE');
  });

  it('9. RBAC Enforcement — Block Student from Creating Admin Job', async () => {
    const res = await request(app)
      .post('/api/placements/jobs')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ title: 'Unauthorized Job' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});
