import { Response } from 'express';
import * as XLSX from 'xlsx';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { Exam } from '../models/Exam';
import { Question } from '../models/Question';
import { ExamAttempt } from '../models/ExamAttempt';
import { Result } from '../models/Result';
import { ProctoringLog } from '../models/ProctoringLog';
import { AuditLog } from '../models/AuditLog';
import mongoose from 'mongoose';

/**
 * Trainer tests made the quick way:
 *  - MCQ test from an Excel sheet (Question, Option 1-4, Correct Answer), up to 500 questions, kept in sheet order
 *  - Technical test given as a link (HackerRank, Google Form, ...): students just open it
 */
export const MAX_EXCEL_QUESTIONS = 500;
const HEADERS = ['Question', 'Option 1', 'Option 2', 'Option 3', 'Option 4', 'Correct Answer'];

export const downloadMcqTemplate = async (_req: AuthRequest, res: Response): Promise<void> => {
  const sheet = XLSX.utils.aoa_to_sheet([
    HEADERS,
    ['Which keyword defines a function in Python?', 'func', 'def', 'function', 'lambda', 2],
    ['What does HTML stand for?', 'Hyper Text Markup Language', 'High Text Machine Language', 'Hyperlink Tool Markup Language', 'Home Tool Markup Language', 1],
  ]);
  sheet['!cols'] = [{ wch: 60 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 28 }, { wch: 16 }];
  const help = XLSX.utils.aoa_to_sheet([
    ['How to fill the Questions sheet'],
    ['One question per row, up to 500 rows. Students get them in the same order.'],
    ['Correct Answer: the option number 1, 2, 3 or 4 (A, B, C, D also works).'],
    ['Keep the first row (the column names) as it is. Delete the two example rows.'],
  ]);
  help['!cols'] = [{ wch: 90 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Questions');
  XLSX.utils.book_append_sheet(book, help, 'How to fill');
  const buf = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="ScholarLogic-MCQ-test-format.xlsx"');
  res.send(buf);
};

interface ParsedQuestion {
  row: number;
  question: string;
  options: string[];
  correct: number; // 0-based
}

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const key = (v: unknown) => norm(v).toLowerCase().replace(/[^a-z0-9]/g, '');

// Reads the sheet, finding the columns by name so extra columns or a different order still work
export function parseMcqSheet(buffer: Buffer): { questions: ParsedQuestion[]; errors: string[] } {
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new AppError('This file could not be read. Upload the Excel (.xlsx) or CSV file made from the template.', 400, 'INVALID_FILE');
  }
  const sheetName = book.SheetNames.find((n) => /question/i.test(n)) || book.SheetNames[0];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, blankrows: false, defval: '' });
  const headerIndex = rows.findIndex((r) => r.some((c) => key(c).startsWith('question')));
  if (headerIndex < 0) throw new AppError('No "Question" column found. Use the template: Question, Option 1, Option 2, Option 3, Option 4, Correct Answer.', 400, 'INVALID_FORMAT');
  const header = rows[headerIndex].map(key);
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const qCol = header.findIndex((h) => h.startsWith('question'));
  const optCols = [
    col('option1', 'optiona', 'a', 'opt1', '1'),
    col('option2', 'optionb', 'b', 'opt2', '2'),
    col('option3', 'optionc', 'c', 'opt3', '3'),
    col('option4', 'optiond', 'd', 'opt4', '4'),
  ];
  const ansCol = col('correctanswer', 'answer', 'correct', 'correctoption', 'ans', 'key');
  if (optCols.some((c) => c < 0) || ansCol < 0) {
    throw new AppError('Columns missing. The sheet needs: Question, Option 1, Option 2, Option 3, Option 4, Correct Answer.', 400, 'INVALID_FORMAT');
  }

  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];
  rows.slice(headerIndex + 1).forEach((r, i) => {
    const row = headerIndex + i + 2; // the row number people see in Excel
    const question = norm(r[qCol]);
    const options = optCols.map((c) => norm(r[c]));
    const answer = norm(r[ansCol]);
    if (!question && options.every((o) => !o) && !answer) return; // empty row
    if (!question) return void errors.push(`Row ${row}: the question is empty`);
    if (options.some((o) => !o)) return void errors.push(`Row ${row}: all 4 options are needed`);
    let correct = -1;
    const m = answer.match(/^(?:option\s*)?([1-4a-d])$/i);
    if (m) correct = /\d/.test(m[1]) ? Number(m[1]) - 1 : m[1].toLowerCase().charCodeAt(0) - 97;
    else if (answer) correct = options.findIndex((o) => o.toLowerCase() === answer.toLowerCase());
    if (correct < 0) return void errors.push(`Row ${row}: Correct Answer must be 1, 2, 3 or 4 (found "${answer || 'empty'}")`);
    questions.push({ row, question, options, correct });
  });
  if (questions.length > MAX_EXCEL_QUESTIONS) errors.unshift(`The sheet has ${questions.length} questions; the limit is ${MAX_EXCEL_QUESTIONS}.`);
  if (!questions.length && !errors.length) errors.push('The sheet has no questions.');
  return { questions, errors };
}

