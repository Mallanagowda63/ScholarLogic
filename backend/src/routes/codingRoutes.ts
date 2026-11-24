import { Router, Response } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { authenticateUser, authorizeRoles, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { CodingFolder, CodingQuestion, CodingSubmission } from '../models/Coding';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { Batch } from '../models/tracking/Batch';
import { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } from '../models/tracking/StudentBatchAllocation';

/**
 * Technical practice (coding questions). Staff: /api/coding/... ; students: /api/coding/student/...
 * Code runs in the student's browser; the server stores questions, submissions and tells the trainer.
 */
const router = Router();
router.use(authenticateUser);
const staff = authorizeRoles('TRAINER', 'ADMIN', 'SUPER_ADMIN');
const studentOnly = authorizeRoles('STUDENT');
const isAdmin = (req: AuthRequest) => ['ADMIN', 'SUPER_ADMIN'].includes(String(req.user?.role));
const oid = (v: any, what: string) => {
  if (!mongoose.isValidObjectId(v)) throw new AppError(`Invalid ${what}`, 400, 'INVALID_ID');
  return new mongoose.Types.ObjectId(String(v));
};
const LANGS = ['python', 'sql', 'javascript'];
const DIFF = ['EASY', 'MEDIUM', 'HARD'];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');

async function editableFolder(req: AuthRequest, id: any) {
  const folder = await CodingFolder.findById(oid(id, 'folder'));
  if (!folder) throw new AppError('Folder not found', 404, 'NOT_FOUND');
  if (!isAdmin(req) && String(folder.createdById) !== String(req.user?.userId)) throw new AppError('Only the trainer who made this folder can change it', 403, 'FORBIDDEN');
  return folder;
}

const cleanTests = (tests: any) =>
  (Array.isArray(tests) ? tests : [])
    .map((t: any) => ({ input: String(t?.input ?? ''), expected: String(t?.expected ?? ''), hidden: !!t?.hidden }))
    .filter((t: any) => t.input.trim() || t.expected.trim())
    .slice(0, 20);

// ---------------------------------------------------------------------------- staff: folders
router.get(
  '/folders',
  staff,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const folders: any[] = await CodingFolder.find({}).sort({ createdAt: -1 }).lean();
    const [counts, subs, creators, batches] = await Promise.all([
      CodingQuestion.aggregate([{ $group: { _id: '$folderId', n: { $sum: 1 } } }]),
      CodingSubmission.aggregate([{ $group: { _id: '$folderId', n: { $sum: 1 }, students: { $addToSet: '$studentId' } } }]),
      User.find({ _id: { $in: folders.map((f) => f.createdById) } }).select('fullName').lean(),
      Batch.find({ _id: { $in: folders.flatMap((f) => f.batchIds || []) } }).select('batchCode').lean(),
    ]);
    const cMap = new Map(counts.map((c: any) => [String(c._id), c.n]));
    const sMap = new Map(subs.map((c: any) => [String(c._id), c]));
    const uMap = new Map(creators.map((u: any) => [String(u._id), u.fullName]));
    const bMap = new Map(batches.map((b: any) => [String(b._id), b.batchCode]));
    res.json({
      success: true,
      data: {
        folders: folders.map((f) => ({
          ...f,
          questionCount: cMap.get(String(f._id)) || 0,
          submissionCount: (sMap.get(String(f._id)) as any)?.n || 0,
          studentCount: (sMap.get(String(f._id)) as any)?.students?.length || 0,
          createdBy: uMap.get(String(f.createdById)) || '',
          batches: (f.batchIds || []).map((b: any) => bMap.get(String(b))).filter(Boolean),
        })),
      },
    });
  })
);

router.get(
  '/batches',
  staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const filter: any = isAdmin(req) ? {} : { trainerId: req.user?.userId };
    const batches = await Batch.find({ ...filter, status: { $ne: 'CANCELLED' } }).select('batchCode timing status').sort({ startDate: -1 }).lean();
    res.json({ success: true, data: { batches } });
  })
);

router.post(
  '/folders',
  staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { name, description = '', language, batchIds = [] } = req.body || {};
    if (!String(name || '').trim()) throw new AppError('Give the folder a name', 400, 'MISSING_FIELDS');
    if (!LANGS.includes(language)) throw new AppError('Choose Python, SQL or JavaScript', 400, 'MISSING_FIELDS');
    const folder = await CodingFolder.create({
      name: String(name).trim().slice(0, 80),
      description: String(description).slice(0, 1000),
      language,
      batchIds: (Array.isArray(batchIds) ? batchIds : []).filter((b: any) => mongoose.isValidObjectId(b)),
      createdById: req.user!.userId,
    });
    res.status(201).json({ success: true, message: `Folder "${folder.name}" created`, data: { folder } });
  })
);

