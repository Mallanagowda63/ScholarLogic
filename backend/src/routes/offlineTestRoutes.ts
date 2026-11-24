import { Router, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { authenticateUser, authorizeRoles, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { OfflineTest } from '../models/OfflineTest';
import { Student } from '../models/Student';
import { Batch } from '../models/tracking/Batch';
import { Subject } from '../models/tracking/Subject';
import { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } from '../models/tracking/StudentBatchAllocation';

/**
 * Offline (written / classroom) test marks. A trainer downloads the Excel template for a batch (Student ID and
 * Name already filled), types the marks, uploads it, checks the preview and saves. Saved marks count in the
 * leaderboard every student sees on their dashboard.
 */
const router = Router();
router.use(authenticateUser, authorizeRoles('TRAINER', 'ADMIN', 'SUPER_ADMIN'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');
const isAdmin = (req: AuthRequest) => ['ADMIN', 'SUPER_ADMIN'].includes(String(req.user?.role));

/** The batch, checked: a trainer can only use their own batches */
async function batchFor(req: AuthRequest, batchId: string) {
  if (!mongoose.isValidObjectId(batchId)) throw new AppError('Choose a batch', 400, 'MISSING_FIELDS');
  const batch: any = await Batch.findById(batchId).select('batchCode subjectId trainerId').lean();
  if (!batch) throw new AppError('Batch not found', 404, 'NOT_FOUND');
  if (!isAdmin(req) && String(batch.trainerId) !== String(req.user?.userId)) throw new AppError('This is not your batch', 403, 'FORBIDDEN');
  return batch;
}

async function batchStudents(batchId: any) {
  const allocations = await StudentBatchAllocation.find({ batchId, status: { $in: ACTIVE_ALLOCATION_STATUSES } }).select('studentId').lean();
  const students: any[] = await Student.find({ _id: { $in: allocations.map((a) => a.studentId) } })
    .select('studentId biometricId userId')
    .populate('userId', 'fullName')
    .lean();
  return students
    .map((s) => ({ _id: s._id, studentId: s.studentId, biometricId: s.biometricId || '', fullName: s.userId?.fullName || 'Student' }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

// Batches the user can upload for (trainer: own batches; admin: all running/upcoming/recent)
router.get(
  '/batches',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const filter: any = isAdmin(req) ? {} : { trainerId: req.user?.userId };
    const batches: any[] = await Batch.find({ ...filter, status: { $ne: 'CANCELLED' } }).select('batchCode subjectId timing status').sort({ startDate: -1 }).lean();
    const subjects = new Map((await Subject.find({ _id: { $in: batches.map((b) => b.subjectId) } }).select('name').lean()).map((s: any) => [String(s._id), s.name]));
    res.json({ success: true, data: { batches: batches.map((b) => ({ _id: b._id, batchCode: b.batchCode, subject: subjects.get(String(b.subjectId)) || '', timing: b.timing, status: b.status })) } });
  })
);

// The Excel template: Student ID and Name of the batch's students, Marks to fill, Out of
router.get(
  '/template',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const outOf = Math.max(1, Number(req.query.outOf) || 100);
    let rows: any[] = [];
    let label = 'demo';
    if (req.query.batchId) {
      const batch = await batchFor(req, String(req.query.batchId));
      label = batch.batchCode;
      rows = (await batchStudents(batch._id)).map((s, i) => ({ 'No.': i + 1, 'Student ID': s.studentId, Name: s.fullName, Marks: '', 'Out of': outOf }));
    }
    if (!rows.length) {
      rows = [
        { 'No.': 1, 'Student ID': 'SCLR245', Name: 'Ravi Kumar', Marks: 42, 'Out of': outOf },
        { 'No.': 2, 'Student ID': 'SCLR246', Name: 'Priya S', Marks: 47, 'Out of': outOf },
        { 'No.': 3, 'Student ID': 'SCLR247', Name: 'Arun M', Marks: 38, 'Out of': outOf },
      ];
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 8 }];
    const help = XLSX.utils.aoa_to_sheet([
      ['How to fill'],
      ['1. Type each student\'s marks in the Marks column. Leave it empty for a student who was absent.'],
      ['2. Out of = the total marks of the test (same for everyone, or change it per row).'],
      ['3. Keep the Student ID column as it is: marks are matched by Student ID (or by name when the ID is empty).'],
      ['4. Save and upload this file on ScholarLogic: Offline Test Marks > Upload marks.'],
    ]);
    help['!cols'] = [{ wch: 100 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marks');
    XLSX.utils.book_append_sheet(wb, help, 'How to fill');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="marks-${label}.xlsx"`);
    res.send(buf);
  })
);

const norm = (v: any) => String(v ?? '').trim();
const key = (v: any) => norm(v).toUpperCase().replace(/\s+/g, '');
const nameKey = (v: any) => norm(v).toLowerCase().replace(/[^a-z]/g, '');

// Upload → preview: every row with the student it matched (or why not). Nothing is saved yet.
router.post(
  '/preview',
  upload,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = (req as any).file;
    if (!file) throw new AppError('Choose the Excel file', 400, 'MISSING_FILE');
    const batch = await batchFor(req, String(req.body?.batchId || ''));
    const defaultOutOf = Number(req.body?.outOf) || 0;
    let sheetRows: any[][] = [];
    try {
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }) as any[][];
    } catch {
      throw new AppError('Could not read the file. Upload an Excel (.xlsx) or .csv file.', 400, 'BAD_FILE');
    }
    // Find the header row and the columns by their names
    const headerIdx = sheetRows.findIndex((r) => r.some((c) => /marks?|score/i.test(norm(c))));
    if (headerIdx < 0) throw new AppError('No "Marks" column found. Use the template: Student ID, Name, Marks, Out of.', 400, 'BAD_FILE');
    const header = sheetRows[headerIdx].map((c) => norm(c).toLowerCase());
    const col = (re: RegExp) => header.findIndex((h) => re.test(h));
    const cId = col(/student\s*id|^id$|sclr|roll|code/);
    const cName = col(/name/);
    const cMarks = col(/^marks?$|^score|marks obtained|obtained/);
    const cOut = col(/out\s*of|total|max/);
    if (cMarks < 0) throw new AppError('No "Marks" column found.', 400, 'BAD_FILE');

    const students = await batchStudents(batch._id);
    const byCode = new Map<string, any>();
    students.forEach((s) => {
      byCode.set(key(s.studentId), s);
      if (s.biometricId) byCode.set(key(s.biometricId), s);
    });
    const byName = new Map<string, any[]>();
    students.forEach((s) => byName.set(nameKey(s.fullName), [...(byName.get(nameKey(s.fullName)) || []), s]));

    const rows: any[] = [];
    const seen = new Set<string>();
    for (const r of sheetRows.slice(headerIdx + 1)) {
      const code = cId >= 0 ? norm(r[cId]) : '';
      const name = cName >= 0 ? norm(r[cName]) : '';
      const marksRaw = norm(r[cMarks]);
      if (!code && !name && !marksRaw) continue;
      const outOf = Number(cOut >= 0 ? r[cOut] : '') || defaultOutOf;
      let student = code ? byCode.get(key(code)) : undefined;
      if (!student && name) {
        const m = byName.get(nameKey(name)) || [];
        if (m.length === 1) student = m[0];
      }
      let problem = '';
      const marks = marksRaw ? Number(marksRaw) : NaN;
      if (!student) problem = code ? `${code} is not in ${batch.batchCode}` : 'Student not found in this batch';
      else if (!marksRaw) problem = 'No marks (absent?)';
      else if (Number.isNaN(marks) || marks < 0) problem = `"${marksRaw}" is not a number`;
      else if (!outOf) problem = 'No "Out of" total';
      else if (marks > outOf) problem = `Marks ${marks} are more than ${outOf}`;
      else if (seen.has(String(student._id))) problem = 'This student is twice in the file';
      if (student && !problem) seen.add(String(student._id));
      rows.push({
        code: code || student?.studentId || '',
        name: name || student?.fullName || '',
        marks: Number.isNaN(marks) ? null : marks,
        outOf,
        student: student ? { _id: student._id, studentId: student.studentId, fullName: student.fullName } : null,
        ok: !problem,
        problem,
      });
    }
    const missing = students.filter((s) => !seen.has(String(s._id))).map((s) => ({ studentId: s.studentId, fullName: s.fullName }));
    res.json({ success: true, data: { rows, missing, fileName: file.originalname || '' } });
  })
);

// Save the checked rows
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { batchId, name, date, rows, fileName = '' } = req.body || {};
    const batch = await batchFor(req, String(batchId || ''));
    if (!String(name || '').trim()) throw new AppError('Give the test a name', 400, 'MISSING_FIELDS');
    const when = new Date(date || Date.now());
    if (Number.isNaN(when.getTime())) throw new AppError('Pick the test date', 400, 'INVALID_DATE');
    const allowed = new Set((await batchStudents(batch._id)).map((s) => String(s._id)));
    const entries = (Array.isArray(rows) ? rows : [])
      .filter((r: any) => r?.ok && r.student?._id && allowed.has(String(r.student._id)))
      .map((r: any) => {
        const outOf = Number(r.outOf) || 0;
        const marks = Math.min(Number(r.marks) || 0, outOf);
        return { studentId: r.student._id, studentCode: r.student.studentId, name: r.student.fullName, marks, outOf, percentage: outOf ? Math.round((marks / outOf) * 1000) / 10 : 0 };
      });
    if (!entries.length) throw new AppError('No rows with marks to save', 400, 'NO_ROWS');
    const test = await OfflineTest.create({
      name: String(name).trim().slice(0, 120),
      date: when,
      batchId: batch._id,
      subjectId: batch.subjectId,
      outOf: Math.max(...entries.map((e: any) => e.outOf)),
      entries,
      fileName: String(fileName).slice(0, 200),
      uploadedById: req.user!.userId,
    });
    res.status(201).json({ success: true, message: `Marks saved for ${entries.length} student${entries.length === 1 ? '' : 's'}`, data: { test } });
  })
);

// Tests uploaded so far (trainer: their batches)
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const filter: any = {};
    if (!isAdmin(req)) {
      const mine = await Batch.find({ trainerId: req.user?.userId }).select('_id').lean();
      filter.batchId = { $in: mine.map((b) => b._id) };
    }
    const tests: any[] = await OfflineTest.find(filter).sort({ date: -1, createdAt: -1 }).limit(300).lean();
    const batches = new Map((await Batch.find({ _id: { $in: tests.map((t) => t.batchId) } }).select('batchCode').lean()).map((b: any) => [String(b._id), b.batchCode]));
    res.json({
      success: true,
      data: {
        tests: tests.map((t) => {
          const sorted = [...t.entries].sort((a: any, b: any) => b.percentage - a.percentage);
          const avg = t.entries.length ? Math.round(t.entries.reduce((s: number, e: any) => s + e.percentage, 0) / t.entries.length) : 0;
          return { _id: t._id, name: t.name, date: t.date, batchCode: batches.get(String(t.batchId)) || '', outOf: t.outOf, count: t.entries.length, average: avg, top: sorted.slice(0, 3).map((e: any) => ({ name: e.name, marks: e.marks, outOf: e.outOf })), entries: sorted };
        }),
      },
    });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid test', 400, 'INVALID_ID');
    const test = await OfflineTest.findById(req.params.id);
    if (!test) throw new AppError('Test not found', 404, 'NOT_FOUND');
    if (test.batchId) await batchFor(req, String(test.batchId));
    await test.deleteOne();
    res.json({ success: true, message: `"${test.name}" removed` });
  })
);

export default router;
