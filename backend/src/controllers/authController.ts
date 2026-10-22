import { Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { Resume } from '../models/Resume';
import { getNextStudentId } from '../models/Counter';
import { env } from '../config/env';
import { AuthRequest, forgetStaffCheck } from '../middleware/auth';
import { AuditLog } from '../models/AuditLog';
import { AppError } from '../middleware/errorHandler';
import { assignENumberQuietly } from '../services/esslService';

function generateTokens(payload: any) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1d' });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password, fullName, college, degree, branch, preferredRole } = req.body;
  // Public sign-up only ever creates students. Staff accounts are created by an admin (Admin → Staff Access)
  const role = 'STUDENT';

  if (!email || !password || !fullName) {
    throw new AppError('Email, password, and full name are required', 400, 'MISSING_FIELDS');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('An account with this email already exists. Please Sign In using your password, or use a different email.', 400, 'USER_EXISTS');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  let newUser: any;
  let studentId: string | undefined;
  let studentDoc: any;

  // Wrap User + Student + Resume creation in a transaction so a mid-way failure
  // (e.g. a transient DB blip) can never leave an orphaned User with no Student profile.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const createdUsers = await User.create(
        [
          {
            email: normalizedEmail,
            passwordHash,
            fullName,
            role: role as any,
            isVerified: true,
          },
        ],
        { session }
      );
      newUser = createdUsers[0];

      if (newUser.role === 'STUDENT') {
        studentId = await getNextStudentId(session);
        const createdStudents = await Student.create(
          [
            {
              userId: newUser._id,
              studentId,
              college: college || '',
              degree: degree || 'B.Tech',
              branch: branch || '',
              preferredRole: preferredRole || 'DevOps & Infrastructure',
              graduationYear: 2026,
              cgpa: 8.5,
            },
          ],
          { session }
        );
        studentDoc = createdStudents[0];

        // Auto-create default ATS Resume record for student
        await Resume.create(
          [
            {
              studentId: studentDoc._id,
              title: `${newUser.fullName} Profile Resume`,
              versionName: 'Primary Profile Version',
              template: 'MODERN',
              isDefault: true,
              data: {
                fullName: newUser.fullName,
                email: newUser.email,
                phone: '+91 98765 43210',
                location: 'India',
                summary: `Student pursuing ${degree || 'B.Tech'}${branch ? ` in ${branch}` : ''}${college ? ` at ${college}` : ''}.`,
                skills: ['Python', 'JavaScript', 'React', 'SQL', 'Git'],
                experience: [],
                education: [
                  {
                    institution: college || '',
                    degree: degree || 'B.Tech',
                    fieldOfStudy: branch || '',
                    startDate: '2022',
                    endDate: '2026',
                    grade: 'CGPA: 8.5',
                  },
                ],
                projects: [],
                certifications: [],
              },
            },
          ],
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  // E Number = Biometric ID on the eSSL machine, assigned once the account exists
  if (studentDoc) await assignENumberQuietly(studentDoc._id);

  const tokenPayload = {
    userId: newUser._id.toString(),
    email: newUser.email,
    role: newUser.role,
    fullName: newUser.fullName,
    studentId,
    studentMongoId: studentDoc?._id?.toString(),
  };

  const tokens = generateTokens(tokenPayload);

  newUser.refreshToken = tokens.refreshToken;
  await newUser.save();

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user: {
        id: newUser._id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        studentId,
      },
      tokens,
    },
  });
};

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
