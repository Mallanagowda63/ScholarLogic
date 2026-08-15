import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Course } from '../models/Course';
import { Module } from '../models/Module';
import { Lesson } from '../models/Lesson';
import { VideoProgress } from '../models/VideoProgress';
import { Assignment } from '../models/Assignment';
import { Submission } from '../models/Submission';
import { Quiz } from '../models/Quiz';
import { Student } from '../models/Student';
import { AppError } from '../middleware/errorHandler';

export const getCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, category, level, status = 'PUBLISHED' } = req.query;

  const query: any = {};
  if (status && status !== 'ALL') query.status = status;
  if (category) query.category = category;
  if (level) query.level = level;
  if (search) {
    query.$or = [
      { title: { $regex: String(search), $options: 'i' } },
      { description: { $regex: String(search), $options: 'i' } },
    ];
  }

  const courses = await Course.find(query).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { courses },
  });
};

export const getCourseById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const course = await Course.findById(id).populate('assignedTrainerIds', 'fullName email avatarUrl');
  if (!course) {
    throw new AppError('Course not found', 404, 'NOT_FOUND');
  }

  const modules = await Module.find({ courseId: course._id }).sort({ order: 1 });
  const moduleIds = modules.map((m) => m._id);

  const lessons = await Lesson.find({ moduleId: { $in: moduleIds }, isPublished: true }).sort({ order: 1 });

  let progressMap: Record<string, any> = {};
  if (req.user && req.user.role === 'STUDENT') {
    const student = await Student.findOne({ userId: req.user.userId });
    if (student) {
      const userProgress = await VideoProgress.find({ studentId: student._id, courseId: course._id });
      userProgress.forEach((p) => {
        progressMap[p.lessonId.toString()] = {
          progressPercentage: p.progressPercentage,
          completed: p.completed,
          lastWatchedAt: p.lastWatchedAt,
        };
      });
    }
  }

  // Nest lessons into modules
  const structuredModules = modules.map((mod) => {
    const modLessons = lessons.filter((l) => l.moduleId.toString() === mod._id.toString());
    return {
      ...mod.toObject(),
      lessons: modLessons.map((l) => ({
        ...l.toObject(),
        userProgress: progressMap[l._id.toString()] || { progressPercentage: 0, completed: false },
      })),
    };
  });

  res.json({
    success: true,
    data: {
      course,
      modules: structuredModules,
    },
  });
};

export const createCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  const { title, description, category, level, durationHours, thumbnailUrl } = req.body;

  if (!title || !description || !category) {
    throw new AppError('Title, description, and category are required', 400, 'MISSING_FIELDS');
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now().toString().slice(-4);

  const course = await Course.create({
    title,
    slug,
    description,
    category,
    level: level || 'BEGINNER',
    durationHours: durationHours || 40,
    thumbnailUrl: thumbnailUrl || '',
    createdById: req.user!.userId,
    status: 'PUBLISHED',
  });

  res.status(201).json({
    success: true,
    message: 'Course created successfully',
    data: { course },
  });
};

export const createModule = async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId } = req.params;
  const { title, description, order } = req.body;

  const course = await Course.findById(courseId);
  if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

  const module = await Module.create({
    courseId,
    title,
    description: description || '',
    order: order || 1,
  });

  res.status(201).json({
    success: true,
    message: 'Module created successfully',
    data: { module },
  });
};

export const createLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  const { moduleId } = req.params;
  const { title, type, videoUrl, durationMinutes, notesFileUrl, order, courseId } = req.body;

  const module = await Module.findById(moduleId);
  if (!module) throw new AppError('Module not found', 404, 'NOT_FOUND');

  const lesson = await Lesson.create({
    moduleId,
    courseId: courseId || module.courseId,
    title,
    type: type || 'VIDEO',
    videoUrl: videoUrl || '',
    durationMinutes: durationMinutes || 15,
    notesFileUrl: notesFileUrl || '',
    order: order || 1,
    isPublished: true,
  });

  res.status(201).json({
    success: true,
    message: 'Lesson created successfully',
    data: { lesson },
  });
};

export const updateVideoProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  const { lessonId, courseId, progressPercentage } = req.body;

  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Only students can record progress', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student profile not found', 404, 'NOT_FOUND');

  const completed = Number(progressPercentage) >= 90;

  const progress = await VideoProgress.findOneAndUpdate(
    { studentId: student._id, lessonId },
    {
      studentId: student._id,
      lessonId,
      courseId,
      progressPercentage: Math.min(100, Math.max(0, Number(progressPercentage))),
      completed,
      lastWatchedAt: new Date(),
    },
    { new: true, upsert: true }
  );

  res.json({
    success: true,
    data: { progress },
  });
};

export const submitAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { assignmentId } = req.params;
  const { submissionText, submissionFileUrl } = req.body;

  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Only students can submit assignments', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');

  const submission = await Submission.findOneAndUpdate(
    { assignmentId, studentId: student._id },
    {
      assignmentId,
      studentId: student._id,
      submissionText: submissionText || '',
      submissionFileUrl: submissionFileUrl || '',
      submittedAt: new Date(),
      status: 'SUBMITTED',
    },
    { new: true, upsert: true }
  );

  res.json({
    success: true,
    message: 'Assignment submitted successfully',
    data: { submission },
  });
};

export const submitQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  const { quizId } = req.params;
  const { answers } = req.body; // array of selected indices

  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new AppError('Quiz not found', 404, 'NOT_FOUND');

  let score = 0;
  let totalMarks = 0;

  const results = quiz.questions.map((q, idx) => {
    totalMarks += q.marks;
    const isCorrect = answers && answers[idx] === q.correctAnswerIndex;
    if (isCorrect) score += q.marks;
    return {
      questionText: q.questionText,
      selected: answers ? answers[idx] : null,
      correctAnswer: q.correctAnswerIndex,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const percentage = Math.round((score / Math.max(1, totalMarks)) * 100);
  const passed = percentage >= quiz.passingScorePercentage;

  res.json({
    success: true,
    data: {
      score,
      totalMarks,
      percentage,
      passed,
      results,
    },
  });
};