router.put(
  '/folders/:id',
  staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const folder = await editableFolder(req, req.params.id);
    const { name, description, batchIds } = req.body || {};
    if (typeof name === 'string' && name.trim()) folder.name = name.trim().slice(0, 80);
    if (typeof description === 'string') folder.description = description.slice(0, 1000);
    if (Array.isArray(batchIds)) folder.batchIds = batchIds.filter((b: any) => mongoose.isValidObjectId(b));
    await folder.save();
    res.json({ success: true, message: 'Folder saved', data: { folder } });
  })
);

router.delete(
  '/folders/:id',
  staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const folder = await editableFolder(req, req.params.id);
    await Promise.all([CodingQuestion.deleteMany({ folderId: folder._id }), CodingSubmission.deleteMany({ folderId: folder._id })]);
    await folder.deleteOne();
    res.json({ success: true, message: `Folder "${folder.name}" removed` });
  })
);

// ---------------------------------------------------------------------------- staff: questions
router.get(
  '/folders/:id/questions',
  staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const folder: any = await CodingFolder.findById(oid(req.params.id, 'folder')).lean();
    if (!folder) throw new AppError('Folder not found', 404, 'NOT_FOUND');
    const questions: any[] = await CodingQuestion.find({ folderId: folder._id }).sort({ order: 1, createdAt: 1 }).lean();
    const stats = await CodingSubmission.aggregate([
      { $match: { folderId: folder._id } },
      { $group: { _id: { q: '$questionId', s: '$studentId' }, best: { $max: { $cond: [{ $eq: ['$status', 'PASSED'] }, 1, 0] } } } },
      { $group: { _id: '$_id.q', tried: { $sum: 1 }, solved: { $sum: '$best' } } },
    ]);
    const st = new Map(stats.map((s: any) => [String(s._id), s]));
    res.json({
      success: true,
      data: {
        folder,
        canEdit: isAdmin(req) || String(folder.createdById) === String(req.user?.userId),
        questions: questions.map((q) => ({ ...q, tried: (st.get(String(q._id)) as any)?.tried || 0, solved: (st.get(String(q._id)) as any)?.solved || 0 })),
      },
    });
  })
);

router.post(
  '/folders/:id/questions',
  staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const folder = await editableFolder(req, req.params.id);
    const b = req.body || {};
    if (!String(b.title || '').trim()) throw new AppError('Give the question a title', 400, 'MISSING_FIELDS');
    const count = await CodingQuestion.countDocuments({ folderId: folder._id });
    const q = await CodingQuestion.create({
      folderId: folder._id,
      order: count + 1,
      title: String(b.title).trim().slice(0, 150),
      description: String(b.description || '').slice(0, 8000),
      difficulty: DIFF.includes(b.difficulty) ? b.difficulty : 'EASY',
      starterCode: String(b.starterCode || '').slice(0, 8000),
      solution: String(b.solution || '').slice(0, 8000),
      sqlSetup: String(b.sqlSetup || '').slice(0, 20000),
      tests: cleanTests(b.tests),
      createdById: req.user!.userId,
    });
    res.status(201).json({ success: true, message: 'Question added', data: { question: q } });
  })
);

router.put(
  '/questions/:id',
  staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const q = await CodingQuestion.findById(oid(req.params.id, 'question'));
    if (!q) throw new AppError('Question not found', 404, 'NOT_FOUND');
    await editableFolder(req, q.folderId);
    const b = req.body || {};
    if (typeof b.title === 'string' && b.title.trim()) q.title = b.title.trim().slice(0, 150);
    if (typeof b.description === 'string') q.description = b.description.slice(0, 8000);
    if (DIFF.includes(b.difficulty)) q.difficulty = b.difficulty;
    if (typeof b.starterCode === 'string') q.starterCode = b.starterCode.slice(0, 8000);
    if (typeof b.solution === 'string') q.solution = b.solution.slice(0, 8000);
    if (typeof b.sqlSetup === 'string') q.sqlSetup = b.sqlSetup.slice(0, 20000);
    if (Array.isArray(b.tests)) q.tests = cleanTests(b.tests) as any;
    await q.save();
    res.json({ success: true, message: 'Question saved', data: { question: q } });
  })
);

