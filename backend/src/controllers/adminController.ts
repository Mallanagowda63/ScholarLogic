import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { Course } from '../models/Course';
import { Exam } from '../models/Exam';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { AuditLog } from '../models/AuditLog';
import { Result } from '../models/Result';
import { AppError } from '../middleware/errorHandler';

export const getAdminMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  const totalUsers = await User.countDocuments();
  const totalStudents = await Student.countDocuments();
  const totalTrainers = await User.countDocuments({ role: 'TRAINER' });
  const totalCourses = await Course.countDocuments();
  const totalExams = await Exam.countDocuments();
  const totalCompanies = await Company.countDocuments();
  const totalJobs = await Job.countDocuments();
  const totalApplications = await Application.countDocuments();
  const totalPlaced = await Application.countDocuments({ status: { $in: ['OFFERED', 'JOINED'] } });
  const examSubmissionsCount = await Result.countDocuments();

  const auditLogs = await AuditLog.find().sort({ timestamp: -1 }).limit(10);

  res.json({
    success: true,
    data: {
      metrics: {
        totalUsers,
        totalStudents,
        totalTrainers,
        totalCourses,
        totalExams,
        totalCompanies,
        totalJobs,
        totalApplications,
        totalPlaced,
        examSubmissionsCount,
      },
      auditLogs,
    },
  });
};

export const getAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const logs = await AuditLog.find().sort({ timestamp: -1 }).skip(skip).limit(Number(limit));
  const total = await AuditLog.countDocuments();

  res.json({
    success: true,
    data: {
      logs,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};
