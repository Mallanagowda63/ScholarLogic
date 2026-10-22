import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { authenticateUser, authorizeRoles, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { Student } from '../models/Student';
import { TrackCourse } from '../models/tracking/TrackCourse';
import { Batch } from '../models/tracking/Batch';
import { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } from '../models/tracking/StudentBatchAllocation';
import { OnlineAttendance } from '../models/OnlineAttendance';

/**
 * Online students mark attendance by scanning the QR code on their dashboard with their phone.
 * The QR holds a short-lived signed link (it changes every minute), so a screenshot shared later
 * does not work. Separate from eSSL punches; one record per student per day.
 */
const router = Router();

const QR_TTL_SECONDS = 120;
const TOKEN_TYPE = 'online-attendance';
const todayIST = () => new Date(Date.now() + env.BIOMETRIC_TZ_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);

// Who the student is, as shown on the check-in page and saved with the attendance
async function studentCard(studentMongoId: string) {
  const s: any = await Student.findById(studentMongoId).select('studentId phone college enrollment userId').populate('userId', 'fullName').lean();
  if (!s) throw new AppError('Student not found', 404, 'NOT_FOUND');
  const course: any = s.enrollment?.courseId ? await TrackCourse.findById(s.enrollment.courseId).select('name').lean() : null;
  const allocations = await StudentBatchAllocation.find({ studentId: s._id, status: { $in: ACTIVE_ALLOCATION_STATUSES } }).select('batchId').lean();
  const batches: any[] = await Batch.find({ _id: { $in: allocations.map((a) => a.batchId) } }).select('batchCode timing').lean();
  return {
    _id: String(s._id),
    studentId: s.studentId,
    fullName: s.userId?.fullName || '',
    mode: s.enrollment?.mode || 'OFFLINE',
    course: course?.name || '',
    batches: batches.map((b) => ({ code: b.batchCode, timing: b.timing })),
  };
}

function readToken(raw: unknown) {
  try {
    const p = jwt.verify(String(raw || ''), env.JWT_SECRET) as any;
    if (p.typ !== TOKEN_TYPE || !mongoose.isValidObjectId(p.sid)) throw new Error('wrong type');
    if (p.day !== todayIST()) throw new AppError('This QR code is from another day. Open your dashboard and scan the new one.', 410, 'QR_EXPIRED');
    return p as { sid: string; day: string };
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err?.name === 'TokenExpiredError') throw new AppError('This QR code has expired. Scan the code on your dashboard again (it changes every minute).', 410, 'QR_EXPIRED');
    throw new AppError('This QR code is not valid. Scan the code on your ScholarLogic dashboard.', 400, 'QR_INVALID');
  }
}

// ---- Student: QR code for today, today's status, history ----
router.get(
  '/qr',
  authenticateUser,
  authorizeRoles('STUDENT'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const student = await Student.findOne({ userId: req.user!.userId }).select('_id enrollment');
    if (!student) throw new AppError('Student profile not found', 404, 'STUDENT_NOT_FOUND');
    if (student.enrollment?.mode !== 'ONLINE') throw new AppError('QR attendance is for online students only', 403, 'NOT_ONLINE');
    const day = todayIST();
    const today = await OnlineAttendance.findOne({ studentId: student._id, localDate: day }).lean();
    const token = jwt.sign({ typ: TOKEN_TYPE, sid: String(student._id), day }, env.JWT_SECRET, { expiresIn: QR_TTL_SECONDS });
    res.json({
      success: true,
      data: {
        checkInUrl: `${env.FRONTEND_URL.replace(/\/+$/, '')}/attendance/check-in?t=${encodeURIComponent(token)}`,
        expiresInSeconds: QR_TTL_SECONDS,
        today: day,
        markedToday: today ? { checkedInAt: today.checkedInAt, topic: today.topic } : null,
      },
    });
  })
);

