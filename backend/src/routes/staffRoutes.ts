import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { authenticateUser, authorizeRoles, AuthRequest, forgetStaffCheck } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { Notification } from '../models/Notification';
import { ProfilePhoto } from '../models/ProfilePhoto';
import { Course } from '../models/Course';
import { Batch } from '../models/tracking/Batch';

// Admin → Staff Access: admins create trainer and placement-team logins. The password is generated here,
// shown to the admin once, and only an admin can reset it. Staff cannot change their own password.
const router = Router();
router.use(authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN'));

const STAFF_ROLES = ['TRAINER', 'PLACEMENT_MANAGER', 'ADMIN'] as const;
type StaffRole = (typeof STAFF_ROLES)[number];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 12 characters from an alphabet without look-alikes (0/O, 1/l/I), always with a digit and a symbol
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const generatePassword = () => {
  const body = Array.from({ length: 9 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
  return `${body}@${crypto.randomInt(10)}${'!#$%&*'[crypto.randomInt(6)]}`;
};

const oid = (raw: unknown) => {
  const id = String(raw || '');
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid account', 400, 'INVALID_ID');
  return id;
};

const isSelf = (req: AuthRequest, user: { _id: unknown }) => String(user._id) === req.user?.userId;

// The LMS must always keep at least one admin who can log in
async function assertAnotherActiveAdmin(user: { _id: unknown; role: string }) {
  if (user.role !== 'ADMIN') return;
  const others = await User.countDocuments({ _id: { $ne: user._id }, role: { $in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: { $ne: false } });
  if (!others) throw new AppError('This is the only admin who can log in. Add another admin first.', 409, 'LAST_ADMIN');
}

async function staffAccount(id: string) {
  const user = await User.findById(oid(id));
  if (!user || !STAFF_ROLES.includes(user.role as StaffRole)) throw new AppError('Staff account not found', 404, 'NOT_FOUND');
  return user;
}

const audit = (req: AuthRequest, action: string, target: { _id: unknown; email: string; role: string }, extra: Record<string, unknown> = {}) =>
  AuditLog.create({
    userId: req.user?.userId,
    userEmail: req.user?.email,
    userRole: req.user?.role,
    action,
    resource: 'STAFF_ACCOUNT',
    metadata: { targetId: String(target._id), targetEmail: target.email, targetRole: target.role, ...extra },
    ipAddress: req.ip,
  }).catch(() => undefined);

const view = (u: any) => ({
  _id: u._id,
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  isActive: u.isActive !== false,
  createdAt: u.createdAt,
  passwordChangedAt: u.passwordChangedAt || u.createdAt,
  createdBy: u.createdById?.fullName || '',
});

router.get(
  '/',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const users = await User.find({ role: { $in: STAFF_ROLES } })
      .select('fullName email role isActive createdAt passwordChangedAt createdById')
      .populate('createdById', 'fullName')
      .sort({ role: 1, fullName: 1 })
      .lean();
    res.json({ success: true, data: { staff: users.map(view) } });
  })
);

// Create a trainer or placement-team login. The generated password is returned once and never stored in plain text
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const fullName = String(req.body?.fullName || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || '') as StaffRole;
    if (!fullName) throw new AppError('Enter the full name', 400, 'MISSING_FIELDS');
    if (!EMAIL_RE.test(email)) throw new AppError('Enter a valid email address; it is their login ID', 400, 'INVALID_EMAIL');
    if (!STAFF_ROLES.includes(role)) throw new AppError('Choose Admin, Trainer or Placement team', 400, 'INVALID_ROLE');
    if (await User.exists({ email })) throw new AppError('An account with this email already exists', 409, 'DUPLICATE');

    const password = generatePassword();
    const user = await User.create({
      fullName,
      email,
      role,
      passwordHash: await bcrypt.hash(password, 10),
      isVerified: true,
      isActive: true,
      passwordChangedAt: new Date(),
      createdById: req.user?.userId,
    });
    await audit(req, 'STAFF_CREATED', user);
    res.status(201).json({ success: true, message: `${fullName} can now log in`, data: { staff: view(user), password } });
  })
);

