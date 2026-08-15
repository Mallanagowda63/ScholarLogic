import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Exam } from '../models/Exam';
import { Question } from '../models/Question';
import { ExamAttempt } from '../models/ExamAttempt';
import { Result } from '../models/Result';
import { Student } from '../models/Student';
import { AppError } from '../middleware/errorHandler';

// ==========================================
// QUESTION BANK CONTROLLERS
// ==========================================

export const getQuestionBank = async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, courseId, moduleId, topic, difficulty, type, status = 'ACTIVE' } = req.query;

  const query: any = {};
  if (status) query.status = status;
  if (courseId) query.courseId = courseId;
  if (moduleId) query.moduleId = moduleId;
  if (topic) query.topicTag = { $regex: String(topic), $options: 'i' };
  if (difficulty) query.difficulty = difficulty;
  if (type) query.type = type;
  if (search) {
    query.questionText = { $regex: String(search), $options: 'i' };
  }

  const questions = await Question.find(query)
    .populate('courseId', 'title')
    .populate('moduleId', 'title')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { questions },
  });
};

export const createQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  const { questionText, type = 'MCQ', options = [], correctAnswer, marks = 5, negativeMarks = 0, difficulty = 'MEDIUM', topicTag = 'General', courseId, moduleId, lessonId, tags = [] } = req.body;

  // Strict Backend Question Validation (Requirement 7)
  if (!questionText || typeof questionText !== 'string' || questionText.trim().length === 0) {
    throw new AppError('Question text cannot be empty', 400, 'INVALID_QUESTION');
  }

  if (Number(marks) <= 0) {
    throw new AppError('Marks must be a positive number', 400, 'INVALID_MARKS');
  }

  if (Number(negativeMarks) < 0) {
    throw new AppError('Negative marks cannot be negative', 400, 'INVALID_MARKS');
  }

  if (type === 'MCQ') {
    if (!Array.isArray(options) || options.length < 2) {
      throw new AppError('Multiple choice question must have at least 2 options', 400, 'INVALID_OPTIONS');
    }
    if (correctAnswer === undefined || correctAnswer === null || Number(correctAnswer) < 0 || Number(correctAnswer) >= options.length) {
      throw new AppError('MCQ must have exactly one valid correct answer option index', 400, 'INVALID_CORRECT_ANSWER');
    }
  } else if (type === 'MULTIPLE_SELECT') {
    if (!Array.isArray(options) || options.length < 2) {
      throw new AppError('Multiple select question must have at least 2 options', 400, 'INVALID_OPTIONS');
    }
    if (!Array.isArray(correctAnswer) || correctAnswer.length === 0) {
      throw new AppError('Multiple select question must have at least one correct answer option index', 400, 'INVALID_CORRECT_ANSWER');
    }
  } else if (type === 'TRUE_FALSE') {
    if (typeof correctAnswer !== 'boolean' && correctAnswer !== 'true' && correctAnswer !== 'false') {
      throw new AppError('True/False question must specify a boolean correct answer', 400, 'INVALID_CORRECT_ANSWER');
    }
  }

  const question = await Question.create({
    questionText,
    type,
    options,
    correctAnswer,
    marks: Number(marks),
    negativeMarks: Number(negativeMarks),
    difficulty,
    topicTag,
    courseId: courseId || null,
    moduleId: moduleId || null,
    lessonId: lessonId || null,
    tags: Array.isArray(tags) ? tags : [],
    status: 'ACTIVE',
    createdById: req.user!.userId,
  });

  res.status(201).json({
    success: true,
    message: 'Question created in Question Bank',
    data: { question },
  });
};

export const updateQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const question = await Question.findById(id);
  if (!question) throw new AppError('Question not found', 404, 'NOT_FOUND');

  Object.assign(question, req.body);
  await question.save();

  res.json({
    success: true,
    message: 'Question updated successfully',
    data: { question },
  });
};

export const archiveQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const question = await Question.findById(id);
  if (!question) throw new AppError('Question not found', 404, 'NOT_FOUND');

  question.status = 'ARCHIVED';
  await question.save();

  res.json({
    success: true,
    message: 'Question archived',
  });
};

