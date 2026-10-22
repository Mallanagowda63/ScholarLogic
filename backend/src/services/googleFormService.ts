import crypto from 'crypto';
import { env } from '../config/env';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { TrackCourse } from '../models/tracking/TrackCourse';
import { StudentRegistration } from '../models/StudentRegistration';
import { GoogleFormSubmission, IGoogleFormSubmission } from '../models/GoogleFormSubmission';
import { addTimeline } from './trackingService';

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Digits only; Indian numbers reduced to 10 digits (+91 98765 43210, 91-9876543210, 09876543210 → 9876543210) */
export function normalizePhone(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/** Regex that matches a stored phone in any format with the same last 10 digits */
export const phoneMatcher = (normalized: string) => new RegExp(`${normalized.split('').join('\\D*')}$`);

export function normalizeMode(raw?: string | null): 'ONLINE' | 'OFFLINE' | undefined {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'online') return 'ONLINE';
  if (v === 'offline' || v === 'classroom' || v === 'in person' || v === 'in-person') return 'OFFLINE';
  return undefined;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Form spellings → TrackCourse code. Anything else falls back to matching the course name/code.
const COURSE_ALIASES: Record<string, string> = {
  dataanalytics: 'DA',
  dataanalyst: 'DA',
  dataanalysis: 'DA',
  da: 'DA',
  cloudcomputing: 'CC',
  cloud: 'CC',
  cc: 'CC',
  pythonfullstack: 'PFS',
  pythonfullstackdevelopment: 'PFS',
  fullstackpython: 'PFS',
  pfs: 'PFS',
};

export async function mapCourse(raw?: string | null) {
  const key = squash(String(raw || ''));
  if (!key) return null;
  const courses = await TrackCourse.find({ isActive: true }).select('name code').lean();
  const code = COURSE_ALIASES[key];
  return (
    courses.find((c: any) => code && c.code === code) ||
    courses.find((c: any) => squash(c.name) === key || squash(c.code) === key) ||
    null
  );
}

// ---------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------

export interface FormFields {
  name: string;
  email: string;
  phone: string;
  address: string;
  course: string;
  mode: string;
  preferredTiming: string;
  joiningDate: string;
  comments: string;
  studentId: string;
  dateOfBirth: string;
  tenthPercentage: string;
  twelfthPercentage: string;
  degree: string;
  degreeStream: string;
  degreePercentage: string;
  passOutYear: string;
  college: string;
  photoUrl: string;
  submittedByEmail: string; // Google account that filled the form ("Collect email addresses")
}

// Two clock times with any separator: "7:00 - 8:00 AM", "7:00–8:00 AM", "7 to 8 am"
const TIMING_RANGE = /\d{1,2}(:\d{2})?\s*(am|pm)?\s*(to|[^\d\s:.]{1,3})\s*\d{1,2}(:\d{2})?\s*(am|pm)?/i;
const TIMING_WORDS = /^(evening|morning|afternoon|flexible|weekend)/i;

/**
 * Builds normalised fields from the Apps Script payload. Uses explicit fields when present and
 * otherwise reads the ordered `answers` list by question title. Because the live form has two
 * questions both titled "Course" (one Online/Other, one with course names), answers are also
 * classified by value: Online/Offline → mode, known course names → course, "7:00–8:00 AM" → timing.
 */
export async function extractFields(payload: any): Promise<FormFields> {
  const f: FormFields = {
    name: '',
    email: '',
    phone: '',
    address: '',
    course: '',
    mode: '',
    preferredTiming: '',
    joiningDate: '',
    comments: '',
    studentId: '',
    dateOfBirth: '',
    tenthPercentage: '',
    twelfthPercentage: '',
    degree: '',
    degreeStream: '',
    degreePercentage: '',
    passOutYear: '',
    college: '',
    photoUrl: '',
    submittedByEmail: '',
  };
  const set = (k: keyof FormFields, v: unknown) => {
    const s = String(v ?? '').trim();
    if (s && !f[k]) f[k] = s;
  };

  // 1. Explicit fields sent by the script
  set('name', payload.name ?? payload.fullName);
  set('email', payload.email);
  set('phone', payload.phone);
  set('address', payload.address);
  set('course', payload.course);
  set('mode', payload.mode ?? payload.preferredMode);
  set('preferredTiming', payload.preferredTiming);
  set('joiningDate', payload.joiningDate);
  set('comments', payload.comments ?? payload.remarks);
  set('studentId', payload.studentId);

  // 2. Ordered question/answer list
  const answers: { question: string; answer: string }[] = Array.isArray(payload.answers) ? payload.answers : [];
  let timeFallback = '';
  for (const { question, answer } of answers) {
    const q = squash(String(question || ''));
    const a = String(answer ?? '').trim();
    if (!a || q === 'timestamp') continue;

    if (q === 'name' || q === 'fullname' || q === 'studentname') set('name', a);
    // Google's own column when the form collects email addresses; the student's "Email ID" answer is separate
    else if (q === 'emailaddress' || q === 'username') set('submittedByEmail', a);
    else if (q.includes('email')) set('email', a);
    // Education questions come before the course/timing branch ("Degree Pass out year" has no "time" but stay explicit)
    else if (q === 'dob' || q.includes('dateofbirth') || q.includes('birth')) set('dateOfBirth', a);
    else if (q.includes('10th') || q.includes('sslc')) set('tenthPercentage', a);
    else if (q.includes('12th') || q.includes('puc')) set('twelfthPercentage', a);
    else if (q.includes('passout') || q.includes('passingyear') || q.includes('graduationyear')) set('passOutYear', a);
    else if (q.includes('degree') && (q.includes('percent') || q.includes('cgpa'))) set('degreePercentage', a);
    else if (q.includes('degree') && (q.includes('stream') || q.includes('branch') || q.includes('special'))) set('degreeStream', a);
    else if (q.includes('degree') || q === 'qualification') set('degree', a);
    else if (q.includes('college') || q.includes('university')) set('college', a);
    else if (q.includes('photo')) set('photoUrl', a);
    else if (q.includes('phone') || q.includes('mobile') || q.includes('whatsapp')) set('phone', a);
    else if (q.includes('address') || q === 'location' || q === 'city') set('address', a);
    else if (q.includes('studentid')) set('studentId', a);
    else if (q.includes('joining')) set('joiningDate', a);
    else if (q.includes('comment') || q.includes('requirement') || q.includes('remark') || q.includes('message')) set('comments', a);
    else if (q === 'mode' || q.includes('mode')) set('mode', a);
    else if (q.includes('course') || q.includes('timing') || q.includes('time') || q === 'preferred') {
      // Classify by value because titles are ambiguous on the live form
      if (normalizeMode(a)) set('mode', a);
      else if (await mapCourse(a)) set('course', a);
      // A time-picker answer can arrive as a date ("1899-12-30"); never read a date as a timing
      else if (/^\d{4}-\d{2}-\d{2}/.test(a)) continue;
      else if (TIMING_RANGE.test(a) || TIMING_WORDS.test(a)) {
        if (!f.preferredTiming) f.preferredTiming = a;
      } else if (/^\d{1,2}:\d{2}(:\d{2})?(\s*(am|pm))?$/i.test(a)) timeFallback = timeFallback || a;
      else if (q.includes('course') && a.toLowerCase() !== 'other') set('course', a);
    }
  }
  // A plain time from the time-picker question is used only if no range was chosen
  if (!f.preferredTiming && timeFallback) f.preferredTiming = timeFallback;
  // A form without its own email question: the collected Google email is the student's email too
  if (!f.email && f.submittedByEmail) f.email = f.submittedByEmail;
  return f;
}

const parseDate = (s: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // Google Sheets style dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const guess = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!Number.isNaN(guess.getTime())) return guess;
  }
  return undefined;
};

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

