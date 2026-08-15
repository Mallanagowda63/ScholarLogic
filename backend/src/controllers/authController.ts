import { Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { Resume } from '../models/Resume';
import { getNextStudentId } from '../models/Counter';
import { env } from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

function generateTokens(payload: any) {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1d' });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  const { email, password, fullName, role = 'STUDENT', college, degree, branch, preferredRole } = req.body;

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

  const newUser = await User.create({
    email: normalizedEmail,
    passwordHash,
    fullName,
    role: role as any,
    isVerified: true,
  });

  let studentId: string | undefined;
  let studentDoc: any;

  if (newUser.role === 'STUDENT') {
    studentId = await getNextStudentId();
    studentDoc = await Student.create({
      userId: newUser._id,
      studentId,
      college: college || 'ScholarLogic Institute of Technology',
      degree: degree || 'B.Tech',
      branch: branch || 'Computer Science & Engineering',
      preferredRole: preferredRole || 'DevOps & Infrastructure',
      graduationYear: 2026,
      cgpa: 8.5,
    });

    // Auto-create default ATS Resume record for student
    await Resume.create({
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
        summary: `Student pursuing ${degree || 'B.Tech'} in ${branch || 'Computer Science & Engineering'} at ${college || 'ScholarLogic Institute of Technology'}.`,
        skills: ['Python', 'JavaScript', 'React', 'SQL', 'Git'],
        experience: [],
        education: [
          {
            institution: college || 'ScholarLogic Institute of Technology',
            degree: degree || 'B.Tech',
            fieldOfStudy: branch || 'Computer Science & Engineering',
            startDate: '2022',
            endDate: '2026',
            grade: 'CGPA: 8.5',
          },
        ],
        projects: [],
        certifications: [],
      },
    });
  }

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
    throw new AppError('Email and password are required', 400, 'MISSING_FIELDS');
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new AppError('No account found with this email address. Please register a new account.', 401, 'INVALID_CREDENTIALS');
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

    if (!user || user.refreshToken !== token) {
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
