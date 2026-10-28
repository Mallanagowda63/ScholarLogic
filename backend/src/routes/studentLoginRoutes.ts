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
  };
};

const findStudents = (filter: Record<string, unknown>) =>
  Student.find(filter)
    .select('studentId biometricId phone enrollment enrollmentDate createdAt userId +loginPassword')
    .populate('userId', 'fullName email isActive avatarUrl')
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

export default router;
