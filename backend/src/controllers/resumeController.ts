import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Resume } from '../models/Resume';
import { JobDescription } from '../models/JobDescription';
import { ResumeAnalysis } from '../models/ResumeAnalysis';
import { Student } from '../models/Student';
import { aiService } from '../services/aiService';
import { AppError } from '../middleware/errorHandler';

export const analyzeResume = async (req: AuthRequest, res: Response): Promise<void> => {
  const { resumeText, jobDescriptionText, jobTitle, companyName } = req.body;

  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Only students can analyze resumes', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student profile not found', 404, 'NOT_FOUND');

  if (!resumeText || !jobDescriptionText) {
    throw new AppError('Both resume text and job description text are required', 400, 'MISSING_FIELDS');
  }

  // Save Job Description for student history
  const jdDoc = await JobDescription.create({
    studentId: student._id,
    title: jobTitle || 'Target Position',
    companyName: companyName || 'Target Company',
    rawText: jobDescriptionText,
  });

  // Get active resume or create temporary baseline
  let resume = await Resume.findOne({ studentId: student._id }).sort({ updatedAt: -1 });
  if (!resume) {
    resume = await Resume.create({
      studentId: student._id,
      title: `${req.user.fullName} - Master Resume`,
      versionName: 'Initial Baseline',
      template: 'MODERN',
      data: {
        fullName: req.user.fullName,
        email: req.user.email,
        phone: student.phone || '+91 98765 43210',
        location: student.location || 'Bangalore, India',
        summary: 'Motivated software engineering student with expertise in full-stack web development and cloud technologies.',
        skills: student.skills,
        experience: [
          {
            company: 'ScholarLogic Labs',
            role: 'Software Development Trainee',
            startDate: 'Jan 2025',
            endDate: 'Present',
            current: true,
            description: 'Building modern edtech features and APIs using React, Node.js, and MongoDB.',
          },
        ],
        education: [
          {
            institution: student.college,
            degree: student.degree,
            fieldOfStudy: student.branch,
            startDate: '2022',
            endDate: String(student.graduationYear),
            grade: `CGPA: ${student.cgpa}`,
          },
        ],
        projects: student.projects.length > 0 ? student.projects : [
          {
            title: 'ScholarLogic Learning Platform',
            description: 'Full-stack LMS and assessment portal built with React, Node.js, Express, and MongoDB.',
            technologies: ['React', 'Node.js', 'Express', 'MongoDB', 'Tailwind CSS'],
          },
        ],
        certifications: student.certifications.map((c) => c.name),
      },
      rawText: resumeText,
    });
  }

  // Run AI analysis abstraction
  const analysisOutput = await aiService.analyzeResume(resumeText, jobDescriptionText, student.skills);

  const analysisDoc = await ResumeAnalysis.create({
    studentId: student._id,
    resumeId: resume._id,
    jobDescriptionId: jdDoc._id,
    atsScore: analysisOutput.atsScore,
    breakdown: analysisOutput.breakdown,
    matchedSkills: analysisOutput.matchedSkills,
    missingSkills: analysisOutput.missingSkills,
    recommendedKeywords: analysisOutput.recommendedKeywords,
    formattingIssues: analysisOutput.formattingIssues,
    contentImprovements: analysisOutput.contentImprovements,
    potentialConcerns: analysisOutput.potentialConcerns,
    analyzedAt: new Date(),
  });

  res.json({
    success: true,
    message: 'Resume ATS analysis complete',
    data: {
      analysis: analysisDoc,
      jobDescription: jdDoc,
      resume,
    },
  });
};

export const getMyResumes = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');

  const resumes = await Resume.find({ studentId: student._id }).sort({ updatedAt: -1 });

  res.json({
    success: true,
    data: { resumes },
  });
};

export const saveResume = async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, versionName, template, data, isDefault } = req.body;

  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');

  if (isDefault) {
    await Resume.updateMany({ studentId: student._id }, { isDefault: false });
  }

  const resume = await Resume.create({
    studentId: student._id,
    title: title || 'Generated ATS Resume',
    versionName: versionName || `Version ${new Date().toLocaleDateString()}`,
    template: template || 'MODERN',
    data: data || {
      fullName: req.user.fullName,
      email: req.user.email,
      phone: student.phone || '+91 98765 43210',
      location: student.location || 'Bangalore',
      summary: 'Passionate developer.',
      skills: student.skills,
      experience: [],
      education: [],
      projects: [],
      certifications: [],
    },
    isDefault: !!isDefault,
  });

  res.status(201).json({
    success: true,
    message: 'Resume saved successfully',
    data: { resume },
  });
};

export const updateResume = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { title, versionName, template, data, isDefault } = req.body;

  const resume = await Resume.findById(id);
  if (!resume) throw new AppError('Resume not found', 404, 'NOT_FOUND');

  if (title) resume.title = title;
  if (versionName) resume.versionName = versionName;
  if (template) resume.template = template;
  if (data) resume.data = data;
  if (isDefault !== undefined) resume.isDefault = isDefault;

  await resume.save();

  res.json({
    success: true,
    message: 'Resume updated successfully',
    data: { resume },
  });
};

export const deleteResume = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  await Resume.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'Resume version deleted',
  });
};