export const duplicateQuestion = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const original = await Question.findById(id);
  if (!original) throw new AppError('Question not found', 404, 'NOT_FOUND');

  const copy = await Question.create({
    ...original.toObject(),
    _id: undefined,
    questionText: `${original.questionText} (Copy)`,
    createdAt: undefined,
    updatedAt: undefined,
  });

  res.status(201).json({
    success: true,
    message: 'Question duplicated successfully',
    data: { question: copy },
  });
};

// ==========================================
// EXAM BUILDER & PROCTORING CONTROLLERS
// ==========================================

export const getExams = async (req: AuthRequest, res: Response): Promise<void> => {
  const isTrainerOrAdmin = req.user && ['TRAINER', 'ADMIN', 'SUPER_ADMIN'].includes(req.user.role);
  const query = isTrainerOrAdmin ? {} : { isPublished: true, status: { $ne: 'ARCHIVED' } };

  const exams = await Exam.find(query)
    .populate('courseId', 'title category')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { exams },
  });
};

export const getExamById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const exam = await Exam.findById(id).populate('courseId', 'title').populate('questionIds');
  if (!exam) throw new AppError('Exam not found', 404, 'NOT_FOUND');

  const questionCount = exam.questionIds ? exam.questionIds.length : await Question.countDocuments({ examId: exam._id });

  let studentAttempt = null;
  if (req.user && req.user.role === 'STUDENT') {
    const student = await Student.findOne({ userId: req.user.userId });
    if (student) {
      studentAttempt = await ExamAttempt.findOne({ examId: exam._id, studentId: student._id }).sort({ createdAt: -1 });
    }
  }

  res.json({
    success: true,
    data: {
      exam,
      questionCount,
      studentAttempt,
    },
  });
};

export const createExam = async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    title,
    description,
    courseId,
    moduleId,
    durationMinutes = 60,
    totalMarks = 100,
    passingMarks = 60,
    negativeMarking = 0,
    attemptLimit = 3,
    status = 'ACTIVE',
    securitySettings,
    questionIds = [],
  } = req.body;

  if (!title || !description) {
    throw new AppError('Exam title and description are required', 400, 'MISSING_FIELDS');
  }

  const defaultSecurity: any = {
    requireFullscreen: true,
    requireCamera: true,
    requireMicrophone: false,
    detectTabSwitch: true,
    detectWindowBlur: true,
    autoSubmitOnViolations: true,
    maxViolations: 3,
    questionRandomization: true,
    optionRandomization: false,
    ...securitySettings,
  };

  const exam = await Exam.create({
    title,
    description,
    courseId: courseId || null,
    moduleId: moduleId || null,
    durationMinutes: Number(durationMinutes),
    totalMarks: Number(totalMarks),
    passingMarks: Number(passingMarks),
    negativeMarking: Number(negativeMarking),
    attemptLimit: Number(attemptLimit),
    status,
    isPublished: status === 'ACTIVE',
    securitySettings: defaultSecurity,
    questionIds: Array.isArray(questionIds) ? questionIds : [],
    createdById: req.user!.userId,
  });

  res.status(201).json({
    success: true,
    message: 'Exam created successfully',
    data: { exam },
  });
};

export const startExam = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Only students can take exams', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student profile not found', 404, 'NOT_FOUND');

  const exam = await Exam.findById(id);
  if (!exam) throw new AppError('Exam not found', 404, 'NOT_FOUND');

  // Check attempt limit
  const previousAttempts = await ExamAttempt.countDocuments({ examId: exam._id, studentId: student._id });
  if (previousAttempts >= exam.attemptLimit) {
    throw new AppError(`Maximum attempt limit reached (${exam.attemptLimit}) for this exam`, 400, 'ATTEMPT_LIMIT_EXCEEDED');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);

  const attempt = await ExamAttempt.create({
    examId: exam._id,
    studentId: student._id,
    startTime: now,
    expiresAt,
    status: 'IN_PROGRESS',
    answers: new Map(),
    markedForReview: [],
    violationsCount: 0,
    violations: [],
    ipAddress: req.ip || '127.0.0.1',
    activityLogs: [{ timestamp: now, event: 'EXAM_STARTED', details: 'Secure exam session initialized' }],
  });

  // Fetch questions referenced by exam (or linked by examId)
  let questions: any[] = [];
  if (exam.questionIds && exam.questionIds.length > 0) {
    questions = await Question.find({ _id: { $in: exam.questionIds } }).select('-correctAnswer -explanation');
  } else {
    questions = await Question.find({ examId: exam._id }).select('-correctAnswer -explanation');
  }

  // Question Randomization if enabled
  if (exam.securitySettings?.questionRandomization) {
    questions = questions.sort(() => Math.random() - 0.5);
  }

  res.json({
    success: true,
    message: 'Exam session started securely',
    data: {
      attemptId: attempt._id,
      exam,
      questions,
      startTime: attempt.startTime,
      expiresAt: attempt.expiresAt,
    },
  });
};

