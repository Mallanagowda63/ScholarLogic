import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { env } from '../config/env';
import { StudentRegistration } from '../models/StudentRegistration';
import { GoogleFormSubmission } from '../models/GoogleFormSubmission';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { TrackCourse } from '../models/tracking/TrackCourse';
import { StudentBatchAllocation } from '../models/tracking/StudentBatchAllocation';
import {
  extractFields,
  getLastSync,
  ingestPayload,
  isSyncConfigured,
  mapCourse,
  normalizeMode,
  normalizePhone,
  phoneMatcher,
  runSubmission,
  syncFromGoogleSheet,
} from '../services/googleFormService';
import { createStudentAccount, generateStudentId } from '../services/studentAccountService';

const oid = (raw: unknown, label = 'ID') => {
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${label}`, 400, 'INVALID_ID');
  return new mongoose.Types.ObjectId(id);
};

const secretsMatch = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// ---------------------------------------------------------------------------
// Webhook: Google Apps Script → ScholarLogic
// ---------------------------------------------------------------------------

/**
 * POST /api/integrations/google-form/student
 * Header X-ScholarLogic-Secret (legacy: X-Google-Form-Secret) must equal GOOGLE_FORM_WEBHOOK_SECRET.
 * The raw payload is stored first, so a processing failure never loses the response.
 * Re-sending the same submissionId is safe (returns the earlier result).
 */
export const receiveGoogleFormSubmission = async (req: Request, res: Response) => {
  if (!env.GOOGLE_FORM_WEBHOOK_SECRET) {
    throw new AppError('Google Form integration is not configured on the server', 503, 'NOT_CONFIGURED');
  }
  // Google strips request headers that start with "X-Google-" from Apps Script's UrlFetchApp,
  // so the script sends X-ScholarLogic-Secret. The old name is still accepted for other callers.
  const given = String(req.header('X-ScholarLogic-Secret') || req.header('X-Google-Form-Secret') || '');
  if (!given || !secretsMatch(given, env.GOOGLE_FORM_WEBHOOK_SECRET)) {
    // Fingerprint only (never the secret) so a copy-paste mismatch can be diagnosed from the logs
    const fp = (s: string) => `${s.length} chars, ${s.slice(0, 3)}…${s.slice(-3)}, sha256 ${crypto.createHash('sha256').update(s).digest('hex').slice(0, 10)}`;
    console.warn(`[google-form] rejected secret: got ${given ? fp(given) : 'none'} | expected ${fp(env.GOOGLE_FORM_WEBHOOK_SECRET)}`);
    throw new AppError('Invalid integration secret', 401, 'UNAUTHORIZED');
  }

  const payload = req.body || {};
  if (typeof payload !== 'object' || Array.isArray(payload)) throw new AppError('Payload must be a JSON object', 400, 'INVALID_PAYLOAD');
  const result = await ingestPayload(payload);
  if (result.alreadyReceived) {
    res.json({ success: true, data: { status: result.status, note: result.note, alreadyReceived: true } });
    return;
  }
  // 202 for a stored-but-failed response: Apps Script treats it as delivered (admin can retry)
  res.status(result.status === 'FAILED' ? 202 : 201).json({
    success: true,
    data: { status: result.status, note: result.note, error: result.error },
  });
};

// ---------------------------------------------------------------------------
// Admin: pull responses from the Google Sheet (Apps Script web app)
// ---------------------------------------------------------------------------

export const syncGoogleForm = async (_req: AuthRequest, res: Response) => {
  if (!isSyncConfigured()) {
    throw new AppError('Google Form sync is not set up. Add GOOGLE_FORM_SYNC_URL to the backend .env and restart.', 503, 'NOT_CONFIGURED');
  }
  const result = await syncFromGoogleSheet('manual');
  if (!result.ok) throw new AppError(`Sync failed: ${result.message}`, 502, 'SYNC_FAILED');
  res.json({ success: true, data: result });
};

export const getGoogleFormSyncStatus = async (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      configured: isSyncConfigured(),
      intervalMinutes: Number(env.GOOGLE_FORM_SYNC_INTERVAL_MINUTES) || 0,
      lastSync: getLastSync(),
    },
  });
};

// ---------------------------------------------------------------------------
// Admin: New Registrations
// ---------------------------------------------------------------------------

const withAllocationState = async (regs: any[]) => {
  const studentIds = regs.map((r) => r.studentId?._id || r.studentId).filter(Boolean);
  const allocated = new Set(
    (await StudentBatchAllocation.distinct('studentId', { studentId: { $in: studentIds } })).map(String)
  );
  return regs.map((r) => {
    const sid = String(r.studentId?._id || r.studentId || '');
    const isAllocated = !!sid && allocated.has(sid);
    return {
      ...r,
      status: r.verificationStatus === 'VERIFIED' && isAllocated ? 'ALLOCATED' : r.verificationStatus,
      allocationStatus: isAllocated ? 'ALLOCATED' : 'WAITING_FOR_ALLOCATION',
    };
  });
};

/**
 * Form responses from people who are already students. They are linked to that student instead of
 * creating a registration, so they'd otherwise be invisible on this page. Latest response per student.
 */
async function listExistingStudentResponses() {
  const subs = await GoogleFormSubmission.find({ processingStatus: 'DUPLICATE', registrationId: null, studentId: { $ne: null } })
    .sort({ submittedAt: -1 })
    .limit(500)
    .lean();
  const latest = new Map<string, any>();
  const counts = new Map<string, number>();
  for (const s of subs) {
    const key = String(s.studentId);
    counts.set(key, (counts.get(key) || 0) + 1);
    if (!latest.has(key)) latest.set(key, s);
  }
  const students = await Student.find({ _id: { $in: [...latest.keys()] } })
    .select('studentId userId')
    .populate('userId', 'fullName')
    .lean();
  const studentMap = new Map(students.map((st: any) => [String(st._id), st]));
  const rows = [];
  for (const [key, s] of latest) {
    const st: any = studentMap.get(key);
    if (!st) continue;
    const f = await extractFields(s.rawPayload || {});
    rows.push({
      _id: s._id,
      submittedAt: s.submittedAt,
      responseCount: counts.get(key) || 1,
      formName: f.name,
      phone: f.phone,
      email: f.email,
      course: f.course,
      college: f.college,
      degree: [f.degree, f.degreeStream].filter(Boolean).join(' • '),
      passOutYear: f.passOutYear,
      submittedByEmail: f.submittedByEmail,
      student: { _id: st._id, studentId: st.studentId, fullName: st.userId?.fullName || '' },
      answers: s.rawPayload?.answers || [],
    });
  }
  return rows;
}

export const listRegistrations = async (_req: AuthRequest, res: Response) => {
  const regs = await StudentRegistration.find({})
    .sort({ lastSubmittedAt: -1 })
    .populate('courseId', 'name code')
    .populate('studentId', 'studentId')
    .lean();
  const [failedSubmissions, counts, existingStudentResponses] = await Promise.all([
    GoogleFormSubmission.countDocuments({ processingStatus: 'FAILED' }),
    StudentRegistration.aggregate([{ $group: { _id: '$verificationStatus', n: { $sum: 1 } } }]),
    listExistingStudentResponses(),
  ]);
  res.json({
    success: true,
    data: {
      registrations: await withAllocationState(regs),
      existingStudentResponses,
      counts: {
        ...Object.fromEntries(counts.map((c) => [c._id, c.n])),
        FAILED_SUBMISSIONS: failedSubmissions,
        EXISTING_STUDENTS: existingStudentResponses.length,
      },
    },
  });
};

export const getRegistration = async (req: AuthRequest, res: Response) => {
  const reg = await StudentRegistration.findById(oid(req.params.id, 'registration'))
    .populate('courseId', 'name code')
    .populate('studentId', 'studentId')
    .lean();
  if (!reg) throw new AppError('Registration not found', 404, 'NOT_FOUND');
  const submissions = await GoogleFormSubmission.find({ registrationId: reg._id }).sort({ submittedAt: -1 }).lean();
  // Preview of the auto Student ID (FIRSTNAME-CC-NN) for the linked course, or the course picked on the form
  const course: any = reg.courseId || (await mapCourse(reg.requestedCourse));
  const suggestedStudentId = course ? await generateStudentId(reg.fullName, course) : null;
  res.json({ success: true, data: { registration: (await withAllocationState([reg]))[0], submissions, suggestedStudentId } });
};

// Admin corrects intake details before verifying
export const updateRegistration = async (req: AuthRequest, res: Response) => {
  const reg = await StudentRegistration.findById(oid(req.params.id, 'registration'));
  if (!reg) throw new AppError('Registration not found', 404, 'NOT_FOUND');
  if (reg.verificationStatus === 'VERIFIED') throw new AppError('Already verified — edit the student profile instead', 409, 'ALREADY_VERIFIED');
  const { fullName, email, phone, address, courseId, preferredMode, preferredTiming, joiningDate, comments } = req.body;
  if (typeof fullName === 'string' && fullName.trim()) reg.fullName = fullName.trim();
  if (typeof email === 'string') reg.email = email.trim().toLowerCase();
  if (typeof phone === 'string') {
    reg.phone = phone.trim();
    reg.phoneNormalized = normalizePhone(phone);
  }
  if (typeof address === 'string') reg.address = address;
  if (courseId !== undefined) {
    if (courseId && !(await TrackCourse.exists({ _id: oid(courseId, 'course') }))) throw new AppError('Course not found', 404, 'NOT_FOUND');
    reg.courseId = courseId || undefined;
  }
  if (preferredMode !== undefined) reg.preferredMode = normalizeMode(preferredMode);
  if (typeof preferredTiming === 'string') reg.preferredTiming = preferredTiming;
  if (joiningDate !== undefined) reg.joiningDate = joiningDate ? new Date(joiningDate) : undefined;
  if (typeof comments === 'string') reg.comments = comments;
  for (const k of ['dateOfBirth', 'tenthPercentage', 'twelfthPercentage', 'degree', 'degreeStream', 'degreePercentage', 'passOutYear', 'college'] as const) {
    if (typeof req.body[k] === 'string') reg[k] = req.body[k].trim();
  }
  await reg.save();
  res.json({ success: true, message: 'Registration updated' });
};

/**
 * Verify: creates the Student (Student ID + login) from the registration. Batch allocation is a
 * separate admin step — nothing is auto-allocated from the form's timing preference.
 */
export const verifyRegistration = async (req: AuthRequest, res: Response) => {
  const reg = await StudentRegistration.findById(oid(req.params.id, 'registration'));
  if (!reg) throw new AppError('Registration not found', 404, 'NOT_FOUND');
  if (reg.verificationStatus === 'VERIFIED') throw new AppError('Registration is already verified', 409, 'ALREADY_VERIFIED');

  const b = req.body || {};
  const fullName = String(b.fullName ?? reg.fullName).trim();
  const phone = String(b.phone ?? reg.phone).trim();
  const email = String(b.email ?? reg.email).trim().toLowerCase();
  const courseId = b.courseId || reg.courseId;
  if (!courseId) throw new AppError('Assign a course before verifying', 400, 'COURSE_REQUIRED');

  // Last duplicate check: someone may have been added manually since the form was submitted
  const normalized = normalizePhone(phone);
  if (normalized.length >= 10) {
    const clash = await Student.findOne({ phone: phoneMatcher(normalized) }).select('studentId');
    if (clash) throw new AppError(`A student with this phone already exists (${clash.studentId})`, 409, 'DUPLICATE');
  }
  // An email already used by another account is dropped rather than blocking verification
  const emailToUse = email && !(await User.exists({ email })) ? email : '';

  const { student, studentId } = await createStudentAccount(
    {
      fullName,
      phone,
      email: emailToUse,
      address: String(b.address ?? reg.address),
      courseId: oid(String(courseId), 'course'),
      mode: normalizeMode(b.mode ?? reg.preferredMode) || 'OFFLINE',
      preferredTiming: String(b.preferredTiming ?? reg.preferredTiming ?? ''),
      joiningDate: b.joiningDate || reg.joiningDate || new Date(),
      remarks: String(b.remarks ?? reg.comments ?? ''),
      password: b.password,
      customStudentId: b.studentId,
      registrationSource: reg.source === 'GOOGLE_FORM' ? 'GOOGLE_FORM' : 'ADMIN',
      registrationId: reg._id,
      joinedDetails: `Registered via ${reg.source === 'GOOGLE_FORM' ? 'Google Form' : 'admin'} on ${reg.submittedAt.toDateString()}${email && !emailToUse ? ' • email already in use, not attached' : ''}`,
      // Values corrected in the Verify dialog win over the form answers
      education: {
        dateOfBirth: String(b.dateOfBirth ?? reg.dateOfBirth),
        college: String(b.college ?? reg.college),
        degree: String(b.degree ?? reg.degree),
        branch: String(b.degreeStream ?? reg.degreeStream),
        graduationYear: String(b.passOutYear ?? reg.passOutYear),
        cgpa: String(b.degreePercentage ?? reg.degreePercentage),
        tenthPercentage: String(b.tenthPercentage ?? reg.tenthPercentage),
        twelfthPercentage: String(b.twelfthPercentage ?? reg.twelfthPercentage),
      },
    },
    req.user
  );

  reg.verificationStatus = 'VERIFIED';
  reg.verifiedAt = new Date();
  reg.verifiedById = req.user?.userId as any;
  reg.studentId = student._id;
  reg.rejectionReason = '';
  await reg.save();
  await GoogleFormSubmission.updateMany({ registrationId: reg._id }, { studentId: student._id });

  res.status(201).json({ success: true, data: { student: { _id: student._id, studentId } } });
};

export const rejectRegistration = async (req: AuthRequest, res: Response) => {
  const reg = await StudentRegistration.findById(oid(req.params.id, 'registration'));
  if (!reg) throw new AppError('Registration not found', 404, 'NOT_FOUND');
  if (reg.verificationStatus === 'VERIFIED') throw new AppError('A verified registration cannot be rejected', 409, 'ALREADY_VERIFIED');
  const reason = String(req.body?.reason || '').trim();
  if (!reason) throw new AppError('A reason is required', 400, 'MISSING_FIELDS');
  reg.verificationStatus = 'REJECTED';
  reg.rejectionReason = reason;
  await reg.save();
  res.json({ success: true, message: 'Registration rejected' });
};

// Raw submissions (for troubleshooting / retry)
export const listSubmissions = async (req: AuthRequest, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const submissions = await GoogleFormSubmission.find(status ? { processingStatus: status } : {})
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  res.json({ success: true, data: { submissions } });
};

export const retrySubmission = async (req: AuthRequest, res: Response) => {
  const submission = await GoogleFormSubmission.findById(oid(req.params.id, 'submission'));
  if (!submission) throw new AppError('Submission not found', 404, 'NOT_FOUND');
  if (submission.processingStatus !== 'FAILED') throw new AppError('Only failed submissions can be retried', 409, 'NOT_FAILED');
  await runSubmission(submission);
  res.json({ success: true, data: { status: submission.processingStatus, note: submission.resultNote, error: submission.errorMessage || undefined } });
};
