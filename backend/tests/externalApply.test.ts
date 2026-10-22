import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';
import { Job } from '../src/models/Job';
import { Application } from '../src/models/Application';

// Runs on the in-memory DB (see vitest.config.ts)
describe('Apply on the company website', () => {
  let placement: string;
  let student: string;
  let job: any;
  let otherJob: any;

  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;
  const as = (token: string) => ({
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
  });

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    placement = await login('placement@scholarlogic.edu', 'Placement@123');
    student = await login('student@scholarlogic.edu', 'Student@123');
    const open = await Job.find({ status: 'OPEN', deadline: { $gt: new Date() } }).limit(2);
    [job, otherJob] = open;
    await Application.deleteMany({ jobId: { $in: open.map((j) => j._id) } });
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it('placement team adds the company link to a job; unsafe links are refused', async () => {
    const bad = await as(placement).put(`/api/placements/jobs/${job._id}`).send({ applyUrl: 'javascript:alert(1)' });
    expect(bad.status).toBe(400);
    const ok = await as(placement).put(`/api/placements/jobs/${job._id}`).send({ applyUrl: 'careers.example.com/jobs/42' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.job.applyUrl).toBe('https://careers.example.com/jobs/42');
    const denied = await as(student).put(`/api/placements/jobs/${job._id}`).send({ applyUrl: 'https://evil.example' });
    expect(denied.status).toBe(403);
  });

  it('a job can also be published with the link', async () => {
    const companyId = String(job.companyId);
    const res = await as(placement)
      .post('/api/placements/jobs')
      .send({ title: 'Data Analyst', companyId, description: 'Role', location: 'Bangalore', salaryPackage: '4 LPA', applyUrl: 'https://jobs.example.com/da' });
    expect(res.status).toBe(201);
    expect(res.body.data.job.applyUrl).toBe('https://jobs.example.com/da');
  });

  it('a typed company name adds a new company once, and reuses it after that (any letter case)', async () => {
    const base = { title: 'System Engineer', description: 'Role', location: 'Chennai', salaryPackage: '7 LPA' };
    const first = await as(placement).post('/api/placements/jobs').send({ ...base, companyName: 'Tata Consultancy Services' });
    expect(first.status).toBe(201);
    const second = await as(placement).post('/api/placements/jobs').send({ ...base, companyName: 'tata consultancy services' });
    expect(second.status).toBe(201);
    expect(String(second.body.data.job.companyId)).toBe(String(first.body.data.job.companyId));
    const companies = (await as(placement).get('/api/placements/companies')).body.data.companies;
    expect(companies.filter((c: any) => c.name.toLowerCase() === 'tata consultancy services')).toHaveLength(1);
    const missing = await as(placement).post('/api/placements/jobs').send({ ...base });
    expect(missing.status).toBe(400);
  });

  it('student clicks Apply: the application is recorded once and the company link comes back', async () => {
    const first = await as(student).post(`/api/placements/jobs/${job._id}/apply-external`);
    expect(first.status).toBe(201);
    expect(first.body.data.applyUrl).toBe('https://careers.example.com/jobs/42');
    const again = await as(student).post(`/api/placements/jobs/${job._id}/apply-external`);
    expect(again.status).toBe(200);
    expect(again.body.data.alreadyApplied).toBe(true);
    expect(await Application.countDocuments({ jobId: job._id })).toBe(1);

    const jobs = await as(student).get('/api/placements/jobs');
    const listed = jobs.body.data.jobs.find((j: any) => String(j._id) === String(job._id));
    expect(listed.appliedStatus).toBe('APPLIED');
    expect(listed.applyUrl).toBe('https://careers.example.com/jobs/42');
  });

  it('a job without a company link cannot be applied to this way', async () => {
    await Job.updateOne({ _id: otherJob._id }, { $set: { applyUrl: '' } });
    const res = await as(student).post(`/api/placements/jobs/${otherJob._id}/apply-external`);
    expect(res.status).toBe(400);
  });

  it("the placement team's Applications list shows the student's name and that they applied on the company site", async () => {
    const res = await as(placement).get('/api/placements/applications/all');
    expect(res.status).toBe(200);
    const row = res.body.data.applications.find((a: any) => String(a.job?._id) === String(job._id));
    expect(row.student.fullName).toBe('Alex Morgan');
    expect(row.student.studentId).toBe('SL-2026-00001');
    expect(row.appliedVia).toBe('COMPANY_SITE');
    expect(row.status).toBe('APPLIED');
    expect((await as(student).get('/api/placements/applications/all')).status).toBe(403);
  });

  it('the CSV export includes how they applied', async () => {
    const res = await as(placement).get('/api/placements/applications/export');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Applied Via');
    expect(res.text).toContain('Company website');
  });
});
