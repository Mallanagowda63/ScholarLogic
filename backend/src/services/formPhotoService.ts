import { env } from '../config/env';
import { FormPhoto } from '../models/FormPhoto';
import { ProfilePhoto } from '../models/ProfilePhoto';
import { StudentRegistration } from '../models/StudentRegistration';
import { IdCardSubmission } from '../models/IdCardSubmission';
import { Student } from '../models/Student';
import { User } from '../models/User';

/**
 * Student photos from the Google Forms (registration "Attach a photo", ID card forms "Id Card Pic" / "photo").
 * The files are private in the form owner's Drive, so each form's Apps Script hands a photo over when asked with
 * the secret and the file id (only files attached to that form's answers). The copy is stored in FormPhoto and
 * served at /api/form-photos/<driveId>. When the student is verified / linked, the photo becomes their profile photo.
 */

type Source = 'REGISTRATION' | 'STUDENT_INFO' | 'NEW_STUDENT';
const SOURCES: Record<Source, { url: () => string; secret: () => string }> = {
  REGISTRATION: { url: () => env.GOOGLE_FORM_SYNC_URL, secret: () => env.GOOGLE_FORM_WEBHOOK_SECRET },
  STUDENT_INFO: { url: () => env.IDCARD_FORM_SYNC_URL, secret: () => env.IDCARD_FORM_SECRET },
  NEW_STUDENT: { url: () => env.NEWID_FORM_SYNC_URL, secret: () => env.NEWID_FORM_SECRET },
};
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_TRIES = 4;

/** Drive file id from a form answer: "https://drive.google.com/open?id=X" or ".../file/d/X/view" (first file if several) */
export function driveIdFrom(url?: string | null): string {
  const s = String(url || '');
  const m = s.match(/[?&]id=([\w-]{20,})/) || s.match(/\/d\/([\w-]{20,})/);
  return m ? m[1] : '';
}
export const formPhotoUrl = (driveId: string) => (driveId ? `/api/form-photos/${driveId}` : '');

/** driveId → URL, for the photos already stored (used to show thumbnails in the admin lists) */
export async function storedPhotoUrls(urls: (string | undefined | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(urls.map(driveIdFrom).filter(Boolean))];
  const have = await FormPhoto.find({ driveId: { $in: ids }, fetchedAt: { $ne: null } }).select('driveId').lean();
  return new Map(have.map((p) => [p.driveId, formPhotoUrl(p.driveId)]));
}

type FetchResult = 'ok' | 'fail' | 'wait';
export const fetchFormPhoto = (source: Source, driveId: string) => fetchOne(source, driveId);
async function fetchOne(source: Source, driveId: string): Promise<FetchResult> {
  const cfg = SOURCES[source];
  if (!cfg.url() || !cfg.secret()) return 'wait';
  const doc = (await FormPhoto.findOne({ driveId })) || new FormPhoto({ driveId, source });
  if (doc.fetchedAt || doc.tries >= MAX_TRIES) return doc.fetchedAt ? 'ok' : 'fail';
  try {
    const res = await fetch(cfg.url(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: cfg.secret(), photoId: driveId }),
      redirect: 'follow',
      signal: AbortSignal.timeout(60000),
    });
    const text = await res.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error('Google returned a web page, not the photo');
    }
    if (!body.success) throw new Error(body.message || 'refused');
    if (!body.base64) {
      // Old script without the photo step: wait (no try counted) until it is updated
      doc.error = 'Waiting: the form script is the old version (no photo step yet)';
      await doc.save();
      return 'wait';
    }
    const data = Buffer.from(body.base64, 'base64');
    if (!data.length) throw new Error('empty file');
    if (data.length > MAX_BYTES) throw new Error('photo larger than 8 MB');
    const type = String(body.mimeType || 'image/jpeg');
    if (!/^image\//.test(type)) throw new Error(`not an image (${type})`);
    doc.set({ data, type, size: data.length, fetchedAt: new Date(), error: '' });
    await doc.save();
    return 'ok';
  } catch (e: any) {
    const msg = String(e?.message || e);
    // Google busy / network: try again next time without counting it
    const temporary = /web page|timeout|fetch failed|ECONN|ENOTFOUND|did not respond/i.test(msg) || e?.name === 'TimeoutError';
    if (!temporary) doc.tries += 1;
    doc.error = msg.slice(0, 300);
    await doc.save();
    return temporary ? 'wait' : 'fail';
  }
}

