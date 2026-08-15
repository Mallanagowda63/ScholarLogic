import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Student } from '../models/Student';
import { Course } from '../models/Course';
import { VideoProgress } from '../models/VideoProgress';
import { LessonProgress } from '../models/LessonProgress';
import { StudentCourseProgress } from '../models/StudentCourseProgress';
import { Exam } from '../models/Exam';
import { Result } from '../models/Result';
import { Application } from '../models/Application';
import { ResumeAnalysis } from '../models/ResumeAnalysis';
import { AppError } from '../middleware/errorHandler';

export const getStudentDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Only students can access student dashboard', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) {
    throw new AppError('Student profile not found', 404, 'STUDENT_NOT_FOUND');
  }

  // 1. Calculate Learning Progress strictly from THIS student's aggregate progress
  const courseProgressDocs = await StudentCourseProgress.find({ studentId: student._id }).populate('courseId', 'title category thumbnailUrl durationHours');
  const enrolledCoursesCount = courseProgressDocs.length;

  let learningProgressPct = 0;
  if (enrolledCoursesCount > 0) {
    const totalPctSum = courseProgressDocs.reduce((sum, doc) => sum + (doc.progressPercentage || 0), 0);
    learningProgressPct = Math.round(totalPctSum / enrolledCoursesCount);
  }

  // 2. Recent Exam Results for THIS student
  const recentResults = await Result.find({ studentId: student._id })
    .populate('examId', 'title totalMarks')
    .sort({ createdAt: -1 })
    .limit(5);

  // Calculate dynamic skill radar from THIS student's actual exam topic breakdown
  const topicSkillMap: Record<string, { total: number; correct: number }> = {};
  recentResults.forEach((resDoc) => {
    (resDoc.topicBreakdown || []).forEach((tb: any) => {
      if (!topicSkillMap[tb.topic]) {
        topicSkillMap[tb.topic] = { total: 0, correct: 0 };
      }
      topicSkillMap[tb.topic].total += tb.totalQuestions || 1;
      topicSkillMap[tb.topic].correct += tb.correctQuestions || 0;
    });
  });

  const skillData = Object.entries(topicSkillMap).map(([topic, stat]) => ({
    skill: topic,
    score: Math.round((stat.correct / Math.max(1, stat.total)) * 100),
  }));

  // 3. Upcoming Exams assigned/available for THIS student
  const upcomingExams = await Exam.find({ isPublished: true, status: 'ACTIVE' })
    .sort({ createdAt: -1 })
    .limit(3);

  // 4. Resume ATS Score for THIS student
  const latestAnalysis = await ResumeAnalysis.findOne({ studentId: student._id }).sort({ createdAt: -1 });
  const atsScore = latestAnalysis ? latestAnalysis.atsScore : null;

  // 5. Job Applications Metrics for THIS student (Zero fallback!)
  const totalApplications = await Application.countDocuments({ studentId: student._id });
  const shortlistedApplications = await Application.countDocuments({
    studentId: student._id,
    status: { $in: ['SHORTLISTED', 'ASSESSMENT', 'TECH_INTERVIEW', 'HR_INTERVIEW', 'SELECTED', 'OFFERED'] },
  });
  const pendingInterviews = await Application.countDocuments({
    studentId: student._id,
    status: { $in: ['TECH_INTERVIEW', 'HR_INTERVIEW'] },
  });

  // 6. Placement Drive Status for THIS student
  const latestApplication = await Application.findOne({ studentId: student._id })
    .populate('jobId', 'title company location')
    .sort({ updatedAt: -1 });

  let placementDrive = null;
  if (latestApplication && latestApplication.jobId) {
    const job = latestApplication.jobId as any;
    placementDrive = {
      company: job.company || 'Partner Company',
      title: job.title || 'Software Engineer',
      status: latestApplication.status,
      updatedAt: latestApplication.updatedAt,
    };
  }

  // 7. Enrolled Continue Learning Courses
  const continueLearningCourses = courseProgressDocs.map((doc: any) => ({
    _id: doc.courseId._id,
    title: doc.courseId.title,
    category: doc.courseId.category,
    thumbnailUrl: doc.courseId.thumbnailUrl,
    durationHours: doc.courseId.durationHours,
    progressPercentage: doc.progressPercentage,
    completedLessons: doc.completedLessonsCount,
    totalLessons: doc.totalLessonsCount,
  }));

  res.json({
    success: true,
    data: {
      student,
      metrics: {
        learningProgressPct,
        enrolledCoursesCount,
        atsScore,
        totalApplications,
        shortlistedApplications,
        pendingInterviews,
        upcomingExamCount: upcomingExams.length,
        nextExam: upcomingExams.length > 0 ? upcomingExams[0] : null,
      },
      recentResults,
      skillData,
      upcomingExams,
      placementDrive,
      continueLearningCourses,
    },
  });
};

export const updateStudentProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) {
    throw new AppError('Student not found', 404, 'NOT_FOUND');
  }

  const allowedFields = [
    'phone',
    'dateOfBirth',
    'gender',
    'location',
    'college',
    'degree',
    'branch',
    'graduationYear',
    'cgpa',
    'tenthPercentage',
    'twelfthPercentage',
    'skills',
    'projects',
    'certifications',
    'githubUrl',
    'linkedInUrl',
    'portfolioUrl',
    'preferredRole',
    'preferredLocation',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      (student as any)[field] = req.body[field];
    }
  });

  await student.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { student },
  });
};

export const getAllStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, batch, branch, limit = 20, page = 1 } = req.query;

  const query: any = {};
  if (batch) query.batch = batch;
  if (branch) query.branch = branch;

  const skip = (Number(page) - 1) * Number(limit);

  const students = await Student.find(query)
    .populate('userId', 'fullName email role avatarUrl')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Student.countDocuments(query);

  res.json({
    success: true,
    data: {
      students,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};