const readUpload = (body: any) => {
  const raw = String(body?.fileBase64 || '');
  if (!raw) throw new AppError('Choose the Excel file to upload', 400, 'MISSING_FILE');
  return Buffer.from(raw.replace(/^data:[^,]*,/, ''), 'base64');
};

// Check the sheet first (no saving): how many questions, and which rows have problems
export const previewMcqExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  const { questions, errors } = parseMcqSheet(readUpload(req.body));
  res.json({
    success: true,
    data: { count: questions.length, errors, sample: questions.slice(0, 5).map(({ question, options, correct }) => ({ question, options, correct })) },
  });
};

export const createMcqTestFromExcel = async (req: AuthRequest, res: Response): Promise<void> => {
  const title = norm(req.body?.title);
  if (!title) throw new AppError('Give the test a name', 400, 'MISSING_FIELDS');
  const { questions, errors } = parseMcqSheet(readUpload(req.body));
  if (errors.length) throw new AppError(`Fix the sheet first: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? ` (+${errors.length - 5} more)` : ''}`, 400, 'INVALID_ROWS');

  const marksEach = Math.max(0.25, Number(req.body?.marksPerQuestion) || 1);
  const totalMarks = Math.round(questions.length * marksEach * 100) / 100;
  const passPct = Math.min(100, Math.max(0, Number(req.body?.passPercentage ?? 40)));
  const durationMinutes = Math.min(600, Math.max(1, Number(req.body?.durationMinutes) || 60));

  const exam = await Exam.create({
    title,
    description: norm(req.body?.description) || `MCQ test • ${questions.length} questions`,
    courseId: req.body?.courseId || undefined,
    kind: 'MCQ',
    durationMinutes,
    totalMarks,
    passingMarks: Math.round(((totalMarks * passPct) / 100) * 100) / 100,
    negativeMarking: Math.max(0, Number(req.body?.negativeMarking) || 0),
    attemptLimit: Math.max(1, Number(req.body?.attemptLimit) || 1),
    status: 'ACTIVE',
    isPublished: true,
    // Same order as the sheet
    securitySettings: { ...(req.body?.securitySettings || {}), questionRandomization: false, optionRandomization: false },
    questionIds: [],
    createdById: req.user!.userId,
  });
  const docs = await Question.insertMany(
    questions.map((q) => ({
      examId: exam._id,
      questionText: q.question,
      type: 'MCQ',
      options: q.options,
      correctAnswer: q.correct,
      marks: marksEach,
      negativeMarks: Math.max(0, Number(req.body?.negativeMarking) || 0),
      difficulty: 'MEDIUM',
      topicTag: title.slice(0, 60),
      createdById: req.user!.userId,
    })),
    { ordered: true }
  );
  exam.questionIds = docs.map((d) => d._id);
  await exam.save();
  res.status(201).json({ success: true, message: `Test published with ${docs.length} questions`, data: { exam } });
};

export const createLinkTest = async (req: AuthRequest, res: Response): Promise<void> => {
  const title = norm(req.body?.title);
  const raw = norm(req.body?.testLink);
  if (!title || !raw) throw new AppError('Give the test a name and its link', 400, 'MISSING_FIELDS');
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new AppError('The test link is not a valid web address', 400, 'INVALID_URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new AppError('The test link is not a valid web address', 400, 'INVALID_URL');
  const durationMinutes = Math.min(600, Math.max(1, Number(req.body?.durationMinutes) || 60));
  const exam = await Exam.create({
    title,
    description: norm(req.body?.description) || 'Technical test: open the link to take it',
    courseId: req.body?.courseId || undefined,
    kind: 'LINK',
    testLink: url.toString(),
    durationMinutes,
    totalMarks: Math.max(1, Number(req.body?.totalMarks) || 100),
    passingMarks: Math.max(0, Number(req.body?.passingMarks) || 40),
    status: 'ACTIVE',
    isPublished: true,
    questionIds: [],
    createdById: req.user!.userId,
  });
  res.status(201).json({ success: true, message: 'Technical test link published', data: { exam } });
};

// Trainer / admin: remove a test with its own questions (bank questions stay), attempts, results and proctoring logs
export const deleteExam = async (req: AuthRequest, res: Response): Promise<void> => {
  const exam = mongoose.isValidObjectId(req.params.id) ? await Exam.findById(req.params.id).select('title') : null;
  if (!exam) throw new AppError('Test not found', 404, 'NOT_FOUND');
  const [attempts] = await Promise.all([
    ExamAttempt.deleteMany({ examId: exam._id }),
    Result.deleteMany({ examId: exam._id }),
    ProctoringLog.deleteMany({ examId: exam._id }),
    Question.deleteMany({ examId: exam._id }),
  ]);
  await Exam.deleteOne({ _id: exam._id });
  await AuditLog.create({
    userId: req.user?.userId,
    userEmail: req.user?.email,
    userRole: req.user?.role,
    action: 'EXAM_DELETED',
    resource: 'EXAM',
    metadata: { examId: String(exam._id), title: exam.title, attempts: attempts.deletedCount },
    ipAddress: req.ip,
  }).catch(() => undefined);
  res.json({ success: true, message: `${exam.title} was deleted` });
};