/** Gives the student's login account this photo as its profile photo (keeps an existing one unless overwrite) */
export async function applyPhotoToStudent(studentId: any, photoUrl: string | undefined | null, overwrite = false): Promise<boolean> {
  const driveId = driveIdFrom(photoUrl);
  if (!driveId || !studentId) return false;
  const photo = await FormPhoto.findOne({ driveId, fetchedAt: { $ne: null } }).lean();
  if (!photo?.data) return false;
  const student: any = await Student.findById(studentId).select('userId').lean();
  if (!student?.userId) return false;
  if (!overwrite && (await ProfilePhoto.exists({ userId: student.userId }))) return false;
  const data = Buffer.from((photo.data as any).buffer ?? photo.data);
  await ProfilePhoto.updateOne({ userId: student.userId }, { $set: { data, type: photo.type, size: photo.size } }, { upsert: true });
  await User.updateOne({ _id: student.userId }, { $set: { avatarUrl: `/api/auth/photo/${student.userId}?v=${Date.now()}` } });
  return true;
}

let running: Promise<unknown> = Promise.resolve();
export const lastPhotoSync: { at?: Date; fetched: number; failed: number; applied: number; message: string } = { fetched: 0, failed: 0, applied: 0, message: '' };

/** Fetches photos not stored yet (a few per run), then gives verified students their photo */
export function syncFormPhotos(limit = 30) {
  const job = running.then(async () => {
    const [regs, cards] = await Promise.all([
      StudentRegistration.find({ photoUrl: { $nin: ['', null] } }).select('photoUrl studentId verificationStatus').lean(),
      IdCardSubmission.find({ idCardPicUrl: { $nin: ['', null] }, status: { $ne: 'DELETED' } }).select('form idCardPicUrl studentId').lean(),
    ]);
    const wanted: { source: Source; driveId: string }[] = [
      ...regs.map((r: any) => ({ source: 'REGISTRATION' as Source, driveId: driveIdFrom(r.photoUrl) })),
      ...cards.map((c: any) => ({ source: (c.form === 'NEW_STUDENT' ? 'NEW_STUDENT' : 'STUDENT_INFO') as Source, driveId: driveIdFrom(c.idCardPicUrl) })),
    ].filter((w) => w.driveId);
    const known = new Map((await FormPhoto.find({ driveId: { $in: wanted.map((w) => w.driveId) } }).select('driveId fetchedAt tries').lean()).map((p) => [p.driveId, p]));
    const todo = wanted.filter((w) => {
      const k = known.get(w.driveId);
      return !k || (!k.fetchedAt && k.tries < MAX_TRIES);
    });
    let fetched = 0;
    let failed = 0;
    const paused = new Set<Source>();
    for (const w of todo.slice(0, limit)) {
      if (paused.has(w.source)) continue;
      const r = await fetchOne(w.source, w.driveId);
      if (r === 'ok') fetched++;
      else if (r === 'fail') failed++;
      else paused.add(w.source); // that form's script is old or Google is busy: stop asking it this round
    }
    // Linked students without a profile photo get the form photo (ID card photo first: it is the newer one)
    let applied = 0;
    for (const c of cards as any[]) if (c.studentId && (await applyPhotoToStudent(c.studentId, c.idCardPicUrl))) applied++;
    for (const r of regs as any[]) if (r.studentId && (await applyPhotoToStudent(r.studentId, r.photoUrl))) applied++;
    Object.assign(lastPhotoSync, { at: new Date(), fetched, failed, applied, message: `${fetched} photo(s) saved, ${failed} not reachable, ${applied} set on student profiles, ${Math.max(0, todo.length - limit)} waiting` });
    if (fetched || failed || applied) console.log(`📷 Form photos: ${lastPhotoSync.message}`);
    return { ...lastPhotoSync };
  });
  running = job.catch(() => undefined);
  return job;
}

export function startFormPhotoSync() {
  const run = () => syncFormPhotos().catch((e) => console.warn('📷 Form photo sync failed:', e?.message || e));
  setTimeout(run, 60000);
  return setInterval(run, 10 * 60000);
}
