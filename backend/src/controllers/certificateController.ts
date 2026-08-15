import { Response, Request } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Certificate, generateCertificateId } from '../models/Certificate';
import { Student } from '../models/Student';
import { Course } from '../models/Course';
import { AppError } from '../middleware/errorHandler';

export const getMyCertificates = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');

  const certificates = await Certificate.find({ studentId: student._id })
    .populate('courseId', 'title category thumbnailUrl')
    .sort({ issueDate: -1 });

  res.json({
    success: true,
    data: { certificates },
  });
};

export const verifyCertificate = async (req: Request, res: Response): Promise<void> => {
  const { certificateId } = req.params;

  const certificate = await Certificate.findOne({ certificateId })
    .populate({
      path: 'studentId',
      select: 'studentId college degree branch graduationYear',
      populate: { path: 'userId', select: 'fullName' },
    })
    .populate('courseId', 'title category durationHours');

  if (!certificate) {
    throw new AppError('Certificate verification failed. Record not found.', 404, 'INVALID_CERTIFICATE');
  }

  res.json({
    success: true,
    message: 'Certificate verified successfully',
    data: { certificate },
  });
};

export const issueCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  const { studentId, courseId } = req.body;

  const student = await Student.findById(studentId);
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');

  const course = await Course.findById(courseId);
  if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

  const certId = generateCertificateId();
  const verificationUrl = `/verify/${certId}`;

  const certificate = await Certificate.create({
    certificateId: certId,
    studentId: student._id,
    courseId: course._id,
    issueDate: new Date(),
    verificationUrl,
    certificatePdfUrl: `https://scholarlogic.edu/certificates/${certId}.pdf`,
  });

  res.status(201).json({
    success: true,
    message: 'Certificate issued successfully',
    data: { certificate },
  });
};
