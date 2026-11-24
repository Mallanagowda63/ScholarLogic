import { env } from '../config/env';
import { emailService } from './emailService';
import { Student } from '../models/Student';
import { Batch } from '../models/tracking/Batch';
import { Subject } from '../models/tracking/Subject';
import { User } from '../models/User';
import { TrackCourse } from '../models/tracking/TrackCourse';

// The new-student ID card form (students fill it after their registration is verified)
const ID_CARD_FORM_URL = (process.env.ID_CARD_FORM_PUBLIC_URL || 'https://forms.gle/JqiUimoG555xrjJj7').trim();

/**
 * Emails a student when an admin changes something about them: batch allocated / moved / reallocated, subject status,
 * course, training status, mode. Called from addTimeline, so every admin action that writes the student's history
 * also tells the student. Sent one at a time with a short gap (Resend allows a few per second).
 * Turn off with STUDENT_UPDATE_EMAILS=off in the server .env.
 */

type Kind = 'good' | 'info' | 'warn';
const EVENT: Record<string, { heading: string; intro: string; kind: Kind }> = {
  ALLOCATED: { heading: 'You have a new batch', intro: 'You have been added to a batch. Your class details are below.', kind: 'good' },
  MOVED: { heading: 'Your batch has changed', intro: 'You have been moved to a different batch. Your new class details are below.', kind: 'info' },
  REALLOCATED: { heading: 'You have a new batch', intro: 'You have been given a new batch for this subject. Your class details are below.', kind: 'info' },
  SUBJECT_COMPLETED: { heading: 'Subject completed 🎉', intro: 'Well done! A subject in your course is now marked as completed.', kind: 'good' },
  ALLOCATION_STATUS: { heading: 'Update on your subject', intro: 'The status of one of your subjects has been updated.', kind: 'info' },
  STATUS_CHANGED: { heading: 'Update on your training', intro: 'Your training status at ScholarLogic has been updated.', kind: 'warn' },
  REJOINED: { heading: 'Welcome back!', intro: 'You have rejoined your training at ScholarLogic.', kind: 'good' },
  MODE_CHANGED: { heading: 'Your class mode has changed', intro: 'The way you attend classes has been updated.', kind: 'info' },
  PROFILE_UPDATED: { heading: 'Your course has been set', intro: 'Your course at ScholarLogic has been updated.', kind: 'info' },
};