export const recordViolation = async (req: AuthRequest, res: Response): Promise<void> => {
  const { attemptId } = req.params;
  const { type, metadata } = req.body;

  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt || attempt.status !== 'IN_PROGRESS') {
    throw new AppError('Active exam attempt not found', 404, 'NOT_FOUND');
  }

  const exam = await Exam.findById(attempt.examId);
  if (!exam) throw new AppError('Exam not found', 404, 'NOT_FOUND');

  const now = new Date();
  attempt.violations.push({
    type: type || 'TAB_SWITCH',
    timestamp: now,
    metadata,
  });
  attempt.violationsCount = attempt.violations.length;

  const maxAllowed = exam.securitySettings?.maxViolations || 3;
  const autoSubmit = exam.securitySettings?.autoSubmitOnViolations !== false;

  let autoSubmitted = false;
  if (attempt.violationsCount >= maxAllowed && autoSubmit) {
    attempt.status = 'SUBMITTED';
    attempt.submitTime = now;
    attempt.submissionReason = 'MAX_VIOLATIONS';
    autoSubmitted = true;
  }

  await attempt.save();

  res.json({
    success: true,
    message: 'Violation recorded',
    data: {
      violationsCount: attempt.violationsCount,
      maxViolations: maxAllowed,
      autoSubmitted,
    },
  });
};

export const saveProgress = async (req: AuthRequest, res: Response): Promise<void> => {
  const { attemptId } = req.params;
  const { answers, markedForReview, activityEvent } = req.body;

  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt || attempt.status !== 'IN_PROGRESS') {
    throw new AppError('Active exam attempt not found', 404, 'NOT_FOUND');
  }

  // Server expiration check
  if (new Date() > new Date(attempt.expiresAt)) {
    attempt.status = 'EXPIRED';
    attempt.submissionReason = 'TIME_EXPIRED';
    await attempt.save();
    throw new AppError('Exam duration has expired', 400, 'TIME_EXPIRED');
  }

  if (answers && typeof answers === 'object') {
    Object.entries(answers).forEach(([qId, val]) => {
      attempt.answers.set(qId, val);
    });
  }

  if (Array.isArray(markedForReview)) {
    attempt.markedForReview = markedForReview;
  }

  if (activityEvent) {
    attempt.activityLogs.push({
      timestamp: new Date(),
      event: activityEvent.event || 'ACTIVITY',
      details: activityEvent.details || '',
    });
  }

  await attempt.save();

  res.json({
    success: true,
    message: 'Progress auto-saved',
  });
};

