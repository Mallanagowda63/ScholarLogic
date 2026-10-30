import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import * as XLSX from 'xlsx';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/db';
import { seedDatabase } from '../src/scripts/seed';

// Runs on the in-memory DB (see vitest.config.ts)
describe('Trainer tests: MCQ from Excel, technical test as a link', () => {
  let trainer: string;
  let student: string;

  const login = async (email: string, password: string) =>
    (await request(app).post('/api/auth/login').send({ email, password })).body.data.tokens.accessToken;
  const sheet = (rows: unknown[][]) => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Question', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Correct Answer'], ...rows]), 'Questions');
    return (XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer).toString('base64');
  };
  const rowsOf = (n: number) => Array.from({ length: n }, (_, i) => [`Question ${i + 1}?`, 'A1', 'B2', 'C3', 'D4', (i % 4) + 1]);
  const post = (url: string, body: any, token = trainer) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    await connectDB();
    await seedDatabase();
    trainer = await login('trainer@scholarlogic.edu', 'Trainer@123');
    student = await login('student@scholarlogic.edu', 'Student@123');
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it('the template downloads as an Excel file with the right columns', async () => {
    const res = await request(app).get('/api/exams/excel/template').set('Authorization', `Bearer ${trainer}`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    const book = XLSX.read(res.body, { type: 'buffer' });
    expect(XLSX.utils.sheet_to_json(book.Sheets.Questions, { header: 1 })[0]).toEqual(['Question', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Correct Answer']);
  });

  it('preview points at the wrong rows; such a sheet is not published', async () => {
    const bad = sheet([['Ok?', 'a', 'b', 'c', 'd', 2], ['No options?', 'a', '', 'c', 'd', 1], ['Bad answer?', 'a', 'b', 'c', 'd', 7]]);
    const prev = await post('/api/exams/excel/preview', { fileBase64: bad });
    expect(prev.body.data.count).toBe(1);
    expect(prev.body.data.errors).toEqual([expect.stringContaining('Row 3'), expect.stringContaining('Row 4')]);
    expect((await post('/api/exams/excel', { title: 'Bad', fileBase64: bad })).status).toBe(400);
  });

  it('500 questions are published in the same order with the right answers; 501 is refused', async () => {
    const res = await post('/api/exams/excel', { title: 'Python MCQ', fileBase64: sheet(rowsOf(500)), durationMinutes: 90, marksPerQuestion: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.exam.questionIds).toHaveLength(500);
    expect(res.body.data.exam.totalMarks).toBe(500);

    const started = await post(`/api/exams/${res.body.data.exam._id}/start`, {}, student);
    expect(started.status).toBe(200);
    const qs = started.body.data.questions;
    expect(qs.map((q: any) => q.questionText).slice(0, 3)).toEqual(['Question 1?', 'Question 2?', 'Question 3?']);
    expect(qs[499].questionText).toBe('Question 500?');
    expect(qs[0].correctAnswer).toBeUndefined();

    const details = await request(app).get(`/api/exams/${res.body.data.exam._id}`).set('Authorization', `Bearer ${student}`);
    expect(details.body.data.exam.questionIds[0].correctAnswer).toBeUndefined();

    expect((await post('/api/exams/excel', { title: 'Too many', fileBase64: sheet(rowsOf(501)) })).status).toBe(400);
    expect((await post('/api/exams/excel', { title: 'Student', fileBase64: sheet(rowsOf(2)) }, student)).status).toBe(403);
  });

  it('a technical test link is published and cannot be started inside the LMS', async () => {
    expect((await post('/api/exams/link', { title: 'DSA round', testLink: 'not a link' })).status).toBe(400);
    const res = await post('/api/exams/link', { title: 'DSA round', testLink: 'hackerrank.com/test/abc' });
    expect(res.status).toBe(201);
    expect(res.body.data.exam).toMatchObject({ kind: 'LINK', testLink: 'https://hackerrank.com/test/abc' });
    const list = await request(app).get('/api/exams').set('Authorization', `Bearer ${student}`);
    expect(list.body.data.exams.find((e: any) => e.title === 'DSA round').testLink).toBe('https://hackerrank.com/test/abc');
    expect((await post(`/api/exams/${res.body.data.exam._id}/start`, {}, student)).status).toBe(400);
  });
});