// New generated password; every existing session of that person ends
router.post(
  '/:id/reset-password',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await staffAccount(String(req.params.id));
    if (isSelf(req, user)) throw new AppError('Change your own password on Login & Password', 400, 'SELF_RESET');
    const password = generatePassword();
    user.passwordHash = await bcrypt.hash(password, 10);
    user.passwordChangedAt = new Date();
    user.refreshToken = undefined;
    await user.save();
    forgetStaffCheck(String(user._id));
    await audit(req, 'STAFF_PASSWORD_RESET', user);
    res.json({ success: true, message: `New password generated for ${user.fullName}`, data: { staff: view(user), password } });
  })
);

// Rename, change role, or remove / restore access (removing logs them out within seconds)
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await staffAccount(String(req.params.id));
    const { fullName, role, isActive, email } = req.body || {};
    const changes: Record<string, unknown> = {};
    const demoting = role !== undefined && role !== user.role && user.role === 'ADMIN';
    const disabling = isActive === false && user.isActive !== false;
    if ((demoting || disabling) && isSelf(req, user)) throw new AppError('You cannot remove your own admin access', 400, 'SELF_CHANGE');
    if (demoting || disabling) await assertAnotherActiveAdmin(user);
    if (typeof fullName === 'string' && fullName.trim() && fullName.trim() !== user.fullName) {
      changes.fullName = user.fullName = fullName.trim();
    }
    // New login email; the password stays the same
    if (typeof email === 'string' && email.trim().toLowerCase() !== user.email) {
      const next = email.trim().toLowerCase();
      if (isSelf(req, user)) throw new AppError('Change your own login email on Login & Password', 400, 'SELF_CHANGE');
      if (!EMAIL_RE.test(next)) throw new AppError('Enter a valid email address', 400, 'INVALID_EMAIL');
      if (await User.exists({ email: next, _id: { $ne: user._id } })) throw new AppError('Another account already uses this email', 409, 'DUPLICATE');
      changes.email = next;
      changes.previousEmail = user.email;
      user.email = next;
    }
    if (role !== undefined && role !== user.role) {
      if (!STAFF_ROLES.includes(role)) throw new AppError('Choose Admin, Trainer or Placement team', 400, 'INVALID_ROLE');
      changes.role = user.role = role;
    }
    if (typeof isActive === 'boolean' && isActive !== (user.isActive !== false)) {
      changes.isActive = user.isActive = isActive;
      if (!isActive) user.refreshToken = undefined;
    }
    await user.save();
    forgetStaffCheck(String(user._id));
    if (Object.keys(changes).length) {
      await audit(req, changes.isActive === false ? 'STAFF_ACCESS_REMOVED' : changes.isActive === true ? 'STAFF_ACCESS_RESTORED' : 'STAFF_UPDATED', user, changes);
    }
    const message =
      changes.isActive === false
        ? `${user.fullName} can no longer log in`
        : changes.isActive === true
          ? `${user.fullName} can log in again`
          : changes.email
            ? `${user.fullName} now logs in with ${user.email} (same password)`
            : 'Saved';
    res.json({ success: true, message, data: { staff: view(user) } });
  })
);

// Permanently delete a staff login. Only after their access was removed, so an active account can't be
// deleted by a mis-click. Their history (jobs, banners, attendance taken, pushed students) stays.
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = await staffAccount(String(req.params.id));
    if (String(user._id) === req.user?.userId) throw new AppError('You cannot delete your own account', 400, 'SELF_DELETE');
    if (user.isActive !== false) throw new AppError('Remove their access first, then delete the account', 409, 'STILL_ACTIVE');
    const id = user._id;
    await Promise.all([
      Notification.deleteMany({ userId: id }),
      ProfilePhoto.deleteOne({ userId: id }),
      Batch.updateMany({ trainerId: id }, { $unset: { trainerId: 1 } }),
      Course.updateMany({ assignedTrainerIds: id }, { $pull: { assignedTrainerIds: id } }),
    ]);
    await user.deleteOne();
    forgetStaffCheck(String(id));
    await audit(req, 'STAFF_DELETED', user, { fullName: user.fullName });
    res.json({ success: true, message: `${user.fullName}'s login was deleted` });
  })
);

export default router;
