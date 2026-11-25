import { Router, Response } from 'express';
import { env } from '../config/env';
import { authenticateUser, authorizeRoles, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { Student } from '../models/Student';
import multer from 'multer';
import { getStudentAttendanceCalendar, getBiometricLive, assignBiometricId, rematchPunches } from '../services/biometricService';
import {
  analyzeImport,
  assignENumbers,
  buildExport,
  commitImport,
  getOverview,
  getReviewQueue,
  getSyncLogs,
  queueStudentPush,
  setCardNumber,
  updateSettings,
} from '../services/esslService';
import { getLastPull, isMachinePullConfigured, pullFromMachine } from '../services/esslPullService';

const router = Router();

router.use(authenticateUser);

// Logged-in student's daily attendance calendar (biometric punches + trainer marks)
router.get(
  '/me',
  authorizeRoles('STUDENT'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const student = await Student.findOne({ userId: req.user!.userId });
    if (!student) throw new AppError('Student profile not found', 404, 'STUDENT_NOT_FOUND');
    const data = await getStudentAttendanceCalendar(student, req.query as { from?: string; to?: string });
    res.json({ success: true, data });
  })
);

// Same calendar for any student, for staff
router.get(
  '/students/:id',
  authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER', 'PLACEMENT_MANAGER'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const student = await Student.findById(req.params.id);
    if (!student) throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
    const data = await getStudentAttendanceCalendar(student, req.query as { from?: string; to?: string });
    res.json({ success: true, data });
  })
);

// Live monitor: device online/offline, each student's IN/OUT for the day, punch feed, unknown machine IDs
router.get(
  '/biometric/live',
  authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ success: true, data: await getBiometricLive(req.query as { date?: string }) });
  })
);

// Set or clear the ID a student is enrolled under on the biometric machine
router.put(
  '/students/:id/biometric-id',
  authorizeRoles('ADMIN', 'SUPER_ADMIN'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await assignBiometricId(String(req.params.id), req.body?.biometricId);
    const message = data.biometricId ? `Biometric ID ${data.biometricId} assigned to ${data.studentId}` : 'Biometric ID cleared';
    res.json({ success: true, message, data });
  })
);

// ---------- eSSL integration (admin) ----------

const admins = authorizeRoles('ADMIN', 'SUPER_ADMIN');

// The master sheet is parsed in memory and never written to disk
const sheetUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');

const sheetFile = (req: AuthRequest) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) throw new AppError('Choose an Excel (.xlsx, .xls) or CSV file', 400, 'MISSING_FILE');
  if (!/.(xlsx|xls|csv)$/i.test(file.originalname)) throw new AppError('Only .xlsx, .xls and .csv files are accepted', 400, 'INVALID_FILE');
  return file;
};

// Device sync status, every student's E Number / card and what the machine has confirmed about them
router.get(
  '/biometric/overview',
  admins,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: await getOverview() });
  })
);

// Give E Numbers to the selected students, or to everyone without one. Existing numbers are kept
router.post(
  '/biometric/e-numbers/assign',
  admins,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await assignENumbers(Array.isArray(req.body?.studentIds) ? req.body.studentIds.map(String) : undefined);
    res.json({ success: true, message: `${data.assigned.length} E Number(s) assigned`, data });
  })
);

// Set or clear the card linked to the student's Biometric ID
router.put(
  '/students/:id/card-number',
  admins,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await setCardNumber(String(req.params.id), req.body?.cardNumber);
    const message = data.cardNumber ? `Card ${data.cardNumber} linked to ${data.studentId} (E Number ${data.biometricId})` : 'Card removed';
    res.json({ success: true, message, data });
  })
);

router.put(
  '/biometric/settings',
  admins,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const s = await updateSettings(req.body);
    res.json({ success: true, message: 'Settings saved', data: { defaults: s.defaults, applyTypeAllowed: s.applyTypeAllowed } });
  })
);

// Master sheet import: preview validates every row and changes nothing; commit validates again and applies
router.post(
  '/biometric/import/preview',
  admins,
  sheetUpload,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = sheetFile(req);
    res.json({ success: true, data: await analyzeImport(file.buffer, file.originalname) });
  })
);

router.post(
  '/biometric/import/commit',
  admins,
  sheetUpload,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = sheetFile(req);
    const data = await commitImport(file.buffer, file.originalname, req.user);
    res.json({ success: true, message: `${data.results.applied} row(s) applied`, data });
  })
);

router.get(
  '/biometric/export',
  admins,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ids = String(req.query.ids || '').split(',').filter(Boolean);
    const file = await buildExport(String(req.query.format || 'xlsx').toLowerCase(), ids.length ? ids : undefined);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('X-Export-Rows', String(file.rows));
    res.send(file.buffer);
  })
);

// Queue the selected students for the machine. The response says what was queued, not what the machine did
router.post(
  '/biometric/push',
  admins,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const data = await queueStudentPush(req.body?.studentIds, { force: req.body?.force === true }, req.user);
    res.json({ success: true, data });
  })
);

router.get(
  '/biometric/review',
  admins,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: await getReviewQueue() });
  })
);

// Re-check unlinked punches against the current Biometric IDs (exact matches only)
router.post(
  '/biometric/review/rematch',
  admins,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const data = await rematchPunches();
    res.json({ success: true, message: `${data.linked} punch(es) linked`, data });
  })
);

// Read users and punches from the machine now (read-only); also runs every ESSL_PULL_INTERVAL_MINUTES
router.post(
  '/biometric/machine/pull',
  admins,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!isMachinePullConfigured()) throw new AppError('Set ESSL_DEVICE_HOST in the backend .env to read from the machine', 503, 'NOT_CONFIGURED');
    const data = await pullFromMachine('manual');
    if (!data.ok) throw new AppError(data.message, 502, 'MACHINE_READ_FAILED');
    res.json({ success: true, message: data.message, data });
  })
);

router.get(
  '/biometric/machine/status',
  admins,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const mode = isMachinePullConfigured() ? 'direct' : env.ESSL_AGENT_SECRET ? 'agent' : 'off';
    res.json({ success: true, data: { configured: mode !== 'off', mode, lastPull: getLastPull() } });
  })
);

router.get(
  '/biometric/logs',
  admins,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ success: true, data: await getSyncLogs(req.query as { level?: string; limit?: string }) });
  })
);

export default router;
