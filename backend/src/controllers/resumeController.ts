import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Resume } from '../models/Resume';
import { JobDescription } from '../models/JobDescription';
import { ResumeAnalysis } from '../models/ResumeAnalysis';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { aiService } from '../services/aiService';
import { extractResume, resumeToText, reviewResume, ResumeDataSchema } from '../services/resumeAiService';
import { isPlaceholderEmail } from '../services/trackingService';
import { AppError } from '../middleware/errorHandler';

const TEMPLATES = ['CLASSIC', 'MODERN', 'TECHNICAL', 'MINIMAL'];

const myStudent = async (req: AuthRequest) => {
  if (!req.user || req.user.role !== 'STUDENT') throw new AppError('Only students can use the resume builder', 403, 'FORBIDDEN');
  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student profile not found', 404, 'NOT_FOUND');
  return student;
};

/** A saved resume version that belongs to this student (never someone else's) */
const myResume = async (req: AuthRequest, id: unknown) => {
  const student = await myStudent(req);
  if (!mongoose.isValidObjectId(id)) throw new AppError('Resume not found', 404, 'NOT_FOUND');
  const resume = await Resume.findOne({ _id: id, studentId: student._id });
  if (!resume) throw new AppError('Resume not found', 404, 'NOT_FOUND');
  return { student, resume };
};

const cleanData = (raw: unknown) => {
  const parsed = ResumeDataSchema.safeParse(raw || {});
  if (!parsed.success) throw new AppError('The resume details are not in the right format', 400, 'INVALID_RESUME');
  const d = parsed.data;
  if (!d.fullName.trim()) throw new AppError('Your name is required on the resume', 400, 'MISSING_FIELDS');
  return d;
};

const DEFAULT_SKILLS = 'Python,JavaScript,SQL,React,Git';

/** First draft from the student's real profile: only facts we have, empty where we don't */
export const getStarterResume = async (req: AuthRequest, res: Response): Promise<void> => {
  const student: any = await myStudent(req);
  const user: any = await User.findById(req.user!.userId).select('fullName email').lean();
  const course: any = student.enrollment?.courseId ? await mongoose.model('TrackCourse').findById(student.enrollment.courseId).select('name').lean() : null;
  const skills: string[] = (student.skills || []).join(',') === DEFAULT_SKILLS ? [] : student.skills || [];
  res.json({
    success: true,
    data: {
      resume: {
        fullName: user?.fullName || '',
        headline: course?.name ? `${course.name} Trainee` : '',
        email: user?.email && !isPlaceholderEmail(user.email) ? user.email : '',
        phone: student.phone || '',
        location: student.location || '',
        linkedInUrl: student.linkedInUrl || '',
        githubUrl: student.githubUrl || '',
        portfolioUrl: student.portfolioUrl || '',
        summary: '',
        skills,
        experience: [],
        education: student.college
          ? [{ institution: student.college, degree: student.degree || '', fieldOfStudy: student.branch || '', startDate: '', endDate: student.graduationYear ? String(student.graduationYear) : '', grade: '' }]
          : [],
        projects: (student.projects || []).map((p: any) => ({ title: p.title || '', description: p.description || '', technologies: p.technologies || [], link: p.link || p.githubUrl || '' })),
        certifications: (student.certifications || []).map((c: any) => c.name).filter(Boolean),
      },
    },
  });
};

/** Upload a resume file: the AI reads it into editable sections (nothing is saved until the student saves) */
export const uploadResumeFile = async (req: AuthRequest, res: Response): Promise<void> => {
  await myStudent(req);
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) throw new AppError('Choose your resume file (PDF or Word)', 400, 'MISSING_FILE');
  const resume = await extractResume(file.buffer, file.mimetype || '', file.originalname || '');
  res.json({ success: true, message: `Read ${file.originalname}`, data: { resume, fileName: file.originalname } });
};

/** AI review of the resume being edited */
export const reviewMyResume = async (req: AuthRequest, res: Response): Promise<void> => {
  await myStudent(req);
  const data = cleanData(req.body?.data);
  const review = await reviewResume(data, String(req.body?.targetRole || data.headline || '').slice(0, 120));
  res.json({ success: true, data: { review } });
};

