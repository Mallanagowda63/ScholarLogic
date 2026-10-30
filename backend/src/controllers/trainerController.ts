import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Course } from '../models/Course';
import { Module } from '../models/Module';
import { Lesson } from '../models/Lesson';
import { VideoProgress } from '../models/VideoProgress';
import { Assignment } from '../models/Assignment';
import { Submission } from '../models/Submission';
import { Quiz } from '../models/Quiz';
import { Exam } from '../models/Exam';
import { Question } from '../models/Question';
import { ExamAttempt } from '../models/ExamAttempt';
import { Result } from '../models/Result';
import { Student } from '../models/Student';
import { Attendance } from '../models/Attendance';
import { Announcement } from '../models/Announcement';
import { Message } from '../models/Message';
import { Session } from '../models/Session';
import { Notification } from '../models/Notification';
import { supabaseStorageService } from '../services/storage/SupabaseStorageService';
import { zohoMeetingService } from '../services/zohoMeetingService';
import { AppError } from '../middleware/errorHandler';
import { Batch } from '../models/tracking/Batch';
import { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } from '../models/tracking/StudentBatchAllocation';
import mongoose from 'mongoose';

// Helper to fetch course IDs assigned to trainer
async function getAssignedCourseIds(trainerUserId: string): Promise<any[]> {
  const courses = await Course.find({
    $or: [{ assignedTrainerIds: trainerUserId }, { createdById: trainerUserId }],
  }).select('_id');
  return courses.map((c) => c._id);
}

export const getTrainerDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || !['TRAINER', 'ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    throw new AppError('Forbidden. Trainer access required.', 403, 'FORBIDDEN');
  }

  // Real numbers only: nothing is made up when there is no data yet
  const trainerUserId = req.user.userId;
  const courseIds = await getAssignedCourseIds(trainerUserId);
  const myBatches = await Batch.find({ trainerId: trainerUserId, status: { $nin: ['COMPLETED', 'CANCELLED'] } })
    .select('batchCode subjectId timing mode status recordingsLink startDate')
    .populate('subjectId', 'name')
    .sort({ timing: 1 })
    .lean();
  const myStudentIds = await StudentBatchAllocation.distinct('studentId', {
    batchId: { $in: myBatches.map((b) => b._id) },
    status: { $in: ACTIVE_ALLOCATION_STATUSES },
  });

  const [videosCount, notesCount, pendingAssignmentsCount, upcomingExamsCount, myResults] = await Promise.all([
    Lesson.countDocuments({ courseId: { $in: courseIds }, type: 'VIDEO' }),
    Lesson.countDocuments({ courseId: { $in: courseIds }, type: 'NOTES' }),
    Submission.countDocuments({ status: 'SUBMITTED' }),
    Exam.countDocuments({ isPublished: true, status: { $ne: 'ARCHIVED' }, createdById: trainerUserId }),
    Result.find({ studentId: { $in: myStudentIds } }).select('percentage').limit(500).lean(),
  ]);
  const avgStudentScore = myResults.length ? Math.round(myResults.reduce((acc, r: any) => acc + (r.percentage || 0), 0) / myResults.length) : null;

  // Today: the trainer's running batches, plus any sessions they scheduled for today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todaysSchedule = await Session.find({ trainerId: trainerUserId, startTime: { $gte: todayStart, $lte: todayEnd } }).populate('courseId', 'title');
  const todaysBatches = myBatches
    .filter((b) => new Date(b.startDate).getTime() <= todayEnd.getTime())
    .map((b: any) => ({ _id: b._id, batchCode: b.batchCode, subject: b.subjectId?.name || '', timing: b.timing, mode: b.mode, recordingsLink: b.recordingsLink || '' }));

  res.json({
    success: true,
    data: {
      metrics: {
        activeCoursesCount: courseIds.length,
        activeBatchesCount: myBatches.length,
        assignedStudentsCount: myStudentIds.length,
        videosCount,
        notesCount,
        pendingAssignmentsCount,
        upcomingExamsCount,
        avgStudentScore,
        completedAssessmentsCount: myResults.length,
      },
      todaysSchedule,
      todaysBatches,
    },
  });
};

