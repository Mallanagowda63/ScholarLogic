import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, authorizeRoles, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { IdCardSubmission } from '../models/IdCardSubmission';
import { getLastIdCardSync, isIdCardSyncConfigured, sendLoginFor, syncIdCardForm } from '../services/idCardFormService';

/** Admin → ID Card Form: answers to the "Student info" form, which ones got their login, and the ones to check */
const router = Router();
router.use(authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN'));

const view = (s: any) => ({
  _id: s._id,
  submittedAt: s.submittedAt,
  name: s.name,
  phone: s.phone,
  email: s.email,
  course: s.course,
  education: s.education,
  idCardRaw: s.idCardRaw,
  idCardCode: s.idCardCode,
  idCardPicUrl: s.idCardPicUrl,
  status: s.status,
  note: s.note,
  loginId: s.loginId,
  emailedTo: s.emailedTo,
  emailedAt: s.emailedAt,
  student: s.studentId
    ? { _id: s.studentId._id, studentId: s.studentId.studentId, fullName: s.studentId.userId?.fullName || '', phone: s.studentId.phone || '' }
    : null,
});

router.get(
  '/',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const subs = await IdCardSubmission.find({})
      .sort({ submittedAt: -1 })
      .limit(1000)
      .populate({ path: 'studentId', select: 'studentId phone userId', populate: { path: 'userId', select: 'fullName' } })
      .lean();
    res.json({ success: true, data: { submissions: subs.map(view), connected: isIdCardSyncConfigured(), lastSync: getLastIdCardSync() } });
  })
);

router.post(
  '/sync',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const result = await syncIdCardForm('manual');
    if (!result.ok) throw new AppError(result.message, 502, 'SYNC_FAILED');
    res.json({ success: true, message: result.message, data: { result } });
  })
);

// Admin checked the answer: email the login to the chosen student (or the matched one)
router.post(
  '/:id/send',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid answer', 400, 'INVALID_ID');
    const sub = await IdCardSubmission.findById(req.params.id);
    if (!sub) throw new AppError('Answer not found', 404, 'NOT_FOUND');
    const studentId = String(req.body?.studentId || sub.studentId || '');
    if (!mongoose.isValidObjectId(studentId)) throw new AppError('Choose the student this answer belongs to', 400, 'MISSING_FIELDS');
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (email) sub.email = email;
    try {
      await sendLoginFor(sub, studentId, req.user?.userId);
    } catch (err: any) {
      throw new AppError(String(err?.message || err), 400, 'SEND_FAILED');
    }
    res.json({ success: true, message: `Login emailed to ${sub.emailedTo}`, data: { submission: { status: sub.status, note: sub.note, emailedTo: sub.emailedTo, emailedAt: sub.emailedAt, loginId: sub.loginId } } });
  })
);

router.post(
  '/:id/ignore',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid answer', 400, 'INVALID_ID');
    const sub = await IdCardSubmission.findById(req.params.id);
    if (!sub) throw new AppError('Answer not found', 404, 'NOT_FOUND');
    if (sub.status === 'SENT') throw new AppError('This login was already sent', 400, 'ALREADY_SENT');
    sub.status = 'IGNORED';
    sub.note = `Dismissed by an admin. Before: ${sub.note}`.slice(0, 500);
    if (req.user?.userId) sub.reviewedById = new mongoose.Types.ObjectId(req.user.userId);
    await sub.save();
    res.json({ success: true, data: { submission: { status: sub.status, note: sub.note } } });
  })
);

export default router;
