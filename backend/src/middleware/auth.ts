import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserRole } from '../models/User';
import { Student } from '../models/Student';

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