router.delete(
  '/questions/:id',
  staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const q = await CodingQuestion.findById(oid(req.params.id, 'question'));
    if (!q) throw new AppError('Question not found', 404, 'NOT_FOUND');
    await editableFolder(req, q.folderId);
    await CodingSubmission.deleteMany({ questionId: q._id });
    await q.deleteOne();
    res.json({ success: true, message: 'Question removed' });
  })
);

// Excel: many questions at once. Columns: Title | Question | Difficulty | Starter code | Input 1 | Output 1 | ... | SQL setup
router.get(
  '/import-template',
  staff,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const rows = [
      ['Title', 'Question', 'Difficulty', 'Starter code', 'Input 1', 'Output 1', 'Input 2', 'Output 2', 'Input 3', 'Output 3', 'SQL setup (SQL folders only)'],
      ['Even or odd', 'Read a number n. Print "Even" if n is even, otherwise print "Odd".', 'EASY', 'n = int(input())\n', '4', 'Even', '7', 'Odd', '0', 'Even', ''],
      ['Largest of two', 'Read two numbers a and b (one per line). Print the larger one.', 'EASY', 'a = int(input())\nb = int(input())\n', '3\n9', '9', '10\n2', '10', '5\n5', '5', ''],
      ['Grade', 'Read marks (0-100). Print A if >= 80, B if >= 60, C if >= 40, else F.', 'MEDIUM', '', '85', 'A', '61', 'B', '12', 'F', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 60 }, { wch: 10 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 40 }];
    const help = XLSX.utils.aoa_to_sheet([
      ['How to fill'],
      ['One row = one question. Title and Question are needed; Difficulty is EASY, MEDIUM or HARD.'],
      ['Input N / Output N = a test case: what the program gets on input (several lines allowed) and exactly what it must print.'],
      ['Up to 10 test cases: add more columns named Input 4, Output 4, ... Tests after the first 2 are hidden from students.'],
      ['SQL folders: put CREATE TABLE and INSERT statements in "SQL setup"; Output = the query result (first line the column names, then rows, columns separated by " | ").'],
      ['Tip: for SQL it is easier to add one question on the website and press "Fill outputs from my solution".'],
    ]);
    help['!cols'] = [{ wch: 140 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Questions');
    XLSX.utils.book_append_sheet(wb, help, 'How to fill');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="coding-questions-template.xlsx"');
    res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  })
);

router.post(
  '/folders/:id/import',
  staff,
  upload,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const folder = await editableFolder(req, req.params.id);
    const file = (req as any).file;
    if (!file) throw new AppError('Choose the Excel file', 400, 'MISSING_FILE');
    let rows: any[][] = [];
    try {
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false }) as any[][];
    } catch {
      throw new AppError('Could not read the file. Use the Excel template.', 400, 'BAD_FILE');
    }
    const header = (rows[0] || []).map((h) => String(h).trim().toLowerCase());
    const at = (re: RegExp) => header.findIndex((h) => re.test(h));
    const cTitle = at(/^title/);
    const cQ = at(/^question|description/);
    const cDiff = at(/difficulty|level/);
    const cStart = at(/starter/);
    const cSql = at(/sql setup|setup/);
    if (cTitle < 0) throw new AppError('No "Title" column. Use the Excel template.', 400, 'BAD_FILE');
    const pairs: [number, number][] = [];
    for (let n = 1; n <= 10; n++) {
      const i = at(new RegExp(`^input\\s*${n}$`));
      const o = at(new RegExp(`^output\\s*${n}$`));
      if (i >= 0 && o >= 0) pairs.push([i, o]);
    }
    let order = await CodingQuestion.countDocuments({ folderId: folder._id });
    const docs: any[] = [];
    for (const r of rows.slice(1)) {
      const title = String(r[cTitle] ?? '').trim();
      if (!title) continue;
      const diff = String(cDiff >= 0 ? r[cDiff] : '').trim().toUpperCase();
      docs.push({
        folderId: folder._id,
        order: ++order,
        title: title.slice(0, 150),
        description: String(cQ >= 0 ? r[cQ] : '').slice(0, 8000),
        difficulty: DIFF.includes(diff) ? diff : 'EASY',
        starterCode: String(cStart >= 0 ? r[cStart] : '').slice(0, 8000),
        sqlSetup: String(cSql >= 0 ? r[cSql] : '').slice(0, 20000),
        tests: pairs
          .map(([i, o], k) => ({ input: String(r[i] ?? ''), expected: String(r[o] ?? ''), hidden: k >= 2 }))
          .filter((t) => t.input.trim() || t.expected.trim()),
        createdById: req.user!.userId,
      });
      if (docs.length >= 500) break;
    }
    if (!docs.length) throw new AppError('No questions found in the file', 400, 'NO_ROWS');
    await CodingQuestion.insertMany(docs);
    res.json({ success: true, message: `${docs.length} question${docs.length === 1 ? '' : 's'} added to "${folder.name}"` });
  })
);