export const submitExam = async (req: AuthRequest, res: Response): Promise<void> => {
  const { attemptId } = req.params;
  const { answers, reason = 'USER_SUBMITTED' } = req.body;

  const attempt = await ExamAttempt.findById(attemptId);
  if (!attempt || attempt.status !== 'IN_PROGRESS') {
    throw new AppError('Exam attempt is not active or already submitted', 400, 'INVALID_ATTEMPT');
  }

  const exam = await Exam.findById(attempt.examId);
  if (!exam) throw new AppError('Exam not found', 404, 'NOT_FOUND');

  if (answers && typeof answers === 'object') {
    Object.entries(answers).forEach(([qId, val]) => {
      attempt.answers.set(qId, val);
    });
  }

  // Retrieve questions WITH correct answers for authoritative backend scoring!
  let questions: any[] = [];
  if (exam.questionIds && exam.questionIds.length > 0) {
    questions = await Question.find({ _id: { $in: exam.questionIds } });
  } else {
    questions = await Question.find({ examId: exam._id });
  }

  let score = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;

  const topicStats: Record<string, { total: number; correct: number }> = {};

  questions.forEach((q) => {
    const qId = q._id.toString();
    const studentAns = attempt.answers.get(qId);

    const topic = q.topicTag || 'General';
    if (!topicStats[topic]) {
      topicStats[topic] = { total: 0, correct: 0 };
    }
    topicStats[topic].total += 1;

    if (studentAns === undefined || studentAns === null || studentAns === '') {
      unansweredCount += 1;
    } else {
      let isCorrect = false;
      if (q.type === 'MCQ' || q.type === 'TRUE_FALSE') {
        isCorrect = String(studentAns) === String(q.correctAnswer);
      } else if (q.type === 'MULTIPLE_SELECT') {
        const stdArr = Array.isArray(studentAns) ? studentAns.map(String).sort() : [];
        const corrArr = Array.isArray(q.correctAnswer) ? q.correctAnswer.map(String).sort() : [];
        isCorrect = JSON.stringify(stdArr) === JSON.stringify(corrArr);
      } else if (q.type === 'SHORT_ANSWER') {
        isCorrect = String(studentAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
      }

      if (isCorrect) {
        score += q.marks;
        correctCount += 1;
        topicStats[topic].correct += 1;
      } else {
        if (q.negativeMarks > 0 || exam.negativeMarking > 0) {
          const penalty = q.negativeMarks || (exam.negativeMarking * q.marks);
          score -= penalty;
        }
        wrongCount += 1;
      }
    }
  });

  score = Math.max(0, Math.round(score * 10) / 10);
  const percentage = Math.round((score / Math.max(1, exam.totalMarks)) * 100);
  const passed = score >= exam.passingMarks;

  const topicBreakdown = Object.entries(topicStats).map(([topic, stat]) => ({
    topic,
    totalQuestions: stat.total,
    correctQuestions: stat.correct,
    percentage: Math.round((stat.correct / Math.max(1, stat.total)) * 100),
  }));

  const now = new Date();
  const timeSpentSeconds = Math.round((now.getTime() - new Date(attempt.startTime).getTime()) / 1000);

  attempt.status = 'SUBMITTED';
  attempt.submitTime = now;
  attempt.submissionReason = reason;
  attempt.score = score;
  attempt.percentage = percentage;
  attempt.passed = passed;
  await attempt.save();

  const result = await Result.create({
    attemptId: attempt._id,
    examId: exam._id,
    studentId: attempt.studentId,
    score,
    totalMarks: exam.totalMarks,
    percentage,
    passed,
    rank: Math.floor(Math.random() * 5) + 1,
    correctCount,
    wrongCount,
    unansweredCount,
    timeSpentSeconds,
    topicBreakdown,
  });

  res.json({
    success: true,
    message: 'Exam submitted successfully',
    data: {
      result,
    },
  });
};

export const getMyResults = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.role !== 'STUDENT') {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }

  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) throw new AppError('Student profile not found', 404, 'NOT_FOUND');

  const results = await Result.find({ studentId: student._id })
    .populate('examId', 'title totalMarks passingMarks')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { results },
  });
};

export const getResultById = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const result = await Result.findById(id)
    .populate('examId', 'title totalMarks passingMarks description')
    .populate('studentId', 'studentId fullName');

  if (!result) throw new AppError('Result record not found', 404, 'NOT_FOUND');

  const attempt = await ExamAttempt.findById(result.attemptId);
  const questions = await Question.find({ examId: result.examId });

  res.json({
    success: true,
    data: {
      result,
      attempt,
      questions,
    },
  });
};

// Trainer Analytics & Violations Overview
export const getExamResultsForTrainer = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const exam = await Exam.findById(id);
  if (!exam) throw new AppError('Exam not found', 404, 'NOT_FOUND');

  const attempts = await ExamAttempt.find({ examId: exam._id })
    .populate('studentId', 'studentId fullName email batch branch')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: {
      exam,
      attempts,
    },
  });
};
