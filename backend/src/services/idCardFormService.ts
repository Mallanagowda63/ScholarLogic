import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { AuditLog } from '../models/AuditLog';
import { BiometricDeviceUser } from '../models/BiometricIntegration';
import { IdCardSubmission, IIdCardSubmission, IdCardFormKind } from '../models/IdCardSubmission';
import { openPassword, sealPassword } from '../utils/credentialVault';
import { isPlaceholderEmail } from './trackingService';
import { emailService } from './emailService';
import { normalizePhone, mapCourse } from './googleFormService';
import { createStudentAccount } from './studentAccountService';

/**
 * "Student info - ScholarLogic" Google Form → login emails.
 * Every few minutes the server reads the form's answers from its Apps Script web app (IDCARD_FORM_SYNC_URL).
 * For each new answer it reads the ID typed from the card (SCLR207), finds that student and, when the
 * name or phone on the form also belongs to that student, emails them their own Login ID and password.
 * Anything doubtful waits in Admin → ID Card Form, so nobody can get a classmate's password by typing their ID.
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const generatePassword = () => `${Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')}@${crypto.randomInt(10)}`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const siteUrl = () => (/localhost|127\.0\.0\.1/.test(env.FRONTEND_URL) ? 'https://scholarlogiclms.in' : env.FRONTEND_URL);

/** "sclr207", "SCLR 207", "Sclr-0207" → SCLR207; "SCLR5" → SCLR005; anything else as typed (upper case), '' for "NA…" */
export function normalizeIdCard(raw: string): string {
  const s = String(raw || '').trim();
  const m = /scl\s*r?\s*[-_ ]?\s*(\d{1,5})/i.exec(s);
  if (m) return `SCLR${String(Number(m[1])).padStart(3, '0')}`;
  if (/^\d{1,4}$/.test(s)) return `SCLR${String(Number(s)).padStart(3, '0')}`; // just the number from the card
  if (!s || /^(na|n\/a|nil|none|no|-)\b/i.test(s) || /not|don'?t|didn|have|receive|recieve/i.test(s)) return '';
  return s.toUpperCase().replace(/\s+/g, '');
}

/** The long RFID number printed on the card ("0004694760 071,41704" → 4694760), or '' */
export const cardNumberIn = (raw: string) => {
  const m = /(\d{6,12})/.exec(String(raw || ''));
  return m ? String(Number(m[1])) : '';
};

/** Card ID as the website knows it: the SCLR code, also when the student typed the long card number instead */
export async function resolveIdCode(raw: string): Promise<string> {
  const code = normalizeIdCard(raw);
  if (/^SCLR\d+$/.test(code)) return code;
  const card = cardNumberIn(raw);
  if (card) {
    const viaStudent: any = await Student.findOne({ cardNumber: card }).select('biometricId studentId').lean();
    if (viaStudent) return viaStudent.biometricId || viaStudent.studentId;
    const viaMachine: any = await BiometricDeviceUser.findOne({ card }).select('pin').lean();
    if (viaMachine?.pin) return String(viaMachine.pin).toUpperCase();
  }
  return code;
}

// Surnames and titles many students share: they never prove two names are the same person on their own
const COMMON = new Set(['kumar', 'kumari', 'reddy', 'shaik', 'shaikh', 'sheikh', 'mohammed', 'mohammad', 'mohamed', 'muhammad', 'singh', 'gowda', 'naik', 'babu', 'rao', 'raju', 'devi', 'sri', 'shree', 'shri']);
const squash = (s: string) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !COMMON.has(w));

/** Letters that differ between two words (Levenshtein distance) */
const editDistance = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};

/** Same word allowing a small spelling difference: Sandhya/Sandya, Yuvaraj/Yuvuraj, Mohammed/Mohammaed */
const sameWord = (w: string, x: string) =>
  w === x ||
  (x.length >= 4 && w.startsWith(x)) ||
  (w.length >= 4 && x.startsWith(w)) ||
  (Math.min(w.length, x.length) >= 5 && editDistance(w, x) <= (Math.min(w.length, x.length) >= 8 ? 2 : 1));

/** Same person? At least one real name word in common (initials and short words are ignored) */
export function namesMatch(a: string, b: string): boolean {
  const wb = squash(b);
  return squash(a).some((w) => wb.some((x) => sameWord(w, x)));
}

