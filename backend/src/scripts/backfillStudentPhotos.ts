/**
 * One-time: give students already in ScholarLogic the photo they attached on the registration form.
 * Reads every answer on the form sheet (all dates), matches it to a student by phone or email
 * (and the name must match too), fetches that photo through the form script and sets it as the
 * profile photo. Students who already have a photo keep it.
 *
 * Usage: node dist/scripts/backfillStudentPhotos.js [--dry-run]
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { env } from '../config/env';
import { Student } from '../models/Student';
import { ProfilePhoto } from '../models/ProfilePhoto';
import { normalizePhone } from '../services/googleFormService';
import { namesMatch } from '../services/idCardFormService';
import { applyPhotoToStudent, driveIdFrom, fetchFormPhoto } from '../services/formPhotoService';

const DRY = process.argv.includes('--dry-run');
const answer = (r: any, re: RegExp) => String((r.answers || []).find((a: any) => re.test(a.question) && String(a.answer || '').trim())?.answer || '').trim();

async function main() {
  await connectDB();
  if (!env.GOOGLE_FORM_SYNC_URL) throw new Error('GOOGLE_FORM_SYNC_URL missing');
  const res = await fetch(env.GOOGLE_FORM_SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.GOOGLE_FORM_WEBHOOK_SECRET }),
    redirect: 'follow',
    signal: AbortSignal.timeout(280000),
  });
  const body = JSON.parse(await res.text());
  if (!body.success) throw new Error(body.message || 'form refused');
  const rows: any[] = body.responses;
  console.log(`Form answers: ${rows.length}`);

  const students: any[] = await Student.find({}).select('studentId phone userId').populate('userId', 'fullName email').lean();
  const withPhoto = new Set((await ProfilePhoto.find({}).select('userId').lean()).map((p) => String(p.userId)));
  const byPhone = new Map<string, any[]>();
  const byEmail = new Map<string, any>();
  for (const s of students) {
    const p = normalizePhone(s.phone).slice(-10);
    if (p.length === 10) byPhone.set(p, [...(byPhone.get(p) || []), s]);
    const e = String(s.userId?.email || '').toLowerCase();
    if (e && !e.endsWith('@students.scholarlogic.local')) byEmail.set(e, s);
  }

  // Newest answer first, so a student who filled the form twice gets the latest photo
  const latest = new Map<string, { student: any; photo: string; how: string }>();
  let noMatch = 0;
  let nameDiffers = 0;
  for (const r of [...rows].sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))) {
    const photo = answer(r, /photo/i);
    if (!driveIdFrom(photo)) continue;
    const name = answer(r, /^name$/i) || answer(r, /name/i);
    const phone = normalizePhone(answer(r, /phone|mobile/i)).slice(-10);
    const emails = (r.answers || []).filter((a: any) => /e-?mail/i.test(a.question)).map((a: any) => String(a.answer || '').trim().toLowerCase());
    let student: any = null;
    let how = '';
    for (const s of byPhone.get(phone) || []) if (namesMatch(name, s.userId?.fullName || '')) (student = s), (how = 'phone');
    if (!student) for (const e of emails) {
      const s = byEmail.get(e);
      if (s && namesMatch(name, s.userId?.fullName || '')) (student = s), (how = 'email');
    }
    if (!student) {
      if ((byPhone.get(phone) || []).length || emails.some((e: string) => byEmail.has(e))) nameDiffers++;
      else noMatch++;
      continue;
    }
    if (!latest.has(String(student._id))) latest.set(String(student._id), { student, photo, how });
  }
  const todo = [...latest.values()].filter((x) => !withPhoto.has(String(x.student.userId?._id)));
  console.log(`Matched students: ${latest.size} (already have a photo: ${latest.size - todo.length}) | no student: ${noMatch} | same phone/email but different name (skipped): ${nameDiffers}`);
  if (DRY) {
    todo.slice(0, 15).forEach((x) => console.log(`  would set ${x.student.studentId} (${x.how})`));
    return;
  }
  let done = 0;
  let failed = 0;
  for (const [i, x] of todo.entries()) {
    const ok = (await fetchFormPhoto('REGISTRATION', driveIdFrom(x.photo))) === 'ok' && (await applyPhotoToStudent(x.student._id, x.photo));
    if (ok) done++;
    else failed++;
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${todo.length} • set ${done} • failed ${failed}`);
  }
  console.log(`Done: ${done} photos set, ${failed} could not be fetched`);
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