// ---------------------------------------------------------------------------- staff: submissions
router.get(
  '/submissions',
  staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const filter: any = {};
    if (req.query.folderId) filter.folderId = oid(req.query.folderId, 'folder');
    if (req.query.questionId) filter.questionId = oid(req.query.questionId, 'question');
    const subs: any[] = await CodingSubmission.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    const [students, questions] = await Promise.all([
      Student.find({ _id: { $in: subs.map((s) => s.studentId) } }).select('studentId userId').populate('userId', 'fullName').lean(),
      CodingQuestion.find({ _id: { $in: subs.map((s) => s.questionId) } }).select('title').lean(),
    ]);
    const sMap = new Map(students.map((s: any) => [String(s._id), { studentId: s.studentId, fullName: s.userId?.fullName || 'Student' }]));
    const qMap = new Map(questions.map((q: any) => [String(q._id), q.title]));
    res.json({
      success: true,
      data: { submissions: subs.map((s) => ({ ...s, student: sMap.get(String(s.studentId)) || null, questionTitle: qMap.get(String(s.questionId)) || '' })) },
    });
  })
);

// ---------------------------------------------------------------------------- students
async function meAsStudent(req: AuthRequest) {
  const student: any = await Student.findOne({ userId: req.user?.userId }).select('_id studentId userId').lean();
  if (!student) throw new AppError('Student profile not found', 404, 'NOT_FOUND');
  const batchIds = (await StudentBatchAllocation.find({ studentId: student._id, status: { $in: ACTIVE_ALLOCATION_STATUSES } }).select('batchId').lean()).map((a) => String(a.batchId));
  return { student, batchIds };
}
const visibleTo = (folder: any, batchIds: string[]) => !folder.batchIds?.length || folder.batchIds.some((b: any) => batchIds.includes(String(b)));

router.get(
  '/student/folders',
  studentOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { student, batchIds } = await meAsStudent(req);
    const folders: any[] = (await CodingFolder.find({}).sort({ createdAt: -1 }).lean()).filter((f) => visibleTo(f, batchIds));
    const ids = folders.map((f) => f._id);
    const [counts, mine] = await Promise.all([
      CodingQuestion.aggregate([{ $match: { folderId: { $in: ids } } }, { $group: { _id: '$folderId', n: { $sum: 1 } } }]),
      CodingSubmission.aggregate([
        { $match: { studentId: student._id, folderId: { $in: ids } } },
        { $group: { _id: { f: '$folderId', q: '$questionId' }, solved: { $max: { $cond: [{ $eq: ['$status', 'PASSED'] }, 1, 0] } } } },
        { $group: { _id: '$_id.f', tried: { $sum: 1 }, solved: { $sum: '$solved' } } },
      ]),
    ]);
    const cMap = new Map(counts.map((c: any) => [String(c._id), c.n]));
    const mMap = new Map(mine.map((m: any) => [String(m._id), m]));
    res.json({
      success: true,
      data: {
        folders: folders.map((f) => ({
          _id: f._id,
          name: f.name,
          description: f.description,
          language: f.language,
          questionCount: cMap.get(String(f._id)) || 0,
          solved: (mMap.get(String(f._id)) as any)?.solved || 0,
          tried: (mMap.get(String(f._id)) as any)?.tried || 0,
        })),
      },
    });
  })
);