// Answers arrive as question/answer pairs; find one by what the question says
const answerFor = (answers: { question: string; answer: string }[], ...patterns: RegExp[]) => {
  for (const p of patterns) {
    const hit = answers.find((a) => p.test(a.question) && String(a.answer || '').trim());
    if (hit) return String(hit.answer).trim();
  }
  return '';
};

function readFields(payload: any) {
  const answers: { question: string; answer: string }[] = Array.isArray(payload?.answers)
    ? payload.answers.map((a: any) => ({ question: String(a?.question || '').trim(), answer: String(a?.answer ?? '').trim() }))
    : [];
  const idCardRaw = answerFor(answers, /id\s*card\s*(number|no|num|id)/i, /card\s*(number|no)/i, /\bsclr\b/i);
  return {
    answers,
    name: answerFor(answers, /^name$/i, /full\s*name/i, /\bname\b/i),
    phone: answerFor(answers, /phone|mobile|contact|whats\s*app/i),
    email: answerFor(answers, /e-?mail/i).toLowerCase(),
    course: answerFor(answers, /course/i),
    education: answerFor(answers, /education|background|degree|qualification/i),
    idCardRaw,
    idCardCode: '',
    idCardPicUrl: answerFor(answers, /card\s*pic|card\s*photo|photo\s*of.*card|id\s*card\s*image/i),
    tenthPercentage: answerFor(answers, /10th|tenth|sslc/i),
    twelfthPercentage: answerFor(answers, /12th|twelfth|puc|inter/i),
  };
}

const findStudentForCode = async (code: string) => {
  if (!code) return null;
  return Student.findOne({ $or: [{ biometricId: code }, { studentId: code }] })
    .select('studentId biometricId phone userId loginSharedAt +loginPassword')
    .populate('userId', 'fullName email isActive');
};

/** The student's current password, or a new one (also saved for the admin page) when none is on record */
async function passwordFor(student: any): Promise<string> {
  const known = openPassword(student.loginPassword);
  if (known) return known;
  const password = generatePassword();
  await User.updateOne({ _id: student.userId._id }, { $set: { passwordHash: await bcrypt.hash(password, 10) } });
  await Student.updateOne({ _id: student._id }, { $set: { loginPassword: sealPassword(password) } });
  return password;
}

/** Fill in the email / phone the student gave when the profile has none (never overwrites real ones) */
async function saveContactDetails(student: any, email: string, phone: string) {
  const user = student.userId;
  if (EMAIL_RE.test(email) && (!user.email || isPlaceholderEmail(user.email)) && !(await User.exists({ email, _id: { $ne: user._id } }))) {
    await User.updateOne({ _id: user._id }, { $set: { email } });
  }
  const p = normalizePhone(phone);
  if (p.length === 10 && !normalizePhone(student.phone)) await Student.updateOne({ _id: student._id }, { $set: { phone: p } });
}

/** Emails the student their login and records it on the answer. Used automatically and by the admin "Send" button. */
export async function sendLoginFor(sub: IIdCardSubmission, studentMongoId: string, byUserId?: string) {
  const student: any = await Student.findById(studentMongoId)
    .select('studentId biometricId phone userId loginSharedAt +loginPassword')
    .populate('userId', 'fullName email isActive');
  if (!student?.userId) throw new Error('Student or their login account not found');
  if (student.userId.isActive === false) throw new Error('This student’s login is switched off');
  if (!EMAIL_RE.test(sub.email)) throw new Error('The email on the form is not a valid address');
  await saveContactDetails(student, sub.email, sub.phone);
  const password = await passwordFor(student);
  const loginId = student.biometricId || student.studentId;
  sub.studentId = student._id;
  sub.loginId = loginId;
  if (byUserId) sub.reviewedById = new mongoose.Types.ObjectId(byUserId);
  try {
    await emailService.sendLoginCredentialsEmail(sub.email, student.userId.fullName || sub.name, loginId, password, siteUrl());
  } catch (err: any) {
    sub.status = 'EMAIL_FAILED';
    sub.note = `Email could not be sent: ${String(err?.message || err).slice(0, 200)}`;
    await sub.save();
    throw err;
  }
  const at = new Date();
  sub.status = 'SENT';
  sub.emailedTo = sub.email;
  sub.emailedAt = at;
  sub.note = byUserId ? `Sent after admin review to ${sub.email}` : `Sent automatically to ${sub.email}`;
  await sub.save();
  await Student.updateOne({ _id: student._id }, { $set: { loginSharedAt: at } });
  await AuditLog.create({
    userId: byUserId,
    userRole: byUserId ? 'ADMIN' : 'SYSTEM',
    action: 'STUDENT_LOGIN_SHARED',
    resource: 'STUDENT',
    metadata: { via: 'ID_CARD_FORM', studentId: student.studentId, to: sub.email, automatic: !byUserId },
  }).catch(() => undefined);
}