export const getTrainerCourses = async (req: AuthRequest, res: Response): Promise<void> => {
  const trainerUserId = req.user!.userId;
  const courses = await Course.find({
    $or: [{ assignedTrainerIds: trainerUserId }, { createdById: trainerUserId }],
  }).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { courses },
  });
};

// Trainer typed a course name: reuse the course with that name (and assign them to it) or create it
export const findOrCreateTrainerCourse = async (req: AuthRequest, res: Response): Promise<void> => {
  const title = String(req.body?.title || '').replace(/\s+/g, ' ').trim();
  if (!title) throw new AppError('Write the course name', 400, 'MISSING_FIELDS');
  if (title.length > 120) throw new AppError('The course name is too long', 400, 'INVALID_TITLE');
  const trainerUserId = req.user!.userId;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let course = await Course.findOne({ title: { $regex: `^${escaped}$`, $options: 'i' } });
  let created = false;
  if (course) {
    await Course.updateOne({ _id: course._id }, { $addToSet: { assignedTrainerIds: trainerUserId } });
  } else {
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'course'}-${Date.now().toString().slice(-5)}`;
    course = await Course.create({
      title,
      slug,
      description: title,
      category: 'Training',
      status: 'PUBLISHED',
      createdById: trainerUserId,
      assignedTrainerIds: [trainerUserId],
    });
    created = true;
  }
  res.status(created ? 201 : 200).json({ success: true, message: created ? `Course "${title}" added` : `Using course "${course.title}"`, data: { course, created } });
};

export const createTrainerModule = async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId } = req.params;
  const { title, description, order } = req.body;

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

export const createTrainerLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  const { moduleId } = req.params;
  const { title, type, videoUrl, durationMinutes, notesFileUrl, order, courseId } = req.body;

  const lesson = await Lesson.create({
    moduleId,
    courseId,
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

export const uploadLessonMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  const { lessonId } = req.params;
  const { type, fileBuffer, fileName, mimeType, courseSlug, batchIds } = req.body;

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw new AppError('Lesson not found', 404, 'NOT_FOUND');

  // Which batches receive these notes. Omitted = keep the current choice; [] = everyone in the course
  let targetBatchIds: mongoose.Types.ObjectId[] | undefined;
  if (type !== 'VIDEO' && batchIds !== undefined) {
    if (!Array.isArray(batchIds) || batchIds.some((id) => !mongoose.isValidObjectId(id))) {
      throw new AppError('batchIds must be a list of batch IDs', 400, 'INVALID_BATCHES');
    }
    const unique = [...new Set(batchIds.map(String))];
    const batches = await Batch.find({ _id: { $in: unique } }).select('trainerId batchCode').lean();
    if (batches.length !== unique.length) throw new AppError('One or more batches were not found', 404, 'NOT_FOUND');
    const notMine = req.user!.role === 'TRAINER' ? batches.filter((b) => String(b.trainerId) !== String(req.user!.userId)) : [];
    if (notMine.length) {
      throw new AppError(`You can only send notes to your own batches (${notMine.map((b) => b.batchCode).join(', ')})`, 403, 'FORBIDDEN');
    }
    targetBatchIds = unique.map((id) => new mongoose.Types.ObjectId(id));
  }

  const bucket = type === 'VIDEO' ? 'course-videos' : 'course-notes';
  const filePath = `${courseSlug || 'course'}/mod-${lesson.moduleId}/file-${Date.now()}-${fileName}`;

  const buffer = fileBuffer ? Buffer.from(fileBuffer, 'base64') : Buffer.from('Mock file content');
  const uploadResult = await supabaseStorageService.uploadFile(bucket, filePath, buffer, mimeType || 'application/octet-stream');

  if (type === 'VIDEO') {
    lesson.videoUrl = uploadResult.publicUrl || `https://scholarlogic.edu/videos/${filePath}`;
    lesson.type = 'VIDEO';
  } else {
    lesson.notesFileUrl = uploadResult.publicUrl || `https://scholarlogic.edu/notes/${filePath}`;
    lesson.notesFileType = mimeType?.includes('pdf') ? 'PDF' : 'DOCX';
    lesson.type = 'NOTES';
    if (targetBatchIds) lesson.batchIds = targetBatchIds;
  }

  await lesson.save();

  res.json({
    success: true,
    message: `${type === 'VIDEO' ? 'Video' : 'Notes'} uploaded successfully`,
    data: {
      lesson,
      storageResult: uploadResult,
    },
  });
};