export interface ProcessResult {
  status: 'PROCESSED' | 'DUPLICATE';
  note: string;
  registrationId?: any;
  studentId?: any;
}

/**
 * Turns a stored submission into a registration.
 * Duplicate order: existing Student (Student ID → phone → email), then an existing registration
 * (phone → email). Existing students keep their batches/progress; only empty profile fields are filled.
 */
export async function processSubmission(submission: IGoogleFormSubmission): Promise<ProcessResult> {
  const payload = submission.rawPayload || {};
  const f = await extractFields(payload);
  if (!f.name) throw new Error('Missing student name in form response');
  const email = f.email.toLowerCase();
  const phoneNormalized = normalizePhone(f.phone);
  if (!email && !phoneNormalized) throw new Error('Form response has neither email nor phone number');

  const submittedAt = submission.submittedAt;
  const course = await mapCourse(f.course);
  const mode = normalizeMode(f.mode);
  const warnings: string[] = [];
  if (f.course && !course) warnings.push(`Course "${f.course}" not recognised — assign manually`);
  if (f.mode && !mode) warnings.push(`Mode "${f.mode}" is not Online/Offline`);
  if (phoneNormalized && phoneNormalized.length !== 10) warnings.push(`Phone "${f.phone}" is not a 10-digit number`);

  // 1. Already a ScholarLogic student?
  let existing =
    (f.studentId && (await Student.findOne({ studentId: f.studentId.toUpperCase() }))) ||
    (phoneNormalized.length >= 10 && (await Student.findOne({ phone: phoneMatcher(phoneNormalized) }))) ||
    null;
  if (!existing && email) {
    const user = await User.findOne({ email, role: 'STUDENT' }).select('_id');
    if (user) existing = await Student.findOne({ userId: user._id });
  }
  if (existing) {
    const filled: string[] = [];
    if (!existing.phone && f.phone) {
      existing.phone = f.phone;
      filled.push('phone');
    }
    if (!existing.address && f.address) {
      existing.address = f.address;
      filled.push('address');
    }
    if (!existing.dateOfBirth && f.dateOfBirth) {
      existing.dateOfBirth = f.dateOfBirth;
      filled.push('date of birth');
    }
    if (!existing.college && f.college) {
      existing.college = f.college;
      filled.push('college');
    }
    if (!existing.branch && f.degreeStream) {
      existing.branch = f.degreeStream;
      filled.push('branch');
    }
    if (filled.length) await existing.save();
    await addTimeline(
      existing._id,
      'PROFILE_UPDATED',
      'Google Form submitted again',
      filled.length ? `Filled empty ${filled.join(', ')} from the form` : 'No changes — existing batches and progress kept',
      {},
      undefined,
      submittedAt
    );
    return { status: 'DUPLICATE', note: `Matches existing student ${existing.studentId}`, studentId: existing._id };
  }

  const intake = {
    fullName: f.name,
    email,
    phone: f.phone,
    phoneNormalized,
    address: f.address,
    requestedCourse: f.course,
    courseId: course?._id,
    preferredModeRaw: f.mode,
    preferredMode: mode,
    preferredTiming: f.preferredTiming,
    joiningDate: parseDate(f.joiningDate),
    comments: f.comments,
    dateOfBirth: f.dateOfBirth,
    tenthPercentage: f.tenthPercentage,
    twelfthPercentage: f.twelfthPercentage,
    degree: f.degree,
    degreeStream: f.degreeStream,
    degreePercentage: f.degreePercentage,
    passOutYear: f.passOutYear,
    college: f.college,
    photoUrl: f.photoUrl,
    submittedByEmail: f.submittedByEmail.toLowerCase(),
    mappingWarnings: warnings,
  };

  // 2. Already registered but not yet verified?
  const orMatch: any[] = [];
  if (phoneNormalized.length >= 10) orMatch.push({ phoneNormalized });
  if (email) orMatch.push({ email });
  const registration = orMatch.length
    ? await StudentRegistration.findOne({ $or: orMatch, verificationStatus: { $ne: 'VERIFIED' } }).sort({ createdAt: -1 })
    : null;
  if (registration) {
    // Latest answers win for a pending intake; a rejected one goes back to pending review
    Object.assign(registration, intake);
    registration.lastSubmittedAt = submittedAt > registration.lastSubmittedAt ? submittedAt : registration.lastSubmittedAt;
    registration.submissionCount += 1;
    if (registration.verificationStatus === 'REJECTED') {
      registration.verificationStatus = 'PENDING';
      registration.rejectionReason = '';
    }
    await registration.save();
    return { status: 'DUPLICATE', note: 'Updated existing pending registration', registrationId: registration._id };
  }

  // 3. New registration, waiting for admin verification
  const created = await StudentRegistration.create({
    ...intake,
    source: 'GOOGLE_FORM',
    submittedAt,
    lastSubmittedAt: submittedAt,
    submissionCount: 1,
    verificationStatus: 'PENDING',
  });
  return { status: 'PROCESSED', note: 'New registration created (pending verification)', registrationId: created._id };
}