/** Decide what to do with a fresh answer: email it, or leave it for an admin with the reason */
async function processNew(sub: IIdCardSubmission) {
  if (!sub.idCardCode) {
    sub.note = sub.idCardRaw ? `No card ID could be read from "${sub.idCardRaw}"` : 'No ID card number on the form';
    return sub.save();
  }
  const student: any = await findStudentForCode(sub.idCardCode);
  if (!student?.userId) {
    sub.note = `No student has the ID ${sub.idCardCode}`;
    return sub.save();
  }
  sub.studentId = student._id;
  sub.loginId = student.biometricId || student.studentId;
  const earlier = await IdCardSubmission.findOne({ _id: { $ne: sub._id }, studentId: student._id, status: 'SENT' }).select('emailedTo emailedAt');
  if (earlier) {
    sub.status = 'DUPLICATE';
    sub.note = `${student.userId.fullName} already got their login on ${earlier.emailedAt?.toISOString().slice(0, 10)} (${earlier.emailedTo})`;
    return sub.save();
  }
  const sameName = namesMatch(sub.name, student.userId.fullName);
  const formPhone = normalizePhone(sub.phone);
  const samePhone = formPhone.length === 10 && formPhone === normalizePhone(student.phone);
  const sameEmail = !!sub.email && sub.email === String(student.userId.email || '').toLowerCase();
  if (!sameName && !samePhone && !sameEmail) {
    sub.note = `ID ${sub.idCardCode} belongs to ${student.userId.fullName}, but the name "${sub.name}" and phone on the form don't match`;
    return sub.save();
  }
  if (!EMAIL_RE.test(sub.email)) {
    sub.note = `Matched ${student.userId.fullName}, but "${sub.email || 'no email'}" is not a valid email address`;
    return sub.save();
  }
  try {
    await sendLoginFor(sub, String(student._id));
  } catch {
    /* status EMAIL_FAILED and the reason are saved on the answer */
  }
}

/** Next free SCLR code: one above the highest used by any student or anyone enrolled on the eSSL machine */
async function nextSclrCode(): Promise<string> {
  const re = /^SCLR(\d+)$/;
  const [students, machine] = await Promise.all([
    Student.find({ $or: [{ studentId: /^SCLR\d+$/ }, { biometricId: /^SCLR\d+$/ }] }).select('studentId biometricId').lean(),
    BiometricDeviceUser.find({ pin: /^SCLR\d+$/i }).select('pin').lean(),
  ]);
  // Real codes are SCLR + 3 digits (SCLR007) or more without padding (SCLR1000); "SCLR001245" was typed on a form
  const num = (c: unknown) => {
    const d = re.exec(String(c || '').toUpperCase())?.[1] || '';
    return d.length === 3 || (d.length > 3 && !d.startsWith('0')) ? Number(d) : 0;
  };
  let max = 0;
  for (const s of students as any[]) for (const c of [s.studentId, s.biometricId]) max = Math.max(max, num(c));
  for (const u of machine as any[]) max = Math.max(max, num(u.pin));
  return `SCLR${String(max + 1).padStart(3, '0')}`;
}

/**
 * New-student form: create the student with the next SCLR code (login ID = Student ID = machine code) and
 * email the login. Skipped when the email or phone already belongs to a student (they get "Needs review").
 */
