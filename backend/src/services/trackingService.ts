import mongoose from 'mongoose';
import { Student, IStudent } from '../models/Student';
import { User } from '../models/User';
import { Attendance } from '../models/Attendance';
import { Subject, ISubject } from '../models/tracking/Subject';
import { TrackCourse, ITrackCourse } from '../models/tracking/TrackCourse';
import { Batch, IBatch } from '../models/tracking/Batch';
import {
  StudentBatchAllocation,
  IStudentBatchAllocation,
  ACTIVE_ALLOCATION_STATUSES,
} from '../models/tracking/StudentBatchAllocation';
import { TrainerDailyUpdate, ITrainerDailyUpdate } from '../models/tracking/TrainerDailyUpdate';
import { StudentTimeline, TimelineEventType } from '../models/tracking/StudentTimeline';
import { AuthUserPayload } from '../middleware/auth';

export type SubjectJourneyStatus =
  | 'NOT_STARTED'
  | 'UPCOMING'
  | 'BATCH_ALLOCATED'
  | 'ATTENDING'
  | 'RE_ATTENDING'
  | 'COMPLETED'
  | 'MISSED'
  | 'REALLOCATION_REQUIRED'
  | 'ON_HOLD'
  | 'DROPPED';

export const PLACEHOLDER_EMAIL_DOMAIN = 'students.scholarlogic.local';
export const isPlaceholderEmail = (email?: string) => !!email && email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`);

const DAY_MS = 86400000;
const startOfDay = (d: Date | string) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const isActiveAllocation = (a: Pick<IStudentBatchAllocation, 'status'>) =>
  ACTIVE_ALLOCATION_STATUSES.includes(a.status);

// RUNNING batches past their expected end are shown as DELAYED without mutating the stored status
export const effectiveBatchStatus = (batch: Pick<IBatch, 'status' | 'expectedEndDate'>, now = new Date()) =>
  batch.status === 'RUNNING' && new Date(batch.expectedEndDate).getTime() < startOfDay(now).getTime()
    ? 'DELAYED'
    : batch.status;

export const batchProgress = (batch: Pick<IBatch, 'completedTopicIds'>, subject?: Pick<ISubject, 'topics'> | null) => {
  const total = subject?.topics?.length || 0;
  const completed = (batch.completedTopicIds || []).length;
  return { completed, total, percentage: total ? Math.round((completed / total) * 100) : 0 };
};

// Adds `classDays` teaching days (Mon–Sat) to `from`
const addClassDays = (from: Date, classDays: number) => {
  const d = startOfDay(from);
  let added = 0;
  while (added < classDays) {
    d.setTime(d.getTime() + DAY_MS);
    if (d.getDay() !== 0) added += 1;
  }
  return d;
};

/**
 * Deterministic completion estimate:
 * avgTopicsPerClass = completedTopics / classesConducted
 * remainingClasses  = ceil(remainingTopics / avgTopicsPerClass)
 * expected          = today + remainingClasses teaching days
 * Falls back to the batch's planned end date until there is class data.
 */
export const estimateBatchCompletion = (
  batch: Pick<IBatch, 'completedTopicIds' | 'classesConducted' | 'expectedEndDate' | 'status' | 'actualEndDate'>,
  subject?: Pick<ISubject, 'topics'> | null
) => {
  const { completed, total } = batchProgress(batch, subject);
  if (batch.status === 'COMPLETED') {
    return { expectedDate: batch.actualEndDate || batch.expectedEndDate, basis: 'COMPLETED' as const, avgTopicsPerClass: 0, remainingTopics: 0 };
  }
  const remainingTopics = Math.max(0, total - completed);
  if (!batch.classesConducted || !completed) {
    return { expectedDate: batch.expectedEndDate, basis: 'PLANNED' as const, avgTopicsPerClass: 0, remainingTopics };
  }
  const avgTopicsPerClass = completed / batch.classesConducted;
  const remainingClasses = Math.ceil(remainingTopics / avgTopicsPerClass);
  return {
    expectedDate: remainingTopics === 0 ? new Date() : addClassDays(new Date(), remainingClasses),
    basis: 'PACE' as const,
    avgTopicsPerClass: Math.round(avgTopicsPerClass * 100) / 100,
    remainingTopics,
  };
};

// Window during which a student was actually seated in the batch
const allocationWindow = (a: IStudentBatchAllocation) => ({
  from: startOfDay(a.startDate || a.allocationDate).getTime(),
  to: a.endDate ? startOfDay(a.endDate).getTime() + DAY_MS - 1 : Number.MAX_SAFE_INTEGER,
});

const inWindow = (date: Date, w: { from: number; to: number }) => {
  const t = new Date(date).getTime();
  return t >= w.from && t <= w.to;
};

export const topicsCoveredInAllocation = (a: IStudentBatchAllocation, updates: ITrainerDailyUpdate[]) => {
  const w = allocationWindow(a);
  const ids = new Set<string>();
  updates
    .filter((u) => String(u.batchId) === String(a.batchId) && inWindow(u.date, w))
    .forEach((u) => (u.completedTopicIds || []).forEach((t) => ids.add(String(t))));
  return ids;
};

export const attendanceForAllocation = (a: IStudentBatchAllocation, sessions: any[]) => {
  const w = allocationWindow(a);
  const tally = { present: 0, late: 0, absent: 0, excused: 0, total: 0 };
  sessions
    .filter((s) => String(s.batchId) === String(a.batchId) && inWindow(s.date, w))
    .forEach((s) => {
      const rec = (s.records || []).find((r: any) => String(r.studentId) === String(a.studentId));
      if (!rec) return;
      tally.total += 1;
      if (rec.status === 'PRESENT') tally.present += 1;
      else if (rec.status === 'LATE') tally.late += 1;
      else if (rec.status === 'EXCUSED') tally.excused += 1;
      else tally.absent += 1;
    });
  const attended = tally.present + tally.late;
  return { ...tally, attended, percentage: tally.total ? Math.round((attended / tally.total) * 100) : null };
};

const journeyStatusFromAllocation = (a: IStudentBatchAllocation, batch?: IBatch | null): SubjectJourneyStatus => {
  switch (a.status) {
    case 'BATCH_ALLOCATED':
      return batch && ['RUNNING', 'DELAYED'].includes(batch.status) ? 'ATTENDING' : 'BATCH_ALLOCATED';
    case 'MOVED':
      return 'REALLOCATION_REQUIRED';
    default:
      return a.status as SubjectJourneyStatus;
  }
};

export async function addTimeline(
  studentId: mongoose.Types.ObjectId | string,
  type: TimelineEventType,
  title: string,
  details = '',
  refs: { batchId?: any; subjectId?: any; allocationId?: any } = {},
  actor?: AuthUserPayload,
  date = new Date()
) {
  return StudentTimeline.create({
    studentId,
    type,
    title,
    details,
    date,
    ...refs,
    byUserId: actor?.userId,
    byName: actor?.fullName || '',
  });
}

interface JourneyContext {
  subjectsById: Map<string, ISubject>;
  batchesById: Map<string, any>;
  coursesById: Map<string, ITrackCourse>;
  trainersById: Map<string, { _id: any; fullName: string }>;
  allocationsByStudent: Map<string, IStudentBatchAllocation[]>;
  updates: ITrainerDailyUpdate[];
  sessions: any[];
}

// Loads everything needed to compute journeys for the given students in a few bulk queries
export async function loadJourneyContext(studentIds: mongoose.Types.ObjectId[]): Promise<JourneyContext> {
  const allocations = await StudentBatchAllocation.find({ studentId: { $in: studentIds } }).sort({ allocationDate: 1, createdAt: 1 });
  const batchIds = [...new Set(allocations.map((a) => String(a.batchId)))];
  const [batches, subjects, courses, updates, sessions] = await Promise.all([
    Batch.find({ _id: { $in: batchIds } }).lean(),
    Subject.find({}),
    TrackCourse.find({}),
    TrainerDailyUpdate.find({ batchId: { $in: batchIds } }),
    Attendance.find({ batchId: { $in: batchIds } }).lean(),
  ]);
  const trainerIds = [...new Set(batches.map((b: any) => b.trainerId && String(b.trainerId)).filter(Boolean))];
  const trainers = await User.find({ _id: { $in: trainerIds } }).select('fullName').lean();

  const allocationsByStudent = new Map<string, IStudentBatchAllocation[]>();
  allocations.forEach((a) => {
    const key = String(a.studentId);
    if (!allocationsByStudent.has(key)) allocationsByStudent.set(key, []);
    allocationsByStudent.get(key)!.push(a);
  });

  return {
    subjectsById: new Map(subjects.map((s) => [String(s._id), s])),
    batchesById: new Map(batches.map((b: any) => [String(b._id), b])),
    coursesById: new Map(courses.map((c) => [String(c._id), c])),
    trainersById: new Map(trainers.map((t: any) => [String(t._id), t])),
    allocationsByStudent,
    updates,
    sessions,
  };
}

const describeBatch = (batch: any, ctx: JourneyContext) =>
  batch
    ? {
        _id: batch._id,
        batchCode: batch.batchCode,
        timing: batch.timing,
        mode: batch.mode,
        status: effectiveBatchStatus(batch),
        startDate: batch.startDate,
        expectedEndDate: batch.expectedEndDate,
        trainer: batch.trainerId ? ctx.trainersById.get(String(batch.trainerId)) || null : null,
      }
    : null;

export function buildJourney(student: IStudent | any, ctx: JourneyContext) {
  const allocations = ctx.allocationsByStudent.get(String(student._id)) || [];
  const course = student.enrollment?.courseId ? ctx.coursesById.get(String(student.enrollment.courseId)) : undefined;
  const orderedCourseSubjects = course ? [...course.subjects].sort((a, b) => a.order - b.order) : [];

  // Subjects in the course plus any subject the student was allocated outside it
  const subjectIds = [
    ...orderedCourseSubjects.map((cs) => String(cs.subjectId)),
    ...allocations.map((a) => String(a.subjectId)).filter((id, i, arr) => arr.indexOf(id) === i),
  ].filter((id, i, arr) => arr.indexOf(id) === i);

  const hasStartedAnything = allocations.length > 0;

  const subjects = subjectIds.map((subjectId) => {
    const subject = ctx.subjectsById.get(subjectId);
    const courseEntry = orderedCourseSubjects.find((cs) => String(cs.subjectId) === subjectId);
    const subjectAllocations = allocations.filter((a) => String(a.subjectId) === subjectId);
    const latest = subjectAllocations[subjectAllocations.length - 1];
    const latestBatch = latest ? ctx.batchesById.get(String(latest.batchId)) : null;

    const covered = new Set<string>();
    if (subjectAllocations.some((a) => a.status === 'COMPLETED')) {
      (subject?.topics || []).forEach((t) => covered.add(String(t._id)));
    } else {
      subjectAllocations.forEach((a) => topicsCoveredInAllocation(a, ctx.updates).forEach((t) => covered.add(t)));
    }
    const topics = (subject?.topics || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((t) => ({ _id: t._id, title: t.title, order: t.order, completed: covered.has(String(t._id)) }));
    const completedCount = topics.filter((t) => t.completed).length;
    const currentTopic = topics.find((t) => !t.completed) || null;

    let status: SubjectJourneyStatus;
    if (latest) status = journeyStatusFromAllocation(latest, latestBatch);
    else status = hasStartedAnything ? 'UPCOMING' : 'NOT_STARTED';

    const history = subjectAllocations
      .slice()
      .reverse()
      .map((a) => {
        const b = ctx.batchesById.get(String(a.batchId));
        return {
          _id: a._id,
          status: a.status,
          allocationDate: a.allocationDate,
          startDate: a.startDate,
          endDate: a.endDate,
          reason: a.reason,
          remarks: a.remarks,
          mode: a.mode,
          previousAllocationId: a.previousAllocationId,
          batch: describeBatch(b, ctx),
          attendance: attendanceForAllocation(a, ctx.sessions),
          topicsCovered: topicsCoveredInAllocation(a, ctx.updates).size,
        };
      });

    const totalAttendance = history.reduce(
      (acc, h) => ({ attended: acc.attended + h.attendance.attended, total: acc.total + h.attendance.total }),
      { attended: 0, total: 0 }
    );

    return {
      subjectId,
      name: subject?.name || 'Subject',
      code: subject?.code || '',
      order: courseEntry?.order ?? 999,
      inCourse: !!courseEntry,
      expectedDurationDays: courseEntry?.expectedDurationDays || subject?.expectedDurationDays || 30,
      status,
      progress: { completed: completedCount, total: topics.length, percentage: topics.length ? Math.round((completedCount / topics.length) * 100) : 0 },
      topics,
      currentTopic,
      currentAllocationId: latest && isActiveAllocation(latest) ? latest._id : null,
      latestAllocationId: latest?._id || null,
      batch: describeBatch(latestBatch, ctx),
      startDate: latest?.startDate || null,
      expectedEndDate: latestBatch ? estimateBatchCompletion(latestBatch, subject).expectedDate : null,
      attendance: {
        ...totalAttendance,
        percentage: totalAttendance.total ? Math.round((totalAttendance.attended / totalAttendance.total) * 100) : null,
      },
      reallocations: history.filter((h) => h.previousAllocationId).length,
      history,
    };
  });

  subjects.sort((a, b) => a.order - b.order);

  const current = subjects.find((s) => s.currentAllocationId) || null;
  const completed = subjects.filter((s) => s.status === 'COMPLETED');
  const needsReallocation = subjects.find((s) => ['MISSED', 'REALLOCATION_REQUIRED', 'ON_HOLD', 'DROPPED'].includes(s.status));
  const next =
    subjects.find((s) => s !== current && !['COMPLETED', 'ATTENDING', 'RE_ATTENDING', 'BATCH_ALLOCATED'].includes(s.status)) || null;

  const trainingStatus = student.enrollment?.status || 'ACTIVE';
  let allocationStatus: 'ALLOCATED' | 'WAITING' | 'REALLOCATION_REQUIRED' | 'COMPLETED' | 'NOT_ENROLLED' | 'PAUSED';
  if (!course) allocationStatus = 'NOT_ENROLLED';
  else if (trainingStatus === 'ON_HOLD' || trainingStatus === 'DROPPED') allocationStatus = 'PAUSED';
  else if (needsReallocation) allocationStatus = 'REALLOCATION_REQUIRED';
  else if (current) allocationStatus = 'ALLOCATED';
  else if (subjects.length > 0 && completed.length === subjects.length) allocationStatus = 'COMPLETED';
  else allocationStatus = 'WAITING';

  // Expected course completion: current subject's estimate + planned duration of what's left after it
  let expectedCompletion: Date | null = null;
  if (course) {
    const base = current?.expectedEndDate ? new Date(current.expectedEndDate) : new Date();
    const remainingDays = subjects
      .filter((s) => s !== current && s.status !== 'COMPLETED')
      .reduce((sum, s) => sum + (s.expectedDurationDays || 0), 0);
    expectedCompletion = subjects.length && completed.length === subjects.length
      ? (completed[completed.length - 1]?.history[0]?.endDate as Date) || new Date()
      : new Date(base.getTime() + remainingDays * DAY_MS);
  }

  const totalTopics = subjects.reduce((s, x) => s + x.progress.total, 0);
  const doneTopics = subjects.reduce((s, x) => s + x.progress.completed, 0);

  return {
    course: course ? { _id: course._id, name: course.name, code: course.code, durationMonths: course.durationMonths } : null,
    subjects,
    current,
    next,
    completedCount: completed.length,
    allocationStatus,
    trainingStatus,
    expectedCompletion,
    overallProgress: totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0,
    missedCount: allocations.filter((a) => a.status === 'MISSED').length,
    reallocatedCount: allocations.filter((a) => a.previousAllocationId).length,
  };
}

// Current subject finishes soon: 75%+ of topics done, or its batch is expected to end within 14 days
export const isCompletingSoon = (current: { progress: { percentage: number }; expectedEndDate: Date | string | null } | null) => {
  if (!current) return false;
  if (current.progress.percentage >= 75) return true;
  return !!current.expectedEndDate && new Date(current.expectedEndDate).getTime() - Date.now() <= 14 * DAY_MS;
};

export async function getStudentJourney(studentMongoId: string) {
  const student = await Student.findById(studentMongoId).populate('userId', 'fullName email');
  if (!student) return null;
  const ctx = await loadJourneyContext([student._id]);
  return { student, journey: buildJourney(student, ctx) };
}

export async function nextBatchCode(subjectId: string) {
  const subject = await Subject.findById(subjectId);
  if (!subject) return null;
  const existing = await Batch.find({ batchCode: new RegExp(`^${subject.code}-B\\d+$`) }).select('batchCode').lean();
  const max = existing.reduce((m, b: any) => Math.max(m, Number(String(b.batchCode).split('-B')[1]) || 0), 0);
  return `${subject.code}-B${String(max + 1).padStart(2, '0')}`;
}