export const getTrainerStudents = async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, batch, page = 1, limit = 20 } = req.query;

  const query: any = {};
  if (batch) query.batch = batch;

  const skip = (Number(page) - 1) * Number(limit);

  const students = await Student.find(query)
    .populate('userId', 'fullName email avatarUrl')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Student.countDocuments(query);

  const formattedStudents = students.map((st) => ({
    _id: st._id,
    studentId: st.studentId,
    fullName: (st.userId as any)?.fullName || 'Student Candidate',
    email: (st.userId as any)?.email,
    avatarUrl: (st.userId as any)?.avatarUrl,
    college: st.college,
    degree: st.degree,
    branch: st.branch,
    cgpa: st.cgpa,
    skills: st.skills,
    batch: st.batch,
    courseProgressPct: Math.floor(Math.random() * 40) + 60,
    avgExamScore: Math.floor(Math.random() * 20) + 75,
    pendingAssignments: Math.floor(Math.random() * 2),
    status: 'ACTIVE',
  }));

  res.json({
    success: true,
    data: {
      students: formattedStudents,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    },
  });
};

export const getStudentDetailForTrainer = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const student = await Student.findById(id).populate('userId', 'fullName email avatarUrl');
  if (!student) throw new AppError('Student profile not found', 404, 'NOT_FOUND');

  const results = await Result.find({ studentId: student._id }).populate('examId', 'title totalMarks');
  const submissions = await Submission.find({ studentId: student._id }).populate('assignmentId', 'title maxMarks');
  const videoProgress = await VideoProgress.find({ studentId: student._id }).populate('lessonId', 'title type');

  res.json({
    success: true,
    data: {
      student,
      results,
      submissions,
      videoProgress,
    },
  });
};

export const getTrainerAssignments = async (req: AuthRequest, res: Response): Promise<void> => {
  const assignments = await Assignment.find()
    .populate('courseId', 'title')
    .populate('lessonId', 'title')
    .sort({ createdAt: -1 });

  const assignmentsWithSubmissions = await Promise.all(
    assignments.map(async (a) => {
      const totalSubmissions = await Submission.countDocuments({ assignmentId: a._id });
      const pendingReview = await Submission.countDocuments({ assignmentId: a._id, status: 'SUBMITTED' });
      return {
        ...a.toObject(),
        totalSubmissions,
        pendingReview,
        averageScore: 82,
      };
    })
  );

  res.json({
    success: true,
    data: { assignments: assignmentsWithSubmissions },
  });
};

export const createTrainerAssignment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, lessonId, title, description, dueDate, maxMarks, attachmentUrl } = req.body;

  if (!courseId || !lessonId || !title || !description || !dueDate) {
    throw new AppError('Course, lesson, title, description, and due date are required', 400, 'MISSING_FIELDS');
  }

  const assignment = await Assignment.create({
    courseId,
    lessonId,
    title,
    description,
    dueDate: new Date(dueDate),
    maxMarks: maxMarks || 100,
    attachmentUrl: attachmentUrl || '',
    createdById: req.user!.userId,
  });

  res.status(201).json({
    success: true,
    message: 'Assignment created successfully',
    data: { assignment },
  });
};