/** Match the resume against a job description (ATS) */
export const analyzeResume = async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await myStudent(req);
  const { jobDescriptionText, jobTitle, companyName, resumeId } = req.body;
  if (!String(jobDescriptionText || '').trim()) throw new AppError('Paste the job description first', 400, 'MISSING_FIELDS');
  const data = cleanData(req.body?.data);
  const resumeText = resumeToText(data);
  if (resumeText.length < 80) throw new AppError('The resume is almost empty. Add your details (or upload your resume) first.', 400, 'EMPTY_RESUME');

  let resume = resumeId && mongoose.isValidObjectId(resumeId) ? await Resume.findOne({ _id: resumeId, studentId: student._id }) : null;
  if (!resume) {
    resume = await Resume.create({ studentId: student._id, title: `${data.fullName} - Resume`, versionName: 'Draft (saved for job match)', template: 'MODERN', data, rawText: resumeText });
  }
  const jdDoc = await JobDescription.create({ studentId: student._id, title: jobTitle || 'Target Position', companyName: companyName || 'Target Company', rawText: jobDescriptionText });
  const out = await aiService.analyzeResume(resumeText, jobDescriptionText, data.skills);
  const analysisDoc = await ResumeAnalysis.create({
    studentId: student._id,
    resumeId: resume._id,
    jobDescriptionId: jdDoc._id,
    atsScore: out.atsScore,
    breakdown: out.breakdown,
    matchedSkills: out.matchedSkills,
    missingSkills: out.missingSkills,
    recommendedKeywords: out.recommendedKeywords,
    formattingIssues: out.formattingIssues,
    contentImprovements: out.contentImprovements,
    potentialConcerns: out.potentialConcerns,
    analyzedAt: new Date(),
  });
  res.json({ success: true, message: 'Job match complete', data: { analysis: analysisDoc, resumeId: resume._id } });
};

export const getMyResumes = async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await myStudent(req);
  const resumes = await Resume.find({ studentId: student._id }).sort({ updatedAt: -1 });
  res.json({ success: true, data: { resumes } });
};

export const saveResume = async (req: AuthRequest, res: Response): Promise<void> => {
  const student = await myStudent(req);
  const { title, versionName, template, isDefault } = req.body;
  const data = cleanData(req.body?.data);
  if (isDefault) await Resume.updateMany({ studentId: student._id }, { isDefault: false });
  const resume = await Resume.create({
    studentId: student._id,
    title: String(title || `${data.fullName} - Resume`).slice(0, 120),
    versionName: String(versionName || `Version ${new Date().toLocaleDateString('en-IN')}`).slice(0, 80),
    template: TEMPLATES.includes(template) ? template : 'MODERN',
    data,
    rawText: resumeToText(data),
    isDefault: !!isDefault,
  });
  res.status(201).json({ success: true, message: 'Resume saved', data: { resume } });
};

export const updateResume = async (req: AuthRequest, res: Response): Promise<void> => {
  const { student, resume } = await myResume(req, req.params.id);
  const { title, versionName, template, isDefault } = req.body;
  if (title) resume.title = String(title).slice(0, 120);
  if (versionName) resume.versionName = String(versionName).slice(0, 80);
  if (template && TEMPLATES.includes(template)) resume.template = template;
  if (req.body?.data) {
    const data = cleanData(req.body.data);
    resume.data = data as any;
    resume.rawText = resumeToText(data);
  }
  if (isDefault !== undefined) {
    if (isDefault) await Resume.updateMany({ studentId: student._id, _id: { $ne: resume._id } }, { isDefault: false });
    resume.isDefault = !!isDefault;
  }
  await resume.save();
  res.json({ success: true, message: 'Resume updated', data: { resume } });
};

export const deleteResume = async (req: AuthRequest, res: Response): Promise<void> => {
  const { resume } = await myResume(req, req.params.id);
  await Resume.deleteOne({ _id: resume._id });
  res.json({ success: true, message: 'Resume version deleted' });
};

/** Old endpoint kept for older pages: reads a file sent as base64 and returns the sections */
export const parseResumeFile = async (req: AuthRequest, res: Response): Promise<void> => {
  await myStudent(req);
  const { fileBuffer, mimeType, fileName } = req.body;
  if (!fileBuffer) throw new AppError('File is required', 400, 'MISSING_FIELDS');
  const resume = await extractResume(Buffer.from(fileBuffer, 'base64'), mimeType || '', fileName || '');
  res.json({ success: true, data: { fileName, resume } });
};
