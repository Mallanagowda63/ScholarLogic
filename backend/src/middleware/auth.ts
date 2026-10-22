import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/User';
import { Student } from '../models/Student';
import { User } from '../models/User';

// Staff accounts can be switched off or have their password reset by an admin. Their sessions are checked
// against the database (cached briefly) so that takes effect within seconds, not when the token expires.
const STAFF_CHECK_MS = 15000;
const staffChecks = new Map<string, { at: number; ok: boolean; role?: string; changedAt?: number }>();
export const forgetStaffCheck = (userId: string) => staffChecks.delete(userId);

async function staffSessionValid(decoded: AuthUserPayload & { iat?: number }) {
  if (decoded.role === 'STUDENT') return true;
  let entry = staffChecks.get(decoded.userId);
  if (!entry || Date.now() - entry.at > STAFF_CHECK_MS) {
    const u: any = await User.findById(decoded.userId).select('isActive role passwordChangedAt').lean();
    entry = { at: Date.now(), ok: !!u && u.isActive !== false, role: u?.role, changedAt: u?.passwordChangedAt ? new Date(u.passwordChangedAt).getTime() : 0 };
    staffChecks.set(decoded.userId, entry);
  }
  if (!entry.ok || entry.role !== decoded.role) return false;
  // A token issued before the password was reset belongs to the old password
  return !(entry.changedAt && decoded.iat && decoded.iat * 1000 < entry.changedAt - 1000);
}

export interface AuthUserPayload {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
  studentId?: string;
  studentMongoId?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUserPayload;
}

export const authenticateUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication token missing or invalid',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;

    if (!(await staffSessionValid(decoded))) {
      res.status(401).json({ success: false, message: 'Your session has ended. Please sign in again.', code: 'SESSION_REVOKED' });
      return;
    }

    if (decoded.role === 'STUDENT' && !decoded.studentId) {
      const student = await Student.findOne({ userId: decoded.userId });
      if (student) {
        decoded.studentId = student.studentId;
        decoded.studentMongoId = student._id.toString();
      }
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
      code: 'INVALID_TOKEN',
    });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token;
    }

    if (!token) return next();

    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;

    if (decoded.role === 'STUDENT' && !decoded.studentId) {
      const student = await Student.findOne({ userId: decoded.userId });
      if (student) {
        decoded.studentId = student.studentId;
        decoded.studentMongoId = student._id.toString();
      }
    }

    req.user = decoded;
  } catch (error) {
    // Invalid/expired token on an optionally-authenticated route: proceed as a guest
  }
  next();
};

export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Requires one of roles: ${roles.join(', ')}`,
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
};
