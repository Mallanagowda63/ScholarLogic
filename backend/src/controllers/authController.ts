import { Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { env } from '../config/env';
import { AuthRequest, forgetStaffCheck } from '../middleware/auth';
import { AuditLog } from '../models/AuditLog';
import { AppError } from '../middleware/errorHandler';

function generateTokens(payload: any) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1d' });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// Public self-registration was removed: students are created from the Google Form (admin Verify) or the
// eSSL machine import, and staff by an admin on Staff Access.

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email / Student ID and password are required', 400, 'MISSING_FIELDS');
  }

  // The identifier may be an email, a Student ID, or the student's machine code from eSSL (e.g. SCLR245)
  const identifier = String(email).trim();
  let user;
  if (identifier.includes('@')) {
    user = await User.findOne({ email: identifier.toLowerCase() });
  } else {
    const student =
      (await Student.findOne({ studentId: identifier.toUpperCase() }).select('userId')) ||
      (await Student.findOne({ biometricId: { $in: [identifier, identifier.toUpperCase()] } }).select('userId'));
    user = student ? await User.findById(student.userId) : null;
  }
  if (!user) {
    throw new AppError('No account found with this email, Student ID or machine code.', 401, 'INVALID_CREDENTIALS');
  }

  if (user.isActive === false) {
    throw new AppError('Your access has been removed. Please contact the admin.', 403, 'ACCESS_REMOVED');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Incorrect password. Please check your password and try again.', 401, 'INVALID_CREDENTIALS');
  }

  let studentId: string | undefined;
  let studentMongoId: string | undefined;

  if (user.role === 'STUDENT') {
    const student = await Student.findOne({ userId: user._id });
    if (student) {
      studentId = student.studentId;
      studentMongoId = student._id.toString();
    }
  }

  const tokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    studentId,
    studentMongoId,
  };

  const tokens = generateTokens(tokenPayload);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        studentId,
        avatarUrl: user.avatarUrl,
      },
      tokens,
    },
  });
};

export const refreshToken = async (req: AuthRequest, res: Response): Promise<void> => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw new AppError('Refresh token required', 400, 'TOKEN_REQUIRED');
  }

  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as any;
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== token || user.isActive === false) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    let studentId: string | undefined;
    if (user.role === 'STUDENT') {
      const student = await Student.findOne({ userId: user._id });
      if (student) studentId = student.studentId;
    }

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      studentId,
    };

    const tokens = generateTokens(payload);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    res.json({
      success: true,
      data: { tokens },
    });
  } catch (err: any) {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const user = await User.findById(req.user.userId).select('-passwordHash -refreshToken');
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  let studentProfile = null;
  if (user.role === 'STUDENT') {
    studentProfile = await Student.findOne({ userId: user._id });
  }

  res.json({
    success: true,
    data: {
      user,
      studentProfile,
    },
  });
};

/**
 * Admins change their own login email and/or password (current password required).
 * Trainers, the placement team and students cannot change theirs; an admin resets those.
 * A new password signs out the admin's other sessions; this one gets fresh tokens.
 */
export const updateMyCredentials = async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newEmail, newPassword } = req.body || {};
  const user = await User.findById(req.user!.userId);
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw new AppError('Only admins can change their login here', 403, 'FORBIDDEN');
  if (!currentPassword || !(await user.comparePassword(String(currentPassword)))) {
    throw new AppError('Your current password is not correct', 400, 'WRONG_PASSWORD');
  }

  const changed: string[] = [];
  const email = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : '';
  if (email && email !== user.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Enter a valid email address', 400, 'INVALID_EMAIL');
    if (await User.exists({ email, _id: { $ne: user._id } })) throw new AppError('Another account already uses this email', 409, 'DUPLICATE');
    user.email = email;
    changed.push('email');
  }
  if (typeof newPassword === 'string' && newPassword) {
    const pw = newPassword;
    if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
      throw new AppError('The new password needs at least 10 characters, with letters and numbers', 400, 'WEAK_PASSWORD');
    }
    if (pw === String(currentPassword)) throw new AppError('The new password must be different from the current one', 400, 'SAME_PASSWORD');
    if (/^(admin|password|scholarlogic)@?123/i.test(pw)) throw new AppError('Choose a password that is harder to guess', 400, 'WEAK_PASSWORD');
    user.passwordHash = await bcrypt.hash(pw, 10);
    user.passwordChangedAt = new Date();
    changed.push('password');
  }
  if (!changed.length) throw new AppError('Enter a new email or a new password', 400, 'NOTHING_TO_CHANGE');

  const payload = { userId: user._id.toString(), email: user.email, role: user.role, fullName: user.fullName };
  const tokens = generateTokens(payload);
  user.refreshToken = tokens.refreshToken;
  await user.save();
  forgetStaffCheck(user._id.toString());
  await AuditLog.create({
    userId: user._id,
    userEmail: user.email,
    userRole: user.role,
    action: 'ADMIN_CREDENTIALS_CHANGED',
    resource: 'ACCOUNT',
    metadata: { changed },
    ipAddress: req.ip,
  }).catch(() => undefined);

  res.json({
    success: true,
    message: `Your ${changed.join(' and ')} ${changed.length > 1 ? 'were' : 'was'} changed`,
    data: { user: { id: user._id, email: user.email, fullName: user.fullName, role: user.role }, tokens },
  });
};

// ---------------------------------------------------------------------------
// My Profile (admins, trainers, placement team): name and contact/work details only.
// Email (the login ID), password and role are never changed here.
// ---------------------------------------------------------------------------
const PROFILE_FIELDS = ['phone', 'designation', 'department', 'specialization', 'experience', 'bio'] as const;
const PROFILE_LIMITS: Record<(typeof PROFILE_FIELDS)[number], number> = { phone: 20, designation: 80, department: 80, specialization: 120, experience: 40, bio: 600 };

const profileView = (u: any) => ({
  fullName: u.fullName,
  email: u.email,
  role: u.role,
  profile: Object.fromEntries(PROFILE_FIELDS.map((k) => [k, u.profile?.[k] || ''])),
});

export const getMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user!.userId).select('fullName email role profile').lean();
  if (!user) throw new AppError('Account not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: profileView(user) });
};

export const updateMyProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user!.userId);
  if (!user) throw new AppError('Account not found', 404, 'NOT_FOUND');
  const body = req.body || {};
  if (body.email !== undefined || body.password !== undefined || body.newPassword !== undefined || body.role !== undefined) {
    throw new AppError('Your login email, password and role can only be changed by an admin', 403, 'NOT_ALLOWED');
  }
  if (body.fullName !== undefined) {
    const name = String(body.fullName).trim();
    if (name.length < 2 || name.length > 80) throw new AppError('Enter your full name (2 to 80 characters)', 400, 'INVALID_NAME');
    user.fullName = name;
  }
  const profile: any = user.profile ? { ...(user.profile as any).toObject?.() ?? user.profile } : {};
  for (const k of PROFILE_FIELDS) {
    if (body[k] === undefined) continue;
    const v = String(body[k] ?? '').trim();
    if (v.length > PROFILE_LIMITS[k]) throw new AppError(`${k} is too long (max ${PROFILE_LIMITS[k]} characters)`, 400, 'TOO_LONG');
    if (k === 'phone' && v && !/^[+\d][\d\s-]{6,19}$/.test(v)) throw new AppError('Enter a valid phone number', 400, 'INVALID_PHONE');
    profile[k] = v;
  }
  user.profile = profile;
  await user.save();
  res.json({ success: true, message: 'Profile saved', data: profileView(user) });
};