/** Runs processing and records the outcome on the submission; never throws */
export async function runSubmission(submission: IGoogleFormSubmission) {
  submission.attempts += 1;
  try {
    const result = await processSubmission(submission);
    submission.processingStatus = result.status;
    submission.resultNote = result.note;
    submission.errorMessage = '';
    submission.registrationId = result.registrationId;
    submission.studentId = result.studentId;
  } catch (err: any) {
    submission.processingStatus = 'FAILED';
    submission.errorMessage = String(err?.message || err).slice(0, 500);
  }
  await submission.save();
  return submission;
}

/**
 * Stores and processes one form response (used by both the push webhook and the pull sync).
 * The raw payload is saved first; a response already processed (same submissionId) is skipped.
 */
export async function ingestPayload(payload: any) {
  const submittedAt = payload.submittedAt && !Number.isNaN(new Date(payload.submittedAt).getTime()) ? new Date(payload.submittedAt) : new Date();
  const externalSubmissionId =
    String(payload.submissionId || '').trim() ||
    `auto-${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24)}`;

  const earlier = await GoogleFormSubmission.findOne({ externalSubmissionId });
  if (earlier && earlier.processingStatus !== 'FAILED') {
    return { status: earlier.processingStatus, note: earlier.resultNote, error: undefined as string | undefined, alreadyReceived: true };
  }
  const submission = earlier || (await GoogleFormSubmission.create({ externalSubmissionId, submittedAt, rawPayload: payload }));
  if (earlier) {
    earlier.rawPayload = payload;
    earlier.submittedAt = submittedAt;
  }
  await runSubmission(submission);
  return {
    status: submission.processingStatus,
    note: submission.resultNote,
    error: submission.errorMessage || undefined,
    alreadyReceived: false,
  };
}

