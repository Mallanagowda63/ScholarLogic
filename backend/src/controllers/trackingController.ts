import { Response } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { createStudentAccount } from '../services/studentAccountService';
import { StudentRegistration } from '../models/StudentRegistration';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { getNextStudentId } from '../models/Counter';
import { Subject } from '../models/tracking/Subject';
import { TrackCourse } from '../models/tracking/TrackCourse';
import { Batch, IBatch } from '../models/tracking/Batch';
import { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } from '../models/tracking/StudentBatchAllocation';
import { TrainerDailyUpdate } from '../models/tracking/TrainerDailyUpdate';
import { StudentTimeline } from '../models/tracking/StudentTimeline';
import {
  addTimeline,
  attendanceForAllocation,
  batchProgress,
  buildJourney,
  effectiveBatchStatus,
  estimateBatchCompletion,
  getStudentJourney,
  isCompletingSoon,
  isPlaceholderEmail,
  loadJourneyContext,
  nextBatchCode,
  PLACEHOLDER_EMAIL_DOMAIN,
  topicsCoveredInAllocation,
} from '../services/trackingService';

const isAdmin = (req: AuthRequest) => req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
const oid = (raw: unknown, label = 'ID') => {
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label}`, 400, 'INVALID_ID');
  return new mongoose.Types.ObjectId(id);
};
const DAY_MS = 86400000;

const publicEmail = (email?: string) => (isPlaceholderEmail(email) ? '' : email || '');

const seatsTaken = async (batchId: any) =>
  StudentBatchAllocation.countDocuments({ batchId, status: { $in: ACTIVE_ALLOCATION_STATUSES } });

const logBatch = (batch: IBatch, req: AuthRequest, action: string, details: string) => {
  batch.history.push({ at: new Date(), action, details, byUserId: req.user?.userId as any });
};

// ---------------------------------------------------------------------------
// Courses & subjects
// ---------------------------------------------------------------------------

export const listSubjects = async (_req: AuthRequest, res: Response) => {
  const subjects = await Subject.find({}).sort({ name: 1 });
  res.json({ success: true, data: { subjects } });
};

const normalizeTopics = (topics: any[] = []) =>
  topics
    .map((t, i) => ({
      ...(t._id && mongoose.isValidObjectId(t._id) ? { _id: t._id } : {}),
      title: String(t.title || '').trim(),
      order: i + 1,
    }))
    .filter((t) => t.title);

export const saveSubject = async (req: AuthRequest, res: Response) => {
  const { name, code, expectedDurationDays, topics } = req.body;
  if (!name?.trim() || !code?.trim()) throw new AppError('Subject name and code are required', 400, 'MISSING_FIELDS');
  const payload = {
    name: name.trim(),
    code: code.trim().toUpperCase(),
    expectedDurationDays: Number(expectedDurationDays) || 30,
    topics: normalizeTopics(topics),
  };
  const subject = req.params.id
    ? await Subject.findByIdAndUpdate(oid(req.params.id), payload, { new: true, runValidators: true })
    : await Subject.create(payload);
  if (!subject) throw new AppError('Subject not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: { subject } });
};

export const listCourses = async (_req: AuthRequest, res: Response) => {
  const courses = await TrackCourse.find({}).populate('subjects.subjectId', 'name code topics').sort({ name: 1 }).lean();
  const counts = await Student.aggregate([
    { $match: { 'enrollment.courseId': { $ne: null } } },
    { $group: { _id: '$enrollment.courseId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json({
    success: true,
    data: {
      courses: courses.map((c: any) => ({
        ...c,
        subjects: [...c.subjects].sort((a: any, b: any) => a.order - b.order),
        studentCount: countMap.get(String(c._id)) || 0,
      })),
    },
  });
};

export const saveCourse = async (req: AuthRequest, res: Response) => {
  const { name, code, durationMonths, subjects = [] } = req.body;
  if (!name?.trim() || !code?.trim()) throw new AppError('Course name and code are required', 400, 'MISSING_FIELDS');
  const payload = {
    name: name.trim(),
    code: code.trim().toUpperCase(),
    durationMonths: Number(durationMonths) || 6,
    subjects: subjects
      .filter((s: any) => mongoose.isValidObjectId(s.subjectId))
      .map((s: any, i: number) => ({ subjectId: s.subjectId, order: i + 1, expectedDurationDays: Number(s.expectedDurationDays) || 30 })),
  };
  const course = req.params.id
    ? await TrackCourse.findByIdAndUpdate(oid(req.params.id), payload, { new: true, runValidators: true })
    : await TrackCourse.create(payload);
  if (!course) throw new AppError('Course not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: { course } });
};

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

const summarizeStudent = (student: any, journey: ReturnType<typeof buildJourney>) => ({
  _id: student._id,
  studentId: student.studentId,
  fullName: student.userId?.fullName || 'Student',
  email: publicEmail(student.userId?.email),
  phone: student.phone,
  mode: student.enrollment?.mode || 'OFFLINE',
  preferredTiming: student.enrollment?.preferredTiming || '',
  joiningDate: student.enrollment?.joiningDate || student.enrollmentDate,
  trainingStatus: journey.trainingStatus,
  course: journey.course,
  currentSubject: journey.current
    ? {
        name: journey.current.name,
        status: journey.current.status,
        progress: journey.current.progress,
        attendance: journey.current.attendance,
        expectedEndDate: journey.current.expectedEndDate,
        completingSoon: isCompletingSoon(journey.current),
      }
    : null,
  needsReallocationSubject: journey.subjects.find((x) => ['MISSED', 'REALLOCATION_REQUIRED', 'ON_HOLD', 'DROPPED'].includes(x.status))?.name || null,
  currentBatch: journey.current?.batch || null,
  nextSubject: journey.next ? { subjectId: journey.next.subjectId, name: journey.next.name, status: journey.next.status } : null,
  allocationStatus: journey.allocationStatus,
  registrationSource: student.registrationSource || 'ADMIN',
  expectedCompletion: journey.expectedCompletion,
  overallProgress: journey.overallProgress,
  missedCount: journey.missedCount,
});

export const listTrackedStudents = async (_req: AuthRequest, res: Response) => {
  // Only the fields the list and journey need, as plain objects: much faster with hundreds of students
  const students: any[] = await Student.find({}).select('studentId phone enrollment enrollmentDate registrationSource userId createdAt biometricId cardNumber').populate('userId', 'fullName email').sort({ createdAt: -1 }).lean();
  const ctx = await loadJourneyContext(students.map((s) => s._id));
  res.json({ success: true, data: { students: students.map((s) => summarizeStudent(s, buildJourney(s, ctx))) } });
};

export const createTrackedStudent = async (req: AuthRequest, res: Response) => {
  const { fullName, phone, email, address, courseId, mode = 'OFFLINE', preferredTiming = '', joiningDate, remarks = '', password, studentId: customId } = req.body;
  if (!phone?.trim()) throw new AppError('Phone number is required', 400, 'MISSING_FIELDS');
  const { student, studentId } = await createStudentAccount(
    {
      fullName,
      phone,
      email,
      address,
      courseId: courseId ? oid(courseId, 'course') : null,
      mode,
      preferredTiming,
      joiningDate,
      remarks,
      password,
      customStudentId: customId,
      registrationSource: 'ADMIN',
    },
    req.user
  );
  res.status(201).json({ success: true, data: { student: { _id: student._id, studentId } } });
};

export const getTrackedStudent = async (req: AuthRequest, res: Response) => {
  const result = await getStudentJourney(String(oid(req.params.id, 'student')));
  if (!result) throw new AppError('Student not found', 404, 'NOT_FOUND');
  const timeline = await StudentTimeline.find({ studentId: result.student._id }).sort({ date: -1, createdAt: -1 });
  const s: any = result.student;
  res.json({
    success: true,
    data: {
      student: {
        _id: s._id,
        studentId: s.studentId,
        fullName: s.userId?.fullName,
        email: publicEmail(s.userId?.email),
        phone: s.phone,
        enrollment: s.enrollment,
        statusHistory: s.statusHistory,
        modeHistory: s.modeHistory,
        classRecords: s.classRecords || [],
      },
      journey: result.journey,
      timeline,
    },
  });
};

export const updateTrackedStudent = async (req: AuthRequest, res: Response) => {
  const student = await Student.findById(oid(req.params.id, 'student'));
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
  const { fullName, phone, email, preferredTiming, joiningDate, courseId, remarks } = req.body;

  const changes: string[] = [];
  if (typeof phone === 'string' && phone.trim() && phone.trim() !== student.phone) {
    student.phone = phone.trim();
    changes.push('phone');
  }
  if (!student.enrollment) (student as any).enrollment = { mode: 'OFFLINE', status: 'ACTIVE', preferredTiming: '', remarks: '' };
  const enr: any = student.enrollment;
  if (typeof preferredTiming === 'string' && preferredTiming !== enr.preferredTiming) {
    enr.preferredTiming = preferredTiming;
    changes.push('preferred timing');
  }
  if (joiningDate) enr.joiningDate = new Date(joiningDate);
  if (typeof remarks === 'string') enr.remarks = remarks;
  if (courseId !== undefined && String(courseId || '') !== String(enr.courseId || '')) {
    const course = courseId ? await TrackCourse.findById(oid(courseId, 'course')) : null;
    if (courseId && !course) throw new AppError('Course not found', 404, 'NOT_FOUND');
    enr.courseId = course?._id;
    await addTimeline(student._id, 'PROFILE_UPDATED', `Course set to ${course?.name || 'none'}`, '', {}, req.user);
  }
  await student.save();

  const user = await User.findById(student.userId);
  if (user) {
    if (typeof fullName === 'string' && fullName.trim()) user.fullName = fullName.trim();
    if (typeof email === 'string') {
      const e = email.trim().toLowerCase();
      if (e && e !== user.email) {
        if (await User.exists({ email: e, _id: { $ne: user._id } })) throw new AppError('Email already in use', 409, 'DUPLICATE');
        user.email = e;
      }
    }
    await user.save();
  }
  if (changes.length) await addTimeline(student._id, 'PROFILE_UPDATED', 'Profile updated', `Changed ${changes.join(', ')}`, {}, req.user);
  res.json({ success: true, message: 'Student updated' });
};

export const allocateStudent = async (req: AuthRequest, res: Response) => {
  const student = await Student.findById(oid(req.params.id, 'student'));
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
  const status = student.enrollment?.status;
  if (status === 'ON_HOLD' || status === 'DROPPED') {
    throw new AppError(`Student is ${status === 'ON_HOLD' ? 'on hold' : 'dropped'}. Rejoin the student before allocating.`, 409, 'STUDENT_INACTIVE');
  }
  const batch = await Batch.findById(oid(req.body.batchId, 'batch'));
  if (!batch) throw new AppError('Batch not found', 404, 'NOT_FOUND');
  if (['COMPLETED', 'CANCELLED'].includes(batch.status)) throw new AppError(`Batch ${batch.batchCode} is ${batch.status.toLowerCase()}`, 409, 'BATCH_CLOSED');

  const existing = await StudentBatchAllocation.findOne({
    studentId: student._id,
    subjectId: batch.subjectId,
    status: { $in: ACTIVE_ALLOCATION_STATUSES },
  }).populate('batchId', 'batchCode');
  if (existing) {
    throw new AppError(`Already allocated to ${(existing.batchId as any)?.batchCode} for this subject. Use Move/Reallocate instead.`, 409, 'ALREADY_ALLOCATED');
  }
  if ((await seatsTaken(batch._id)) >= batch.capacity) throw new AppError(`Batch ${batch.batchCode} is full`, 409, 'BATCH_FULL');

  // A student who previously missed/dropped this subject is re-attending, not starting fresh
  const hadEarlier = await StudentBatchAllocation.findOne({ studentId: student._id, subjectId: batch.subjectId }).sort({ allocationDate: -1 });
  const now = new Date();
  const allocation = await StudentBatchAllocation.create({
    studentId: student._id,
    batchId: batch._id,
    subjectId: batch.subjectId,
    courseId: student.enrollment?.courseId,
    allocationDate: now,
    startDate: batch.startDate > now ? batch.startDate : now,
    status: hadEarlier ? 'RE_ATTENDING' : batch.status === 'UPCOMING' ? 'BATCH_ALLOCATED' : 'ATTENDING',
    mode: batch.mode,
    remarks: req.body.remarks || '',
    previousAllocationId: hadEarlier?._id,
    allocatedById: req.user?.userId,
  });

  const subject = await Subject.findById(batch.subjectId);
  logBatch(batch, req, 'STUDENT_ADDED', `${student.studentId} allocated`);
  await batch.save();
  await addTimeline(student._id, 'ALLOCATED', `Allocated ${batch.batchCode}`, `${subject?.name || ''} • ${batch.timing} • ${batch.mode === 'ONLINE' ? 'Online' : 'Offline'}${req.body.remarks ? ` • ${req.body.remarks}` : ''}`, { batchId: batch._id, subjectId: batch.subjectId, allocationId: allocation._id }, req.user);
  res.status(201).json({ success: true, data: { allocation } });
};

// Closes an allocation with a non-active status (missed, reallocation required, completed…) without deleting it
export const setAllocationStatus = async (req: AuthRequest, res: Response) => {
  const allocation = await StudentBatchAllocation.findById(oid(req.params.id, 'allocation'));
  if (!allocation) throw new AppError('Allocation not found', 404, 'NOT_FOUND');
  const { status, reason = '', remarks = '' } = req.body;
  const allowed = ['MISSED', 'REALLOCATION_REQUIRED', 'COMPLETED', 'ATTENDING'];
  if (!allowed.includes(status)) throw new AppError(`Status must be one of ${allowed.join(', ')}`, 400, 'INVALID_STATUS');
  const batch = await Batch.findById(allocation.batchId);
  const previous = allocation.status;
  allocation.status = status;
  if (status !== 'ATTENDING') allocation.endDate = new Date();
  if (reason) allocation.reason = reason;
  if (remarks) allocation.remarks = remarks;
  await allocation.save();

  const label = status.replace(/_/g, ' ').toLowerCase();
  await addTimeline(
    allocation.studentId,
    status === 'COMPLETED' ? 'SUBJECT_COMPLETED' : 'ALLOCATION_STATUS',
    status === 'COMPLETED' ? `Completed ${batch?.batchCode}` : `${batch?.batchCode}: ${previous.replace(/_/g, ' ').toLowerCase()} → ${label}`,
    [reason, remarks].filter(Boolean).join(' • '),
    { batchId: allocation.batchId, subjectId: allocation.subjectId, allocationId: allocation._id },
    req.user
  );
  if (batch) {
    logBatch(batch, req, 'STUDENT_STATUS', `Allocation marked ${label}`);
    await batch.save();
  }
  res.json({ success: true, data: { allocation } });
};

// Move (same subject, different batch) or reallocate after a miss. Old row is kept and closed.
export const reallocate = async (req: AuthRequest, res: Response) => {
  const old = await StudentBatchAllocation.findById(oid(req.params.id, 'allocation'));
  if (!old) throw new AppError('Allocation not found', 404, 'NOT_FOUND');
  const { newBatchId, oldStatus = 'MOVED', reason = '', remarks = '' } = req.body;
  if (!['MOVED', 'MISSED', 'REALLOCATION_REQUIRED'].includes(oldStatus)) throw new AppError('Invalid previous status', 400, 'INVALID_STATUS');
  if (!reason.trim()) throw new AppError('A reason is required', 400, 'MISSING_FIELDS');

  const student = await Student.findById(old.studentId);
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
  if (['ON_HOLD', 'DROPPED'].includes(student.enrollment?.status || '')) {
    throw new AppError('Student is on hold/dropped. Rejoin the student first.', 409, 'STUDENT_INACTIVE');
  }
  const [oldBatch, newBatch] = await Promise.all([Batch.findById(old.batchId), Batch.findById(oid(newBatchId, 'batch'))]);
  if (!newBatch) throw new AppError('New batch not found', 404, 'NOT_FOUND');
  if (String(newBatch._id) === String(old.batchId)) throw new AppError('Choose a different batch', 400, 'SAME_BATCH');
  if (String(newBatch.subjectId) !== String(old.subjectId)) throw new AppError('New batch must be for the same subject', 400, 'SUBJECT_MISMATCH');
  if (['COMPLETED', 'CANCELLED'].includes(newBatch.status)) throw new AppError(`Batch ${newBatch.batchCode} is closed`, 409, 'BATCH_CLOSED');
  if ((await seatsTaken(newBatch._id)) >= newBatch.capacity) throw new AppError(`Batch ${newBatch.batchCode} is full`, 409, 'BATCH_FULL');

  const otherActive = await StudentBatchAllocation.exists({
    _id: { $ne: old._id },
    studentId: old.studentId,
    subjectId: old.subjectId,
    status: { $in: ACTIVE_ALLOCATION_STATUSES },
  });
  if (otherActive) throw new AppError('Student already has another active batch for this subject', 409, 'ALREADY_ALLOCATED');

  const now = new Date();
  // Only close the old seat if it is still live; a MISSED row keeps its original status/end date
  if (ACTIVE_ALLOCATION_STATUSES.includes(old.status)) {
    old.status = oldStatus;
    old.endDate = now;
    old.reason = reason;
    if (remarks) old.remarks = remarks;
    await old.save();
  }

  const allocation = await StudentBatchAllocation.create({
    studentId: old.studentId,
    batchId: newBatch._id,
    subjectId: old.subjectId,
    courseId: old.courseId,
    allocationDate: now,
    startDate: newBatch.startDate > now ? newBatch.startDate : now,
    status: oldStatus === 'MOVED' && old.status !== 'MISSED' ? (newBatch.status === 'UPCOMING' ? 'BATCH_ALLOCATED' : 'ATTENDING') : 'RE_ATTENDING',
    mode: newBatch.mode,
    reason,
    remarks,
    previousAllocationId: old._id,
    allocatedById: req.user?.userId,
  });

  if (oldBatch) {
    logBatch(oldBatch, req, 'STUDENT_REMOVED', `${student.studentId} → ${newBatch.batchCode} (${reason})`);
    await oldBatch.save();
  }
  logBatch(newBatch, req, 'STUDENT_ADDED', `${student.studentId} from ${oldBatch?.batchCode || 'previous batch'} (${reason})`);
  await newBatch.save();

  await addTimeline(
    student._id,
    oldStatus === 'MOVED' ? 'MOVED' : 'REALLOCATED',
    `${oldStatus === 'MOVED' ? 'Moved' : 'Reallocated'} ${oldBatch?.batchCode || ''} → ${newBatch.batchCode}`,
    [reason, remarks].filter(Boolean).join(' • '),
    { batchId: newBatch._id, subjectId: old.subjectId, allocationId: allocation._id },
    req.user
  );
  res.status(201).json({ success: true, data: { allocation } });
};

export const changeTrainingStatus = async (req: AuthRequest, res: Response) => {
  const student = await Student.findById(oid(req.params.id, 'student'));
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
  const { status, reason = '', remarks = '' } = req.body;
  if (!['ACTIVE', 'ON_HOLD', 'DROPPED', 'REJOINED'].includes(status)) throw new AppError('Invalid status', 400, 'INVALID_STATUS');
  if (!reason.trim()) throw new AppError('A reason is required', 400, 'MISSING_FIELDS');
  const current = student.enrollment?.status || 'ACTIVE';
  if (status === 'REJOINED' && !['ON_HOLD', 'DROPPED'].includes(current)) {
    throw new AppError('Only on-hold or dropped students can rejoin', 409, 'INVALID_STATUS');
  }

  const ctx = await loadJourneyContext([student._id]);
  const journey = buildJourney(student, ctx);
  const completedSubjectIds = journey.subjects.filter((s) => s.status === 'COMPLETED').map((s) => s.subjectId);
  const pendingSubjectIds = journey.subjects.filter((s) => s.status !== 'COMPLETED').map((s) => s.subjectId);

  // Pausing frees the student's seat but keeps the allocation row (and topic progress) for history
  if (status === 'ON_HOLD' || status === 'DROPPED') {
    const active = await StudentBatchAllocation.find({ studentId: student._id, status: { $in: ACTIVE_ALLOCATION_STATUSES } });
    for (const a of active) {
      a.status = status;
      a.endDate = new Date();
      a.reason = reason;
      await a.save();
    }
  }

  if (!student.enrollment) (student as any).enrollment = { mode: 'OFFLINE', preferredTiming: '', remarks: '' };
  (student.enrollment as any).status = status;
  student.statusHistory.push({
    status,
    date: new Date(),
    reason,
    remarks,
    completedSubjectIds: completedSubjectIds as any,
    pendingSubjectIds: pendingSubjectIds as any,
    byUserId: req.user?.userId as any,
  });
  await student.save();

  const titles: Record<string, string> = {
    ON_HOLD: 'Put on hold',
    DROPPED: 'Dropped',
    ACTIVE: 'Marked active',
    REJOINED: 'Rejoined — previous progress restored',
  };
  await addTimeline(student._id, status === 'REJOINED' ? 'REJOINED' : 'STATUS_CHANGED', titles[status], [reason, remarks].filter(Boolean).join(' • '), {}, req.user);
  res.json({ success: true, message: titles[status] });
};

export const changeMode = async (req: AuthRequest, res: Response) => {
  const student = await Student.findById(oid(req.params.id, 'student'));
  if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
  const { mode, reason = '' } = req.body;
  if (!['ONLINE', 'OFFLINE'].includes(mode)) throw new AppError('Mode must be ONLINE or OFFLINE', 400, 'INVALID_MODE');
  const from = student.enrollment?.mode || 'OFFLINE';
  if (from === mode) throw new AppError(`Student is already ${mode.toLowerCase()}`, 409, 'NO_CHANGE');

  const now = new Date();
  const open = [...student.modeHistory].reverse().find((m) => !m.to);
  if (open) open.to = now;
  else student.modeHistory.push({ mode: from, from: student.enrollment?.joiningDate || student.createdAt, to: now, reason: 'Initial mode' });
  student.modeHistory.push({ mode, from: now, reason, byUserId: req.user?.userId as any });
  if (!student.enrollment) (student as any).enrollment = { status: 'ACTIVE', preferredTiming: '', remarks: '' };
  (student.enrollment as any).mode = mode;
  await student.save();

  const label = (m: string) => (m === 'ONLINE' ? 'Online' : 'Offline');
  await addTimeline(student._id, 'MODE_CHANGED', `Mode changed ${label(from)} → ${label(mode)}`, reason, {}, req.user);
  res.json({ success: true, message: 'Mode updated' });
};

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

const summarizeBatch = (b: any, subject: any, trainer: any, studentCount: number) => {
  const progress = batchProgress(b, subject);
  const estimate = estimateBatchCompletion(b, subject);
  return {
    _id: b._id,
    batchCode: b.batchCode,
    subject: subject ? { _id: subject._id, name: subject.name, code: subject.code } : null,
    trainer: trainer ? { _id: trainer._id, fullName: trainer.fullName } : null,
    mode: b.mode,
    timing: b.timing,
    startDate: b.startDate,
    expectedEndDate: b.expectedEndDate,
    actualEndDate: b.actualEndDate,
    capacity: b.capacity,
    studentCount,
    availableSeats: Math.max(0, b.capacity - studentCount),
    status: effectiveBatchStatus(b),
    storedStatus: b.status,
    remarks: b.remarks,
    classesConducted: b.classesConducted,
    progress,
    estimatedCompletion: estimate.expectedDate,
    estimateBasis: estimate.basis,
    avgTopicsPerClass: estimate.avgTopicsPerClass,
  };
};

async function listBatchSummaries(filter: Record<string, any> = {}) {
  const batches = await Batch.find(filter).sort({ startDate: -1 }).lean();
  const [subjects, trainers, counts] = await Promise.all([
    Subject.find({ _id: { $in: batches.map((b) => b.subjectId) } }).lean(),
    User.find({ _id: { $in: batches.map((b) => b.trainerId).filter(Boolean) } }).select('fullName').lean(),
    StudentBatchAllocation.aggregate([
      { $match: { batchId: { $in: batches.map((b) => b._id) }, status: { $in: ACTIVE_ALLOCATION_STATUSES } } },
      { $group: { _id: '$batchId', count: { $sum: 1 } } },
    ]),
  ]);
  const subjectMap = new Map(subjects.map((s: any) => [String(s._id), s]));
  const trainerMap = new Map(trainers.map((t: any) => [String(t._id), t]));
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  return batches.map((b) =>
    summarizeBatch(b, subjectMap.get(String(b.subjectId)), b.trainerId ? trainerMap.get(String(b.trainerId)) : null, countMap.get(String(b._id)) || 0)
  );
}

export const listBatches = async (req: AuthRequest, res: Response) => {
  const filter: Record<string, any> = {};
  if (req.query.subjectId && mongoose.isValidObjectId(req.query.subjectId)) filter.subjectId = req.query.subjectId;
  res.json({ success: true, data: { batches: await listBatchSummaries(filter) } });
};

export const createBatch = async (req: AuthRequest, res: Response) => {
  const { subjectId, trainerId, mode = 'OFFLINE', timing, startDate, expectedEndDate, capacity = 30, remarks = '' } = req.body;
  const subject = await Subject.findById(oid(subjectId, 'subject'));
  if (!subject) throw new AppError('Subject not found', 404, 'NOT_FOUND');
  if (!timing?.trim()) throw new AppError('Timing is required', 400, 'MISSING_FIELDS');
  if (!startDate) throw new AppError('Start date is required', 400, 'MISSING_FIELDS');
  if (trainerId && !(await User.exists({ _id: oid(trainerId, 'trainer'), role: 'TRAINER' }))) {
    throw new AppError('Trainer not found', 404, 'NOT_FOUND');
  }
  const batchCode = req.body.batchCode?.trim().toUpperCase() || (await nextBatchCode(String(subject._id)));
  if (await Batch.exists({ batchCode })) throw new AppError(`Batch ID ${batchCode} already exists`, 409, 'DUPLICATE');

  const start = new Date(startDate);
  const batch = await Batch.create({
    batchCode,
    subjectId: subject._id,
    trainerId: trainerId || undefined,
    mode,
    timing: timing.trim(),
    startDate: start,
    expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : new Date(start.getTime() + subject.expectedDurationDays * DAY_MS),
    capacity: Number(capacity) || 30,
    status: start.getTime() <= Date.now() ? 'RUNNING' : 'UPCOMING',
    remarks,
    history: [{ at: new Date(), action: 'CREATED', details: `${subject.name} • ${timing}`, byUserId: req.user?.userId }],
  });
  res.status(201).json({ success: true, data: { batch } });
};

// Admin batch actions: change trainer/timing, extend end date, start, complete, cancel
export const updateBatch = async (req: AuthRequest, res: Response) => {
  const batch = await Batch.findById(oid(req.params.id, 'batch'));
  if (!batch) throw new AppError('Batch not found', 404, 'NOT_FOUND');
  const { trainerId, timing, expectedEndDate, capacity, remarks, status, mode } = req.body;

  if (trainerId !== undefined && String(trainerId || '') !== String(batch.trainerId || '')) {
    const trainer = trainerId ? await User.findOne({ _id: oid(trainerId, 'trainer'), role: 'TRAINER' }) : null;
    if (trainerId && !trainer) throw new AppError('Trainer not found', 404, 'NOT_FOUND');
    logBatch(batch, req, 'TRAINER_CHANGED', `Trainer → ${trainer?.fullName || 'unassigned'}`);
    batch.trainerId = trainer?._id;
  }
  if (typeof timing === 'string' && timing.trim() && timing.trim() !== batch.timing) {
    logBatch(batch, req, 'TIMING_CHANGED', `${batch.timing} → ${timing.trim()}`);
    batch.timing = timing.trim();
  }
  if (mode && mode !== batch.mode && ['ONLINE', 'OFFLINE'].includes(mode)) {
    logBatch(batch, req, 'MODE_CHANGED', `${batch.mode} → ${mode}`);
    batch.mode = mode;
  }
  if (expectedEndDate) {
    const next = new Date(expectedEndDate);
    if (next.getTime() !== batch.expectedEndDate.getTime()) {
      logBatch(batch, req, 'END_DATE_CHANGED', `${batch.expectedEndDate.toDateString()} → ${next.toDateString()}`);
      batch.expectedEndDate = next;
    }
  }
  if (capacity !== undefined && Number(capacity) > 0) batch.capacity = Number(capacity);
  if (typeof remarks === 'string') batch.remarks = remarks;

  if (status && status !== batch.status) {
    if (!['UPCOMING', 'RUNNING', 'COMPLETED', 'CANCELLED'].includes(status)) throw new AppError('Invalid batch status', 400, 'INVALID_STATUS');
    logBatch(batch, req, 'STATUS_CHANGED', `${batch.status} → ${status}`);
    batch.status = status;
    const active = await StudentBatchAllocation.find({ batchId: batch._id, status: { $in: ACTIVE_ALLOCATION_STATUSES } });
    const subject = await Subject.findById(batch.subjectId);
    if (status === 'RUNNING') {
      await StudentBatchAllocation.updateMany({ batchId: batch._id, status: 'BATCH_ALLOCATED' }, { status: 'ATTENDING' });
    }
    if (status === 'COMPLETED') {
      batch.actualEndDate = new Date();
      for (const a of active) {
        a.status = 'COMPLETED';
        a.endDate = new Date();
        await a.save();
        await addTimeline(a.studentId, 'SUBJECT_COMPLETED', `${subject?.name || 'Subject'} completed`, `Batch ${batch.batchCode} completed`, { batchId: batch._id, subjectId: batch.subjectId, allocationId: a._id }, req.user);
      }
    }
    if (status === 'CANCELLED') {
      for (const a of active) {
        a.status = 'REALLOCATION_REQUIRED';
        a.endDate = new Date();
        a.reason = 'Batch cancelled';
        await a.save();
        await addTimeline(a.studentId, 'ALLOCATION_STATUS', `${batch.batchCode} cancelled — reallocation required`, '', { batchId: batch._id, subjectId: batch.subjectId, allocationId: a._id }, req.user);
      }
    }
  }
  await batch.save();
  res.json({ success: true, data: { batch } });
};

export const getBatchDetail = async (req: AuthRequest, res: Response) => {
  const batch = await Batch.findById(oid(req.params.id, 'batch')).lean();
  if (!batch) throw new AppError('Batch not found', 404, 'NOT_FOUND');
  if (!isAdmin(req) && String(batch.trainerId) !== String(req.user?.userId)) {
    throw new AppError('You can only view batches assigned to you', 403, 'FORBIDDEN');
  }
  const [subject, trainer, allocations, updates, sessions] = await Promise.all([
    Subject.findById(batch.subjectId).lean(),
    batch.trainerId ? User.findById(batch.trainerId).select('fullName').lean() : null,
    StudentBatchAllocation.find({ batchId: batch._id }).sort({ allocationDate: -1 }),
    TrainerDailyUpdate.find({ batchId: batch._id }).sort({ date: -1, createdAt: -1 }).populate('trainerId', 'fullName').lean(),
    Attendance.find({ batchId: batch._id }).sort({ date: -1 }).lean(),
  ]);
  const students = await Student.find({ _id: { $in: allocations.map((a) => a.studentId) } }).populate('userId', 'fullName').lean();
  const studentMap = new Map(students.map((s: any) => [String(s._id), s]));
  const totalTopics = subject?.topics?.length || 0;

  const rows = allocations.map((a) => {
    const s: any = studentMap.get(String(a.studentId));
    const covered = topicsCoveredInAllocation(a, updates as any).size;
    return {
      allocationId: a._id,
      studentMongoId: a.studentId,
      studentId: s?.studentId,
      fullName: s?.userId?.fullName || 'Student',
      trainingStatus: s?.enrollment?.status || 'ACTIVE',
      status: a.status,
      active: ACTIVE_ALLOCATION_STATUSES.includes(a.status),
      mode: a.mode,
      allocationDate: a.allocationDate,
      endDate: a.endDate,
      reason: a.reason,
      remarks: a.remarks,
      attendance: attendanceForAllocation(a, sessions),
      progress: { completed: covered, total: totalTopics, percentage: totalTopics ? Math.round((covered / totalTopics) * 100) : 0 },
    };
  });

  const activeCount = rows.filter((r) => r.active).length;
  const completedIds = new Set((batch.completedTopicIds || []).map(String));
  res.json({
    success: true,
    data: {
      batch: summarizeBatch(batch, subject, trainer, activeCount),
      topics: (subject?.topics || [])
        .slice()
        .sort((a: any, b: any) => a.order - b.order)
        .map((t: any) => ({ _id: t._id, title: t.title, order: t.order, completed: completedIds.has(String(t._id)) })),
      students: rows.filter((r) => r.active),
      pastStudents: rows.filter((r) => !r.active),
      updates,
      attendance: sessions,
      history: [...(batch.history || [])].reverse(),
    },
  });
};

// ---------------------------------------------------------------------------
// Trainer: own batches + daily class update with attendance
// ---------------------------------------------------------------------------

export const listMyBatches = async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { batches: await listBatchSummaries({ trainerId: req.user?.userId }) } });
};

export const submitDailyUpdate = async (req: AuthRequest, res: Response) => {
  const batch = await Batch.findById(oid(req.params.id, 'batch'));
  if (!batch) throw new AppError('Batch not found', 404, 'NOT_FOUND');
  if (!isAdmin(req) && String(batch.trainerId) !== String(req.user?.userId)) {
    throw new AppError('You can only update batches assigned to you', 403, 'FORBIDDEN');
  }
  if (['COMPLETED', 'CANCELLED'].includes(batch.status)) throw new AppError('This batch is closed', 409, 'BATCH_CLOSED');

  const {
    date,
    classConducted = true,
    topicTaught = '',
    topicCompleted = false,
    completedTopicIds = [],
    additionalTopic = '',
    nextTopic = '',
    remarks = '',
    attendance = [],
  } = req.body;
  const classDate = date ? new Date(date) : new Date();
  if (Number.isNaN(classDate.getTime())) throw new AppError('Invalid date', 400, 'INVALID_DATE');

  const subject = await Subject.findById(batch.subjectId);
  const validTopicIds = new Set((subject?.topics || []).map((t) => String(t._id)));
  const topicIds = (completedTopicIds as string[]).filter((id) => validTopicIds.has(String(id)));

  let attendanceId;
  if (classConducted && attendance.length) {
    const seated = await StudentBatchAllocation.find({ batchId: batch._id, status: { $in: ACTIVE_ALLOCATION_STATUSES } }).select('studentId');
    const seatedIds = new Set(seated.map((a) => String(a.studentId)));
    const records = (attendance as any[])
      .filter((r) => seatedIds.has(String(r.studentId)) && ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(r.status))
      .map((r) => ({ studentId: r.studentId, status: r.status, remarks: r.remarks || '' }));
    const session = await Attendance.create({
      batchId: batch._id,
      trainerId: batch.trainerId || req.user?.userId,
      sessionName: `${batch.batchCode} • ${classDate.toDateString()}`,
      date: classDate,
      records,
    });
    attendanceId = session._id;
  }

  const update = await TrainerDailyUpdate.create({
    batchId: batch._id,
    trainerId: batch.trainerId || req.user?.userId,
    date: classDate,
    classConducted,
    topicTaught,
    topicCompleted,
    completedTopicIds: topicIds,
    additionalTopic,
    nextTopic,
    remarks,
    attendanceId,
  });

  const before = batch.completedTopicIds.length;
  const merged = new Set([...batch.completedTopicIds.map(String), ...topicIds]);
  batch.completedTopicIds = [...merged].map((id) => new mongoose.Types.ObjectId(id));
  if (classConducted) batch.classesConducted += 1;
  if (batch.status === 'UPCOMING' && classConducted) {
    batch.status = 'RUNNING';
    await StudentBatchAllocation.updateMany({ batchId: batch._id, status: 'BATCH_ALLOCATED' }, { status: 'ATTENDING' });
  }
  logBatch(
    batch,
    req,
    'CLASS_UPDATE',
    classConducted ? `Class on ${classDate.toDateString()}: ${topicTaught || 'update'} (+${batch.completedTopicIds.length - before} topics)` : `No class on ${classDate.toDateString()}${remarks ? `: ${remarks}` : ''}`
  );
  await batch.save();

  res.status(201).json({ success: true, data: { update, progress: batchProgress(batch, subject) } });
};

// ---------------------------------------------------------------------------
// Admin overview, planning, next allocations, trainers, global history
// ---------------------------------------------------------------------------

export const getOverview = async (_req: AuthRequest, res: Response) => {
  const students: any[] = await Student.find({}).select('studentId phone enrollment enrollmentDate registrationSource userId createdAt biometricId cardNumber').populate('userId', 'fullName email').lean();
  const ctx = await loadJourneyContext(students.map((s) => s._id));
  const summaries = students.map((s) => summarizeStudent(s, buildJourney(s, ctx)));
  const batches = await listBatchSummaries();
  const enrolled = summaries.filter((s) => s.course);
  const now = Date.now();

  const completingSoon = enrolled.filter((s) => s.currentSubject?.completingSoon);

  // Why each student needs a look, most urgent first
  const attention = enrolled
    .map((s) => {
      const att = s.currentSubject?.attendance;
      let reason: string | null = null;
      let tone: string = s.allocationStatus;
      if (s.allocationStatus === 'REALLOCATION_REQUIRED') reason = `Needs ${s.needsReallocationSubject || 'batch'} reallocation`;
      else if (att && att.percentage !== null && att.total >= 5 && att.percentage < 70) {
        reason = `Attendance ${att.percentage}% in ${s.currentSubject!.name}`;
        tone = 'MISSED';
      } else if (s.currentBatch?.status === 'DELAYED') {
        reason = `Batch ${s.currentBatch.batchCode} delayed`;
        tone = 'DELAYED';
      } else if (s.trainingStatus === 'ON_HOLD') {
        reason = 'On hold';
        tone = 'ON_HOLD';
      } else if (s.allocationStatus === 'WAITING') reason = `Waiting for ${s.nextSubject?.name || 'next'} batch`;
      return reason ? { ...s, attentionReason: reason, attentionTone: tone } : null;
    })
    .filter(Boolean) as any[];
  const priority = (r: string) => (r.startsWith('Needs') ? 0 : r.startsWith('Attendance') ? 1 : r.startsWith('Batch') ? 2 : r === 'On hold' ? 3 : 4);
  attention.sort((a, b) => priority(a.attentionReason) - priority(b.attentionReason));

  // Students whose next (or missed) subject matches an upcoming batch
  const waitingFor = (subjectName?: string) =>
    enrolled.filter(
      (s) =>
        ['ACTIVE', 'REJOINED'].includes(s.trainingStatus) &&
        subjectName &&
        (s.nextSubject?.name === subjectName || s.needsReallocationSubject === subjectName) &&
        s.currentSubject?.name !== subjectName
    ).length;

  const recent = await StudentTimeline.find({}).sort({ date: -1, createdAt: -1 }).limit(12).populate({ path: 'studentId', select: 'studentId userId', populate: { path: 'userId', select: 'fullName' } }).lean();

  const trainerMap = new Map<string, { trainer: any; batches: any[] }>();
  batches
    .filter((b) => b.trainer && ['RUNNING', 'DELAYED', 'UPCOMING'].includes(b.status))
    .forEach((b) => {
      const key = String(b.trainer!._id);
      if (!trainerMap.has(key)) trainerMap.set(key, { trainer: b.trainer, batches: [] });
      trainerMap.get(key)!.batches.push(b);
    });

  res.json({
    success: true,
    data: {
      metrics: {
        // Every student counts, including ones without a course yet (e.g. imported from the eSSL machine)
        totalStudents: summaries.length,
        noCourse: summaries.length - enrolled.length,
        activeStudents: summaries.filter((s) => s.trainingStatus === 'ACTIVE').length,
        onlineStudents: summaries.filter((s) => s.mode === 'ONLINE').length,
        offlineStudents: summaries.filter((s) => s.mode === 'OFFLINE').length,
        droppedOrOnHold: summaries.filter((s) => ['DROPPED', 'ON_HOLD'].includes(s.trainingStatus)).length,
        rejoining: summaries.filter((s) => s.trainingStatus === 'REJOINED').length,
        runningBatches: batches.filter((b) => b.status === 'RUNNING').length,
        upcomingBatches: batches.filter((b) => b.status === 'UPCOMING').length,
        delayedBatches: batches.filter((b) => b.status === 'DELAYED').length,
        completedBatches: batches.filter((b) => b.status === 'COMPLETED').length,
        waitingForAllocation: enrolled.filter((s) => s.allocationStatus === 'WAITING').length,
        requiringReallocation: enrolled.filter((s) => s.allocationStatus === 'REALLOCATION_REQUIRED').length,
        completingSoon: completingSoon.length,
        pendingRegistrations: await StudentRegistration.countDocuments({ verificationStatus: 'PENDING' }),
      },
      attention: attention.slice(0, 10),
      upcomingBatches: batches
        .filter((b) => b.status === 'UPCOMING' && new Date(b.startDate).getTime() - now < 45 * DAY_MS)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .map((b) => ({ ...b, waitingStudents: waitingFor(b.subject?.name) })),
      delayedBatches: batches.filter((b) => b.status === 'DELAYED'),
      trainerProgress: [...trainerMap.values()],
      recentActivity: recent,
    },
  });
};

export const getNextAllocations = async (_req: AuthRequest, res: Response) => {
  const students = await Student.find({ 'enrollment.courseId': { $ne: null }, 'enrollment.status': { $in: ['ACTIVE', 'REJOINED'] } }).populate('userId', 'fullName email');
  const ctx = await loadJourneyContext(students.map((s) => s._id));
  const rows: any[] = [];
  students.forEach((s) => {
    const journey = buildJourney(s, ctx);
    const summary = summarizeStudent(s, journey);
    const current = journey.current;
    const needsRealloc = journey.subjects.find((x) => ['MISSED', 'REALLOCATION_REQUIRED', 'ON_HOLD', 'DROPPED'].includes(x.status));
    let reason: string | null = null;
    let targetSubject: any = null;
    let recommended = new Date();

    if (needsRealloc) {
      reason = 'REALLOCATION_REQUIRED';
      targetSubject = needsRealloc;
    } else if (!current && journey.next) {
      reason = journey.completedCount > 0 ? 'SUBJECT_COMPLETED' : 'NOT_STARTED';
      targetSubject = journey.next;
    } else if (current && isCompletingSoon(current) && journey.next) {
      reason = 'NEARLY_COMPLETED';
      targetSubject = journey.next;
      if (current.expectedEndDate) recommended = new Date(current.expectedEndDate);
    }
    if (!reason) return;
    rows.push({
      ...summary,
      reason,
      currentProgress: current?.progress || null,
      currentExpectedEnd: current?.expectedEndDate || null,
      targetSubject: targetSubject ? { subjectId: targetSubject.subjectId, name: targetSubject.name, status: targetSubject.status, latestAllocationId: targetSubject.latestAllocationId } : null,
      recommendedMonth: `${recommended.getFullYear()}-${String(recommended.getMonth() + 1).padStart(2, '0')}`,
    });
  });
  res.json({ success: true, data: { rows } });
};

export const getMonthlyPlanning = async (req: AuthRequest, res: Response) => {
  const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : null;
  const now = new Date();
  const [y, m] = month ? month.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  const all = await listBatchSummaries({
    startDate: { $lte: end },
    status: { $ne: 'CANCELLED' },
  });
  const batches = all.filter((b) => new Date(b.actualEndDate || b.estimatedCompletion || b.expectedEndDate).getTime() >= start.getTime());
  res.json({ success: true, data: { month: `${y}-${String(m).padStart(2, '0')}`, batches } });
};

export const listTrainers = async (_req: AuthRequest, res: Response) => {
  const trainers = await User.find({ role: 'TRAINER' }).select('fullName email').sort({ fullName: 1 }).lean();
  const batches = await listBatchSummaries({ trainerId: { $in: trainers.map((t) => t._id) } });
  res.json({
    success: true,
    data: {
      trainers: trainers.map((t: any) => {
        const own = batches.filter((b) => String(b.trainer?._id) === String(t._id));
        const live = own.filter((b) => ['RUNNING', 'DELAYED', 'UPCOMING'].includes(b.status));
        return {
          _id: t._id,
          fullName: t.fullName,
          email: t.email,
          assignedBatches: live.length,
          currentSubjects: [...new Set(live.map((b) => b.subject?.name).filter(Boolean))],
          classesConducted: own.reduce((s, b) => s + (b.classesConducted || 0), 0),
          topicsCompleted: own.reduce((s, b) => s + b.progress.completed, 0),
          delayedBatches: own.filter((b) => b.status === 'DELAYED').length,
          batches: own,
        };
      }),
    },
  });
};

export const getGlobalTimeline = async (req: AuthRequest, res: Response) => {
  const limit = Math.min(300, Number(req.query.limit) || 100);
  const events = await StudentTimeline.find({})
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .populate({ path: 'studentId', select: 'studentId userId', populate: { path: 'userId', select: 'fullName' } })
    .lean();
  res.json({ success: true, data: { events } });
};

// ---------------------------------------------------------------------------
// Student self-service (read only; allocation is admin-controlled)
// ---------------------------------------------------------------------------

export const getMyJourney = async (req: AuthRequest, res: Response) => {
  const student = await Student.findOne({ userId: req.user?.userId });
  if (!student) throw new AppError('Student profile not found', 404, 'NOT_FOUND');
  const result = await getStudentJourney(String(student._id));
  res.json({
    success: true,
    data: {
      journey: result?.journey,
      enrollment: student.enrollment,
      joiningDate: student.enrollment?.joiningDate || student.enrollmentDate,
    },
  });
};