export async function createStudentFrom(sub: IIdCardSubmission, byUserId?: string) {
  if (!sub.name.trim()) {
    sub.note = 'No name on the form';
    return sub.save();
  }
  if (!EMAIL_RE.test(sub.email)) {
    sub.note = `"${sub.email || 'no email'}" is not a valid email address, so the login can't be sent`;
    return sub.save();
  }
  const sameEmail: any = await User.findOne({ email: sub.email }).select('fullName role').lean();
  const phone = normalizePhone(sub.phone);
  const samePhone: any = phone.length === 10 ? await Student.findOne({ phone: new RegExp(`${phone.split('').join('\\D*')}$`) }).select('studentId').lean() : null;
  if (sameEmail || samePhone) {
    const who: any = sameEmail ? await Student.findOne({ userId: sameEmail._id }).select('studentId').lean() : samePhone;
    const earlierCreated = who
      ? await IdCardSubmission.findOne({ _id: { $ne: sub._id }, form: 'NEW_STUDENT', studentId: who._id, status: 'SENT' }).select('_id')
      : null;
    if (who) {
      sub.studentId = who._id;
      sub.loginId = who.studentId;
    }
    sub.status = earlierCreated ? 'DUPLICATE' : 'NEEDS_REVIEW';
    sub.note = earlierCreated
      ? `Filled the form again; ${who?.studentId} was already created and emailed`
      : `Already in ScholarLogic${who ? ` as ${who.studentId}` : ''} with this ${sameEmail ? 'email' : 'phone'}: no new student created`;
    return sub.save();
  }
  const course: any = await mapCourse(sub.course);
  let created: any = null;
  let code = '';
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    code = await nextSclrCode();
    try {
      created = await createStudentAccount({
        fullName: sub.name.trim(),
        email: sub.email,
        phone,
        courseId: course?._id || null,
        password: generatePassword(),
        customStudentId: code,
        registrationSource: 'GOOGLE_FORM',
        joinedDetails: `Added from the ID card form (code ${code})`,
        education: { tenthPercentage: sub.tenthPercentage, twelfthPercentage: sub.twelfthPercentage },
      });
    } catch (err: any) {
      if (err?.statusCode === 409 && /Student ID/.test(String(err?.message))) continue; // code taken a moment ago: next one
      sub.note = `Could not create the student: ${String(err?.message || err).slice(0, 200)}`;
      return sub.save();
    }
  }
  if (!created) {
    sub.note = 'Could not find a free SCLR code';
    return sub.save();
  }
  await Student.updateOne({ _id: created.student._id }, { $set: { biometricId: code } });
  await AuditLog.create({
    userId: byUserId,
    userRole: byUserId ? 'ADMIN' : 'SYSTEM',
    action: 'STUDENT_CREATED',
    resource: 'STUDENT',
    metadata: { via: 'ID_CARD_FORM', studentId: code, name: sub.name, course: course?.name || sub.course },
  }).catch(() => undefined);
  try {
    await sendLoginFor(sub, String(created.student._id), byUserId);
    sub.note = `New student ${code} created${course ? ` (${course.name})` : ''}; login emailed to ${sub.email}`;
    await sub.save();
  } catch {
    /* EMAIL_FAILED with the reason is saved; the student exists and the admin can send again */
  }
}

/** Stores one answer from the sheet the first time it is seen, then processes it */
async function ingest(payload: any, form: IdCardFormKind): Promise<'new' | 'known' | 'empty'> {
  const fields = readFields(payload);
  fields.idCardCode = form === 'STUDENT_INFO' ? await resolveIdCode(fields.idCardRaw) : '';
  if (!fields.name && !fields.email && !fields.idCardRaw) return 'empty';
  const submittedAt = payload?.submittedAt && !Number.isNaN(new Date(payload.submittedAt).getTime()) ? new Date(payload.submittedAt) : new Date();
  const externalSubmissionId =
    String(payload?.submissionId || '').trim() || `auto-${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24)}`;
  if (await IdCardSubmission.exists({ externalSubmissionId })) return 'known';
  let sub: IIdCardSubmission;
  try {
    sub = await IdCardSubmission.create({ externalSubmissionId, form, submittedAt, ...fields });
  } catch (err: any) {
    if (err?.code === 11000) return 'known'; // two syncs at once
    throw err;
  }
  if (form === 'NEW_STUDENT') await createStudentFrom(sub);
  else await processNew(sub);
  return 'new';
}

export interface IdCardSyncResult {
  form: IdCardFormKind;
  at: Date;
  ok: boolean;
  trigger: 'manual' | 'auto';
  message: string;
  total: number;
  added: number;
}