// ---------------------------------------------------------------------------
// Pull sync: fetch all responses from the Apps Script web app (GOOGLE_FORM_SYNC_URL)
// ---------------------------------------------------------------------------

export interface SyncResult {
  at: Date;
  ok: boolean;
  trigger: 'manual' | 'auto';
  message: string;
  total: number;
  created: number;
  updated: number;
  alreadyImported: number;
  failed: number;
  existingStudents: string[]; // Student IDs whose form responses were linked instead of creating a registration
}

let lastSync: SyncResult | null = null;
let syncRunning: Promise<SyncResult> | null = null;

export const getLastSync = () => lastSync;
export const isSyncConfigured = () => !!(env.GOOGLE_FORM_SYNC_URL && env.GOOGLE_FORM_WEBHOOK_SECRET);

async function doSync(trigger: 'manual' | 'auto'): Promise<SyncResult> {
  const result: SyncResult = { at: new Date(), ok: false, trigger, message: '', total: 0, created: 0, updated: 0, alreadyImported: 0, failed: 0, existingStudents: [] };
  if (!isSyncConfigured()) {
    result.message = 'Google Form sync is not set up (GOOGLE_FORM_SYNC_URL / GOOGLE_FORM_WEBHOOK_SECRET missing in backend .env)';
    return result;
  }
  try {
    // Apps Script answers POST with a redirect to the result; fetch follows it automatically.
    // Google intermittently serves a "Page not found" page for that redirect, so retry a few times.
    let body: any;
    let lastError = '';
    for (let attempt = 1; attempt <= 4 && !body; attempt++) {
      try {
        const res = await fetch(env.GOOGLE_FORM_SYNC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: env.GOOGLE_FORM_WEBHOOK_SECRET }),
          redirect: 'follow',
          signal: AbortSignal.timeout(45000),
        });
        const text = await res.text();
        body = JSON.parse(text);
      } catch (err: any) {
        body = undefined;
        lastError =
          err?.name === 'TimeoutError'
            ? 'Google did not respond in time'
            : err instanceof SyntaxError
              ? 'Google returned a web page instead of data — check the web app is deployed with access "Anyone" and the URL ends in /exec'
              : String(err?.message || err);
        if (attempt < 4) await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
    if (!body) throw new Error(lastError);
    if (!body.success) throw new Error(body.message || 'Google Apps Script refused the request');
    const responses: any[] = Array.isArray(body.responses) ? body.responses : [];
    result.total = responses.length;
    for (const payload of responses) {
      const r = await ingestPayload(payload);
      const existing = /^Matches existing student (\S+)/.exec(r.note || '')?.[1];
      if (existing && !result.existingStudents.includes(existing)) result.existingStudents.push(existing);
      if (r.alreadyReceived) result.alreadyImported += 1;
      else if (r.status === 'PROCESSED') result.created += 1;
      else if (r.status === 'DUPLICATE') result.updated += 1;
      else result.failed += 1;
    }
    result.ok = true;
    result.message = `${result.created} new, ${result.updated} matched existing, ${result.alreadyImported} already imported${result.failed ? `, ${result.failed} need review` : ''}`;
  } catch (err: any) {
    result.message = err?.name === 'TimeoutError' ? 'Google did not respond within 60 seconds' : String(err?.message || err);
  }
  return result;
}

/** Runs one sync; concurrent callers share the same run */
export async function syncFromGoogleSheet(trigger: 'manual' | 'auto' = 'manual'): Promise<SyncResult> {
  if (!syncRunning) {
    syncRunning = doSync(trigger).finally(() => {
      syncRunning = null;
    });
  }
  lastSync = await syncRunning;
  return lastSync;
}

/** Starts the background auto-sync (every GOOGLE_FORM_SYNC_INTERVAL_MINUTES; 0 disables) */
export function startAutoSync() {
  const minutes = Number(env.GOOGLE_FORM_SYNC_INTERVAL_MINUTES);
  if (!isSyncConfigured() || !minutes || minutes <= 0) return null;
  const run = () =>
    syncFromGoogleSheet('auto')
      .then((r) => {
        if (!r.ok) console.warn(`⚠️ Google Form auto-sync failed: ${r.message}`);
        else if (r.created || r.updated) console.log(`📥 Google Form auto-sync: ${r.message}`);
      })
      .catch(() => {});
  setTimeout(run, 10000); // first run shortly after startup
  const timer = setInterval(run, minutes * 60000);
  console.log(`🔄 Google Form auto-sync every ${minutes} min`);
  return timer;
}

export { GoogleFormSubmission };