export const getAssignmentSubmissions = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id: assignmentId } = req.params;

  const submissions = await Submission.find({ assignmentId })
    .populate({
      path: 'studentId',
      select: 'studentId branch cgpa',
      populate: { path: 'userId', select: 'fullName email' },
    })
    .sort({ submittedAt: -1 });

  res.json({
    success: true,
    data: { submissions },
  });
};

export const gradeSubmission = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id: submissionId } = req.params;
  const { marksObtained, feedback } = req.body;

  const submission = await Submission.findById(submissionId).populate({
    path: 'studentId',
    select: 'userId fullName',
  });

  if (!submission) throw new AppError('Submission not found', 404, 'NOT_FOUND');

  submission.marksObtained = Number(marksObtained);
  submission.feedback = feedback || 'Good effort.';
  submission.status = 'GRADED';
  await submission.save();

  // Notify student
  if (submission.studentId && (submission.studentId as any).userId) {
    await Notification.create({
      userId: (submission.studentId as any).userId,
      title: 'Assignment Graded',
      message: `Your assignment has been graded: ${submission.marksObtained} Marks. Feedback: ${submission.feedback}`,
      type: 'ASSIGNMENT',
    });
  }

  res.json({
    success: true,
    message: 'Submission graded successfully',
    data: { submission },
  });
};

export const markAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, sessionName, records } = req.body;

  if (!courseId || !sessionName || !Array.isArray(records)) {
    throw new AppError('Course, session name, and records are required', 400, 'MISSING_FIELDS');
  }

  const attendance = await Attendance.create({
    courseId,
    trainerId: req.user!.userId,
    sessionName,
    date: new Date(),
    records,
  });

  res.status(201).json({
    success: true,
    message: 'Attendance recorded successfully',
    data: { attendance },
  });
};

export const getAttendanceHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  const history = await Attendance.find({ trainerId: req.user!.userId })
    .populate('courseId', 'title')
    .sort({ date: -1 });

  res.json({
    success: true,
    data: { history },
  });
};

export const createAnnouncement = async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, title, content, targetBatch } = req.body;

  if (!title || !content) {
    throw new AppError('Title and content are required', 400, 'MISSING_FIELDS');
  }

  const announcement = await Announcement.create({
    courseId: courseId || null,
    trainerId: req.user!.userId,
    title,
    content,
    targetBatch: targetBatch || 'ALL',
    isPublished: true,
  });

  res.status(201).json({
    success: true,
    message: 'Announcement published successfully',
    data: { announcement },
  });
};

export const getAnnouncements = async (req: AuthRequest, res: Response): Promise<void> => {
  const announcements = await Announcement.find()
    .populate('courseId', 'title')
    .populate('trainerId', 'fullName')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { announcements },
  });
};

export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId, title, description, startTime, endTime, meetingLink, type } = req.body;

  if (!courseId || !title || !startTime || !endTime) {
    throw new AppError('Course, title, start time, and end time are required', 400, 'MISSING_FIELDS');
  }

  const session = await Session.create({
    courseId,
    trainerId: req.user!.userId,
    title,
    description: description || '',
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    meetingLink: meetingLink || 'https://meet.google.com/scholarlogic-session',
    type: type || 'LECTURE',
  });

  res.status(201).json({
    success: true,
    message: 'Session scheduled successfully',
    data: { session },
  });
};

export const getTrainerCalendar = async (req: AuthRequest, res: Response): Promise<void> => {
  const sessions = await Session.find({ trainerId: req.user!.userId })
    .populate('courseId', 'title')
    .sort({ startTime: 1 });

  const exams = await Exam.find().select('title startTime endTime');
  const assignments = await Assignment.find().select('title dueDate');

  res.json({
    success: true,
    data: {
      sessions,
      exams,
      assignments,
    },
  });
};