const queue: (() => Promise<void>)[] = [];
let running = false;
async function drain() {
  if (running) return;
  running = true;
  while (queue.length) {
    const job = queue.shift()!;
    try {
      await job();
    } catch (e: any) {
      console.warn('📧 Student update email failed:', e?.message || e);
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  running = false;
}

export function shouldEmail(type: string, title: string, actorRole?: string) {
  if ((process.env.STUDENT_UPDATE_EMAILS || '').toLowerCase() === 'off') return false;
  if (!actorRole || !['ADMIN', 'SUPER_ADMIN'].includes(actorRole)) return false;
  if (!EVENT[type]) return false;
  // Only the course change among profile edits (phone/timing edits are not worth an email)
  if (type === 'PROFILE_UPDATED' && !/^Course set to /.test(title)) return false;
  return true;
}

export function queueStudentUpdateEmail(studentId: any, type: string, title: string, details: string, refs: { batchId?: any; subjectId?: any }) {
  if (type === 'PROFILE_UPDATED') return queueCourseOverviewEmail(studentId);
  queue.push(() => send(studentId, type, title, details, refs));
  void drain();
}

const fmtDay = (d?: Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');

async function send(studentId: any, type: string, title: string, details: string, refs: { batchId?: any; subjectId?: any }) {
  const student: any = await Student.findById(studentId).select('studentId userId enrollment').populate('userId', 'fullName email').lean();
  const email = String(student?.userId?.email || '').trim();
  if (!email || email.endsWith('@students.scholarlogic.local') || !/@/.test(email)) return;
  const name = student.userId.fullName || 'Student';

  const rows: [string, string][] = [];
  let joinLink = '';
  if (refs.batchId) {
    const b: any = await Batch.findById(refs.batchId).select('batchCode subjectId trainerId timing mode startDate meetingLink').lean();
    if (b) {
      const [subject, trainer]: any[] = await Promise.all([
        Subject.findById(b.subjectId).select('name').lean(),
        b.trainerId ? User.findById(b.trainerId).select('fullName').lean() : null,
      ]);
      rows.push(['Batch', b.batchCode], ['Subject', subject?.name || '']);
      if (trainer?.fullName) rows.push(['Trainer', trainer.fullName]);
      if (b.timing) rows.push(['Timing', b.timing]);
      rows.push(['Mode', b.mode === 'ONLINE' ? 'Online' : b.mode === 'HYBRID' ? 'Hybrid' : 'Offline (at the institute)']);
      if (b.startDate) rows.push(['Starts on', fmtDay(b.startDate)]);
      if (b.meetingLink && b.mode !== 'OFFLINE') joinLink = b.meetingLink;
    }
  } else if (refs.subjectId) {
    const subject: any = await Subject.findById(refs.subjectId).select('name').lean();
    if (subject) rows.push(['Subject', subject.name]);
  }
  rows.push(['Student ID', student.studentId]);

  const ev = EVENT[type];
  await emailService.sendStudentUpdateEmail({
    to: email,
    name,
    subject: `${ev.heading.replace(/ 🎉$/, '')}: ${title}`,
    heading: ev.heading,
    intro: ev.intro,
    update: title,
    details,
    rows: rows.filter(([, v]) => v),
    kind: ev.kind,
    joinLink,
    siteUrl: /localhost|127.0.0.1/.test(env.FRONTEND_URL) ? 'https://scholarlogiclms.in' : env.FRONTEND_URL,
  });
  console.log(`📧 Update email (${type}) sent to ${student.studentId}`);
}

/** Course overview email (sent when registration is complete, or when an admin sets a student's course) */
export function queueCourseOverviewEmail(studentId: any, opts: { askIdCard?: boolean } = {}) {
  if ((process.env.STUDENT_UPDATE_EMAILS || '').toLowerCase() === 'off') return;
  queue.push(() => sendOverview(studentId, opts));
  void drain();
}

async function sendOverview(studentId: any, opts: { askIdCard?: boolean } = {}) {
  const student: any = await Student.findById(studentId).select('studentId biometricId userId enrollment').populate('userId', 'fullName email').lean();
  const email = String(student?.userId?.email || '').trim();
  if (!email || email.endsWith('@students.scholarlogic.local') || !/@/.test(email)) return;
  if (!student.enrollment?.courseId) return;
  const course: any = await TrackCourse.findById(student.enrollment.courseId).populate('subjects.subjectId', 'name topics').lean();
  if (!course || !course.subjects?.length) return;
  const subjects = [...course.subjects]
    .sort((a: any, b: any) => a.order - b.order)
    .filter((s: any) => s.subjectId)
    .map((s: any) => {
      const topics = [...(s.subjectId.topics || [])].sort((a: any, b: any) => a.order - b.order).map((t: any) => t.title);
      return { name: s.subjectId.name, days: s.expectedDurationDays || 30, topics: topics.slice(0, 5), topicCount: topics.length };
    });
  const mode = student.enrollment.mode === 'ONLINE' ? 'Online' : student.enrollment.mode === 'HYBRID' ? 'Hybrid' : 'Offline';
  await emailService.sendCourseOverviewEmail({
    to: email,
    name: student.userId.fullName || 'Student',
    studentId: student.studentId,
    courseName: course.name,
    months: course.durationMonths || 0,
    mode,
    subjects,
    siteUrl: /localhost|127.0.0.1/.test(env.FRONTEND_URL) ? 'https://scholarlogiclms.in' : env.FRONTEND_URL,
    // Registration verified and no SCLR ID card yet: the ID card form comes first (mandatory)
    idCardFormUrl: opts.askIdCard && ![student.studentId, student.biometricId].some((c: any) => /^SCLR\d+$/i.test(String(c || ''))) ? ID_CARD_FORM_URL : undefined,
  });
  console.log(`📧 Course overview (${course.code}) sent to ${student.studentId}`);
}

/** Email the trainer when they are given a batch: batch, subject, timing, dates and the students' names */
export function queueTrainerBatchEmail(batchId: any) {
  if ((process.env.STUDENT_UPDATE_EMAILS || '').toLowerCase() === 'off') return;
  queue.push(() => sendTrainerBatch(batchId));
  void drain();
}

async function sendTrainerBatch(batchId: any) {
  const { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } = await import('../models/tracking/StudentBatchAllocation');
  const b: any = await Batch.findById(batchId).select('batchCode subjectId trainerId timing mode startDate expectedEndDate').lean();
  if (!b?.trainerId) return;
  const [trainer, subject]: any[] = await Promise.all([User.findById(b.trainerId).select('fullName email').lean(), Subject.findById(b.subjectId).select('name').lean()]);
  const email = String(trainer?.email || '').trim();
  if (!email || !/@/.test(email)) return;
  const allocations = await StudentBatchAllocation.find({ batchId: b._id, status: { $in: ACTIVE_ALLOCATION_STATUSES } }).select('studentId').lean();
  const students: any[] = await Student.find({ _id: { $in: allocations.map((a: any) => a.studentId) } }).select('userId').populate('userId', 'fullName').lean();
  const names = students.map((s) => s.userId?.fullName || 'Student').sort((x: string, y: string) => x.localeCompare(y));
  await emailService.sendTrainerBatchEmail({
    to: email,
    name: trainer.fullName || 'Trainer',
    batchCode: b.batchCode,
    subject: subject?.name || '',
    timing: b.timing || '',
    mode: b.mode === 'ONLINE' ? 'Online' : b.mode === 'HYBRID' ? 'Hybrid' : 'Offline',
    startDate: fmtDay(b.startDate),
    endDate: fmtDay(b.expectedEndDate),
    students: names,
    siteUrl: /localhost|127.0.0.1/.test(env.FRONTEND_URL) ? 'https://scholarlogiclms.in' : env.FRONTEND_URL,
  });
  console.log(`📧 Batch ${b.batchCode} email sent to trainer ${trainer.fullName} (${names.length} students)`);
}

/**
 * Online or hybrid batch got a class link (Zoho meeting or pasted): email it to the students who join online
 * (in a hybrid batch: students whose mode is Online or Hybrid; in an online batch: everyone).
 */
export function queueClassLinkEmails(batchId: any, classAt?: Date | null) {
  if ((process.env.STUDENT_UPDATE_EMAILS || '').toLowerCase() === 'off') return;
  queue.push(async () => {
    const { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } = await import('../models/tracking/StudentBatchAllocation');
    const b: any = await Batch.findById(batchId).select('batchCode subjectId trainerId timing mode meetingLink').lean();
    if (!b?.meetingLink || b.mode === 'OFFLINE') return;
    const [subject, trainer]: any[] = await Promise.all([
      Subject.findById(b.subjectId).select('name').lean(),
      b.trainerId ? User.findById(b.trainerId).select('fullName').lean() : null,
    ]);
    const allocations = await StudentBatchAllocation.find({ batchId: b._id, status: { $in: ACTIVE_ALLOCATION_STATUSES } }).select('studentId').lean();
    const students: any[] = await Student.find({ _id: { $in: allocations.map((a: any) => a.studentId) } })
      .select('studentId userId enrollment')
      .populate('userId', 'fullName email')
      .lean();
    const online = students.filter((s) => b.mode === 'ONLINE' || ['ONLINE', 'HYBRID'].includes(s.enrollment?.mode));
    const when = classAt ? new Date(classAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '';
    for (const s of online) {
      const email = String(s.userId?.email || '').trim();
      if (!email || email.endsWith('@students.scholarlogic.local') || !/@/.test(email)) continue;
      queue.push(() =>
        emailService
          .sendStudentUpdateEmail({
            to: email,
            name: s.userId.fullName || 'Student',
            subject: `Your online class link: ${b.batchCode}${when ? ` (${when})` : ''}`,
            heading: 'Your online class link',
            intro: b.mode === 'HYBRID' ? 'Your class runs in the classroom and online at the same time. You join online with the link below.' : 'Your class is online. Join with the link below.',
            update: when ? `Next class: ${when}` : 'Class link ready',
            details: 'Join a few minutes early. Your attendance is marked by the trainer.',
            rows: [
              ['Batch', b.batchCode],
              ['Subject', subject?.name || ''],
              ...(trainer?.fullName ? ([['Trainer', trainer.fullName]] as [string, string][]) : []),
              ['Timing', b.timing || ''],
              ['Student ID', s.studentId],
            ].filter(([, v]) => v) as [string, string][],
            kind: 'info',
            joinLink: b.meetingLink,
            siteUrl: /localhost|127.0.0.1/.test(env.FRONTEND_URL) ? 'https://scholarlogiclms.in' : env.FRONTEND_URL,
          })
          .then(() => undefined)
      );
    }
    void drain();
    if (online.length) console.log(`📧 Class link for ${b.batchCode} queued to ${online.length} online student(s)`);
  });
  void drain();
}