const FORMS: Record<IdCardFormKind, { label: string; url: () => string; secret: () => string; envNames: string }> = {
  STUDENT_INFO: { label: 'Student info form', url: () => env.IDCARD_FORM_SYNC_URL, secret: () => env.IDCARD_FORM_SECRET, envNames: 'IDCARD_FORM_SYNC_URL / IDCARD_FORM_SECRET' },
  NEW_STUDENT: { label: 'New student ID card form', url: () => env.NEWID_FORM_SYNC_URL, secret: () => env.NEWID_FORM_SECRET, envNames: 'NEWID_FORM_SYNC_URL / NEWID_FORM_SECRET' },
};
const FORM_KINDS = Object.keys(FORMS) as IdCardFormKind[];

const lastSync: Partial<Record<IdCardFormKind, IdCardSyncResult>> = {};
// One sync at a time across both forms: new SCLR codes and "already emailed" checks never race
let running: Promise<unknown> = Promise.resolve();
export const getLastIdCardSync = () => FORM_KINDS.map((k) => lastSync[k]).filter(Boolean) as IdCardSyncResult[];
export const isFormConfigured = (form: IdCardFormKind) => !!(FORMS[form].url() && FORMS[form].secret());
export const isIdCardSyncConfigured = () => FORM_KINDS.some(isFormConfigured);
export const connectedForms = () => FORM_KINDS.filter(isFormConfigured);

async function doSync(form: IdCardFormKind, trigger: 'manual' | 'auto'): Promise<IdCardSyncResult> {
  const cfg = FORMS[form];
  const result: IdCardSyncResult = { form, at: new Date(), ok: false, trigger, message: '', total: 0, added: 0 };
  if (!isFormConfigured(form)) {
    result.message = `${cfg.label} is not connected yet (${cfg.envNames} in backend .env)`;
    return result;
  }
  try {
    let body: any;
    let lastError = '';
    // Google sometimes serves an error page for the Apps Script redirect: retry a few times
    for (let attempt = 1; attempt <= 4 && !body; attempt++) {
      try {
        const res = await fetch(cfg.url(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: cfg.secret() }),
          redirect: 'follow',
          signal: AbortSignal.timeout(45000),
        });
        body = JSON.parse(await res.text());
      } catch (err: any) {
        body = undefined;
        lastError =
          err?.name === 'TimeoutError'
            ? 'Google did not respond in time'
            : err instanceof SyntaxError
              ? 'Google returned a web page instead of data: check the web app is deployed with access "Anyone" and the URL ends in /exec'
              : String(err?.message || err);
        if (attempt < 4) await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
    if (!body) throw new Error(lastError);
    if (!body.success) throw new Error(body.message || 'Google Apps Script refused the request');
    if (!Array.isArray(body.responses)) throw new Error('Google answered without responses: check the secret in the Apps Script');
    result.total = body.responses.length;
    for (const payload of body.responses) if ((await ingest(payload, form)) === 'new') result.added += 1;
    result.ok = true;
    result.message = `${cfg.label}: ${result.added} new answer${result.added === 1 ? '' : 's'} (${result.total} on the form)`;
  } catch (err: any) {
    result.message = `${cfg.label}: ${String(err?.message || err)}`;
  }
  return result;
}

/** Reads every connected form (or one), one after the other */
export async function syncIdCardForm(trigger: 'manual' | 'auto' = 'manual', only?: IdCardFormKind): Promise<IdCardSyncResult[]> {
  const kinds = only ? [only] : connectedForms();
  const job = running.then(async () => {
    const out: IdCardSyncResult[] = [];
    for (const k of kinds) {
      const r = await doSync(k, trigger);
      lastSync[k] = r;
      out.push(r);
    }
    return out;
  });
  running = job.catch(() => undefined);
  return job;
}

export function startIdCardFormSync() {
  const minutes = Number(env.GOOGLE_FORM_SYNC_INTERVAL_MINUTES) || 5;
  if (!isIdCardSyncConfigured()) return null;
  const run = () =>
    syncIdCardForm('auto')
      .then((results) =>
        results.forEach((r) => {
          if (!r.ok) console.warn(`⚠️ ID card form sync failed: ${r.message}`);
          else if (r.added) console.log(`🪪 ${r.message}`);
        })
      )
      .catch(() => undefined);
  setTimeout(run, 20000);
  console.log(`🪪 ID card forms read every ${minutes} min: ${connectedForms().map((k) => FORMS[k].label).join(', ')}`);
  return setInterval(run, minutes * 60000);
}