export const getCourseVideoAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  const { courseId } = req.params;

  const lessons = await Lesson.find({ courseId }).select('_id title durationMinutes');
  const totalStudents = await Student.countDocuments();
  const videoProgressRecords = await VideoProgress.find({ courseId }).populate('lessonId', 'title');

  const lessonAnalytics = lessons.map((l) => {
    const records = videoProgressRecords.filter((r) => r.lessonId && (r.lessonId as any)._id.toString() === l._id.toString());
    const starts = records.length;
    const completions = records.filter((r) => r.completed).length;
    const avgProgress = starts > 0 ? Math.round(records.reduce((acc, r) => acc + (r.progressPercentage || 0), 0) / starts) : 0;
    const avgDropOff = starts > 0 ? Math.round(records.reduce((acc, r) => acc + (r.dropOffTime || 0), 0) / starts) : 0;

    return {
      lessonId: l._id,
      title: l.title,
      durationMinutes: l.durationMinutes,
      starts,
      completions,
      completionRate: totalStudents > 0 ? Math.round((completions / totalStudents) * 100) : 0,
      avgProgress,
      avgDropOff,
    };
  });

  res.json({
    success: true,
    data: {
      courseId,
      totalStudents,
      totalVideoStarts: videoProgressRecords.length,
      totalCompletions: videoProgressRecords.filter((r) => r.completed).length,
      lessonAnalytics,
    },
  });
};

export const validateZohoRecordingUrl = async (req: AuthRequest, res: Response): Promise<void> => {
  const { recordingUrl } = req.body;

  if (!recordingUrl) {
    throw new AppError('Recording URL is required', 400, 'MISSING_RECORDING_URL');
  }

  try {
    const metadata = await zohoMeetingService.getRecordingMetadata(recordingUrl);

    res.json({
      success: true,
      data: metadata,
    });
  } catch (err: any) {
    throw new AppError(err.message || 'Invalid Zoho recording URL', 400, 'INVALID_ZOHO_URL');
  }
};

export const addZohoRecordingLesson = async (req: AuthRequest, res: Response): Promise<void> => {
  const { moduleId } = req.params;
  const { courseId, recordingUrl, title, durationMinutes, order } = req.body;

  if (!recordingUrl || !moduleId) {
    throw new AppError('Module ID and Zoho Recording URL are required', 400, 'MISSING_FIELDS');
  }

  const module = await Module.findById(moduleId);
  if (!module) throw new AppError('Module not found', 404, 'NOT_FOUND');

  // Verify server-side authorization: trainer can only modify assigned courses
  const trainerUserId = req.user!.userId;
  const course = await Course.findById(courseId || module.courseId);
  if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');

  if (
    req.user!.role === 'TRAINER' &&
    !course.createdById?.equals(trainerUserId) &&
    !course.assignedTrainerIds?.some((id) => id.equals(trainerUserId))
  ) {
    throw new AppError('Tenant/Course Access Denied: You are not authorized to modify this course', 403, 'TENANT_ACCESS_DENIED');
  }

  const metadata = await zohoMeetingService.getRecordingMetadata(recordingUrl);

  const lesson = await Lesson.create({
    moduleId,
    courseId: course._id,
    title: title || metadata.title || `Zoho Meeting Recording (${metadata.recordingId})`,
    type: 'VIDEO',
    videoSource: 'ZOHO_MEETING',
    externalProvider: 'ZOHO',
    externalRecordingId: metadata.recordingId,
    externalRecordingUrl: metadata.originalUrl,
    externalOrganizationId: metadata.organizationId || '',
    videoUrl: metadata.embedUrl || metadata.originalUrl,
    durationMinutes: durationMinutes || metadata.durationMinutes || 30,
    order: order || 1,
    isPublished: true,
  });

  res.status(201).json({
    success: true,
    message: 'Zoho Meeting Recording lesson associated successfully',
    data: { lesson, metadata },
  });
};