router.get(
  '/me',
  authenticateUser,
  authorizeRoles('STUDENT'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const student = await Student.findOne({ userId: req.user!.userId }).select('_id');
    if (!student) throw new AppError('Student profile not found', 404, 'STUDENT_NOT_FOUND');
    const records = await OnlineAttendance.find({ studentId: student._id }).sort({ localDate: -1 }).limit(120).select('localDate checkedInAt topic').lean();
    const month = todayIST().slice(0, 7);
    res.json({ success: true, data: { records, thisMonth: records.filter((r) => r.localDate.startsWith(month)).length } });
  })
);

// ---- Phone after scanning (no login needed: the signed QR link identifies the student) ----
router.get(
  '/check-in',
  asyncHandler(async (req: Request, res: Response) => {
    const { sid, day } = readToken(req.query.t);
    const card = await studentCard(sid);
    const already = await OnlineAttendance.findOne({ studentId: sid, localDate: day }).select('checkedInAt topic').lean();
    res.json({ success: true, data: { student: card, date: day, alreadyMarked: already ? { checkedInAt: already.checkedInAt, topic: already.topic } : null } });
  })
);

router.post(
  '/check-in',
  asyncHandler(async (req: Request, res: Response) => {
    const { sid, day } = readToken(req.body?.t);
    const topic = String(req.body?.topic || '').trim();
    const note = String(req.body?.note || '').trim().slice(0, 500);
    if (topic.length < 3) throw new AppError('Write the class or topic you attended today', 400, 'TOPIC_REQUIRED');
    if (req.body?.confirm !== true) throw new AppError('Tick the box to confirm you attended today', 400, 'CONFIRM_REQUIRED');
    const card = await studentCard(sid);
    if (card.mode !== 'ONLINE') throw new AppError('QR attendance is for online students only', 403, 'NOT_ONLINE');

    const existing = await OnlineAttendance.findOne({ studentId: sid, localDate: day }).lean();
    if (existing) {
      res.json({ success: true, message: 'Attendance was already marked today', data: { alreadyMarked: true, checkedInAt: existing.checkedInAt, topic: existing.topic } });
      return;
    }
    try {
      const rec = await OnlineAttendance.create({
        studentId: sid,
        localDate: day,
        checkedInAt: new Date(),
        topic: topic.slice(0, 200),
        note,
        courseName: card.course,
        batchCodes: card.batches.map((b) => b.code),
        ipAddress: req.ip || '',
        userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      });
      res.status(201).json({ success: true, message: 'Attendance marked', data: { alreadyMarked: false, checkedInAt: rec.checkedInAt, topic: rec.topic } });
    } catch (err: any) {
      // Two quick submits: the unique index keeps one record
      if (err?.code === 11000) {
        res.json({ success: true, message: 'Attendance was already marked today', data: { alreadyMarked: true } });
        return;
      }
      throw err;
    }
  })
);

// ---- Staff: who marked online attendance on a day ----
router.get(
  '/',
  authenticateUser,
  authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.date || '')) ? String(req.query.date) : todayIST();
    const [records, onlineStudents]: [any[], any[]] = await Promise.all([
      OnlineAttendance.find({ localDate: date }).sort({ checkedInAt: 1 }).populate({ path: 'studentId', select: 'studentId userId', populate: { path: 'userId', select: 'fullName' } }).lean(),
      Student.find({ 'enrollment.mode': 'ONLINE' }).select('studentId userId').populate('userId', 'fullName').lean(),
    ]);
    const marked = new Set(records.map((r) => String(r.studentId?._id)));
    res.json({
      success: true,
      data: {
        date,
        present: records.map((r) => ({
          _id: r._id,
          studentId: r.studentId?.studentId,
          fullName: r.studentId?.userId?.fullName || '',
          checkedInAt: r.checkedInAt,
          topic: r.topic,
          note: r.note,
          course: r.courseName,
          batches: r.batchCodes,
        })),
        notMarked: onlineStudents.filter((s) => !marked.has(String(s._id))).map((s) => ({ studentId: s.studentId, fullName: s.userId?.fullName || '' })),
      },
    });
  })
);

export default router;
