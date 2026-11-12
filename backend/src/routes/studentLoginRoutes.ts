import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { authenticateUser, authorizeRoles, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { ProfilePhoto } from '../models/ProfilePhoto';
import '../models/tracking/TrackCourse';
import { openPassword, sealPassword } from '../utils/credentialVault';
import { PLACEHOLDER_EMAIL_DOMAIN } from '../services/trackingService';
import { emailService } from '../services/emailService';
import { env } from '../config/env';

// Link in the email: the live site, even when this runs on a laptop with a localhost FRONTEND_URL
const siteUrl = () => (/localhost|127.0.0.1/.test(env.FRONTEND_URL) ? 'https://scholarlogiclms.in' : env.FRONTEND_URL);

/**
 * Admin → Student Login & ID Card: check a student's ID card and see (or create) their login.
 * Separate from eSSL verification: works for every student, machine code linked or not.
 */
const router = Router();
router.use(authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN'));

// Same shape as the passwords handed out before: no look-alike characters, ends with @ and a digit
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const generatePassword = () => `${Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')}@${crypto.randomInt(10)}`;

const card = (s: any, hasPhoto: boolean) => {
  const email = s.userId?.email || '';
  return {
    _id: s._id,
    fullName: s.userId?.fullName || '',
    studentId: s.studentId,
    // Students sign in with the machine code when they have one, otherwise with the Student ID
    loginId: s.biometricId || s.studentId,
    machineCode: s.biometricId || '',
    email: email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`) ? '' : email,
    phone: s.phone || '',
    course: s.enrollment?.courseId?.name || '',
    mode: s.enrollment?.mode || '',
    status: s.enrollment?.status || 'ACTIVE',
    joined: s.enrollment?.joiningDate || s.enrollmentDate || s.createdAt,
    loginActive: s.userId?.isActive !== false,
    photoUrl: hasPhoto ? `/api/auth/photo/${s.userId?._id}` : s.userId?.avatarUrl && !/unsplash/.test(s.userId.avatarUrl) ? s.userId.avatarUrl : '',
    password: openPassword(s.loginPassword),
    // Login tracking started 2026-11-12; a saved session token means they signed in before that too
    lastLoginAt: s.userId?.lastLoginAt || null,
    loginCount: s.userId?.loginCount || 0,
    hasLoggedIn: !!(s.userId?.lastLoginAt || s.userId?.refreshToken),
    loginSharedAt: s.loginSharedAt || null,
  };
};

const findStudents = (filter: Record<string, unknown>) =>
  Student.find(filter)
    .select('studentId biometricId phone enrollment enrollmentDate createdAt userId loginSharedAt +loginPassword')
    .populate('userId', 'fullName email isActive avatarUrl lastLoginAt loginCount refreshToken')
    .populate('enrollment.courseId', 'name')
    .sort({ studentId: 1 })
    .lean();

const withPhotos = async (students: any[]) => {
  const ids = students.map((s) => s.userId?._id).filter(Boolean);
  const photos = new Set((await ProfilePhoto.find({ userId: { $in: ids } }).select('userId').lean()).map((p) => String(p.userId)));
  return students.map((s) => card(s, photos.has(String(s.userId?._id))));
};

// Every student, for the search list
router.get(
  '/',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({ success: true, data: { students: await withPhotos(await findStudents({})) } });
  })
);

// The ID on a card (Student ID or machine code, any letter case): exactly one student or not found
router.get(
  '/check/:code',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const code = String(req.params.code || '').trim();
    if (!code) throw new AppError('Type the ID printed on the card', 400, 'MISSING_FIELDS');
    const found = await findStudents({ $or: [{ studentId: code.toUpperCase() }, { biometricId: { $in: [code, code.toUpperCase()] } }] });
    if (!found.length) throw new AppError(`No student has the ID ${code}. This card is not in ScholarLogic.`, 404, 'NOT_FOUND');
    res.json({ success: true, data: { student: (await withPhotos(found))[0] } });
  })
);

// New automatic password: replaces the old one, so the student must use this from now on
router.post(
  '/:id/generate-password',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid student', 400, 'INVALID_ID');
    const student = await Student.findById(req.params.id).select('studentId biometricId userId');
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
    const user = await User.findOne({ _id: student.userId, role: 'STUDENT' });
    if (!user) throw new AppError('This student has no login account', 404, 'NO_LOGIN');
    const password = generatePassword();
    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
    await Student.updateOne({ _id: student._id }, { $set: { loginPassword: sealPassword(password) } });
    await AuditLog.create({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      action: 'STUDENT_PASSWORD_GENERATED',
      resource: 'STUDENT',
      metadata: { studentId: student.studentId },
      ipAddress: req.ip,
    }).catch(() => undefined);
    res.json({
      success: true,
      message: `New password created for ${user.fullName}`,
      data: { loginId: student.biometricId || student.studentId, password },
    });
  })
);

// Email each selected student their own login ID and password. The page sends small groups (max 25)
// and shows progress, so one request never runs long. Resend allows about 2 emails per second.
router.post(
  '/send-email',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter((id: string) => mongoose.isValidObjectId(id)) : [];
    if (!ids.length) throw new AppError('Select at least one student', 400, 'MISSING_FIELDS');
    if (ids.length > 25) throw new AppError('Send at most 25 at a time', 400, 'TOO_MANY');
    const students = await findStudents({ _id: { $in: ids } });
    const results: { _id: string; fullName: string; status: 'SENT' | 'SKIPPED' | 'FAILED'; reason?: string; loginSharedAt?: Date }[] = [];
    for (const s of students as any[]) {
      const c = card(s, false);
      if (!c.email) {
        results.push({ _id: String(s._id), fullName: c.fullName, status: 'SKIPPED', reason: 'No email address' });
        continue;
      }
      if (!c.password) {
        results.push({ _id: String(s._id), fullName: c.fullName, status: 'SKIPPED', reason: 'No password on record' });
        continue;
      }
      try {
        await emailService.sendLoginCredentialsEmail(c.email, c.fullName, c.loginId, c.password, siteUrl());
        const at = new Date();
        await Student.updateOne({ _id: s._id }, { $set: { loginSharedAt: at } });
        results.push({ _id: String(s._id), fullName: c.fullName, status: 'SENT', loginSharedAt: at });
      } catch (err: any) {
        results.push({ _id: String(s._id), fullName: c.fullName, status: 'FAILED', reason: String(err?.message || err).slice(0, 200) });
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    const sent = results.filter((r) => r.status === 'SENT');
    if (sent.length) {
      await AuditLog.create({
        userId: req.user?.userId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        action: 'STUDENT_LOGIN_SHARED',
        resource: 'STUDENT',
        metadata: { via: 'EMAIL', count: sent.length, studentIds: (students as any[]).filter((s) => sent.some((r) => r._id === String(s._id))).map((s) => s.studentId) },
        ipAddress: req.ip,
      }).catch(() => undefined);
    }
    res.json({ success: true, data: { results } });
  })
);

// The admin sent the login details to the student (e.g. opened WhatsApp with them): remember when
router.post(
  '/:id/shared',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid student', 400, 'INVALID_ID');
    const via = String(req.body?.via || 'WHATSAPP').slice(0, 20);
    const student = await Student.findByIdAndUpdate(req.params.id, { $set: { loginSharedAt: new Date() } }, { new: true }).select('studentId loginSharedAt');
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
    await AuditLog.create({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      action: 'STUDENT_LOGIN_SHARED',
      resource: 'STUDENT',
      metadata: { studentId: student.studentId, via },
      ipAddress: req.ip,
    }).catch(() => undefined);
    res.json({ success: true, data: { loginSharedAt: student.loginSharedAt } });
  })
);

export default router;