router.get(
  '/student/folders/:id',
  studentOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { student, batchIds } = await meAsStudent(req);
    const folder: any = await CodingFolder.findById(oid(req.params.id, 'folder')).lean();
    if (!folder || !visibleTo(folder, batchIds)) throw new AppError('Folder not found', 404, 'NOT_FOUND');
    const questions: any[] = await CodingQuestion.find({ folderId: folder._id }).sort({ order: 1, createdAt: 1 }).lean();
    const mine = await CodingSubmission.aggregate([
      { $match: { studentId: student._id, folderId: folder._id } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$questionId', best: { $max: '$passed' }, solved: { $max: { $cond: [{ $eq: ['$status', 'PASSED'] }, 1, 0] } }, lastCode: { $first: '$code' }, attempts: { $sum: 1 } } },
    ]);
    const m = new Map(mine.map((x: any) => [String(x._id), x]));
    res.json({
      success: true,
      data: {
        folder: { _id: folder._id, name: folder.name, description: folder.description, language: folder.language },
        questions: questions.map((q) => {
          const x: any = m.get(String(q._id));
          // The solution never leaves the server. Hidden tests are sent (the code is checked in the browser) but not shown.
          return {
            _id: q._id,
            title: q.title,
            description: q.description,
            difficulty: q.difficulty,
            starterCode: q.starterCode,
            sqlSetup: q.sqlSetup,
            tests: q.tests.map((t: any) => ({ input: t.input, expected: t.expected, hidden: t.hidden })),
            solved: !!x?.solved,
            attempts: x?.attempts || 0,
            lastCode: x?.lastCode || '',
          };
        }),
      },
    });
  })
);

router.post(
  '/student/questions/:id/submit',
  studentOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { student, batchIds } = await meAsStudent(req);
    const q: any = await CodingQuestion.findById(oid(req.params.id, 'question')).lean();
    if (!q) throw new AppError('Question not found', 404, 'NOT_FOUND');
    const folder: any = await CodingFolder.findById(q.folderId).lean();
    if (!folder || !visibleTo(folder, batchIds)) throw new AppError('Question not found', 404, 'NOT_FOUND');
    const code = String(req.body?.code || '');
    if (!code.trim()) throw new AppError('Write some code first', 400, 'MISSING_FIELDS');
    const results = (Array.isArray(req.body?.results) ? req.body.results : []).slice(0, q.tests.length).map((r: any) => ({
      passed: !!r?.passed,
      got: String(r?.got ?? '').slice(0, 2000),
      error: String(r?.error ?? '').slice(0, 2000),
    }));
    const total = q.tests.length;
    const passed = results.filter((r: any) => r.passed).length;
    const status = total && passed === total ? 'PASSED' : passed ? 'PARTIAL' : 'FAILED';
    const sub = await CodingSubmission.create({ questionId: q._id, folderId: folder._id, studentId: student._id, language: folder.language, code: code.slice(0, 20000), passed, total, status, results });
    const user: any = await User.findById(req.user?.userId).select('fullName').lean();
    await Notification.create({
      userId: folder.createdById,
      title: `${status === 'PASSED' ? '✅' : status === 'PARTIAL' ? '🟡' : '❌'} ${user?.fullName || 'A student'} submitted "${q.title}"`,
      message: `${folder.name}: ${passed}/${total} tests passed (${student.studentId}).`,
      type: 'ASSIGNMENT',
      linkUrl: `/trainer/coding?folder=${folder._id}&tab=submissions`,
    }).catch(() => undefined);
    res.status(201).json({
      success: true,
      message: status === 'PASSED' ? 'All tests passed. Submitted!' : `Submitted: ${passed}/${total} tests passed`,
      data: { submission: { _id: sub._id, status, passed, total } },
    });
  })
);

// For the student's profile / dashboard
router.get(
  '/student/summary',
  studentOnly,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { student } = await meAsStudent(req);
    const [agg] = await CodingSubmission.aggregate([
      { $match: { studentId: student._id } },
      { $group: { _id: '$questionId', solved: { $max: { $cond: [{ $eq: ['$status', 'PASSED'] }, 1, 0] } }, attempts: { $sum: 1 } } },
      { $group: { _id: null, tried: { $sum: 1 }, solved: { $sum: '$solved' }, submissions: { $sum: '$attempts' } } },
    ]);
    const recent: any[] = await CodingSubmission.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(8).select('questionId folderId status passed total createdAt').lean();
    const qs = new Map((await CodingQuestion.find({ _id: { $in: recent.map((r) => r.questionId) } }).select('title').lean()).map((q: any) => [String(q._id), q.title]));
    res.json({
      success: true,
      data: {
        solved: agg?.solved || 0,
        tried: agg?.tried || 0,
        submissions: agg?.submissions || 0,
        recent: recent.map((r) => ({ ...r, title: qs.get(String(r.questionId)) || 'Question' })),
      },
    });
  })
);

export default router;
