import { Batch } from '../models/tracking/Batch';
import { Student } from '../models/Student';
import { Notification } from '../models/Notification';
import { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } from '../models/tracking/StudentBatchAllocation';
import { isZohoConfigured, listZohoRecordings } from './zohoOAuthService';

/**
 * Class recordings of a batch: after a Zoho meeting created from ScholarLogic ends and Zoho finishes the upload,
 * its recording is added to the batch automatically (hourly, or when the trainer presses the button).
 */
export async function syncBatchRecordings(batchId: string): Promise<{ added: number; checked: number }> {
  const batch: any = await Batch.findById(batchId);
  if (!batch?.trainerId || !batch.zohoMeetings?.length) return { added: 0, checked: 0 };
  const keys = new Set(batch.zohoMeetings.map((m: any) => String(m.meetingKey)).filter(Boolean));
  const recordings = await listZohoRecordings(String(batch.trainerId));
  const have = new Set((batch.classRecordings || []).flatMap((r: any) => [r.zohoRecordingId, r.url]).filter(Boolean));
  let added = 0;
  for (const r of recordings) {
    if (!keys.has(r.meetingKey) || !r.ready || !r.url || have.has(r.id) || have.has(r.url)) continue;
    batch.classRecordings.push({
      title: r.topic || `Class recording`,
      url: r.url,
      recordedAt: r.recordedAt || undefined,
      durationMinutes: r.durationMinutes || undefined,
      source: 'ZOHO',
      zohoRecordingId: r.id,
      meetingKey: r.meetingKey,
      addedAt: new Date(),
    });
    added++;
  }
  if (added) {
    batch.history.push({ at: new Date(), action: 'RECORDINGS_ADDED', details: `${added} Zoho recording${added === 1 ? '' : 's'} added` });
    await batch.save();
    await notifyStudents(batch, 'New class recording', `${added === 1 ? 'A new recording' : `${added} new recordings`} of your ${batch.batchCode} class ${added === 1 ? 'is' : 'are'} ready on your dashboard.`);
  }
  return { added, checked: recordings.length };
}

export async function notifyStudents(batch: any, title: string, message: string) {
  const allocations = await StudentBatchAllocation.find({ batchId: batch._id, status: { $in: ACTIVE_ALLOCATION_STATUSES } }).select('studentId').lean();
  const students = await Student.find({ _id: { $in: allocations.map((a) => a.studentId) } }).select('userId').lean();
  const docs = students.filter((s) => s.userId).map((s) => ({ userId: s.userId, title, message, type: 'COURSE' as const, linkUrl: '/student/dashboard' }));
  if (docs.length) await Notification.insertMany(docs);
  return docs.length;
}

/** Every hour: batches with a Zoho meeting in the last 14 days pick up new recordings */
export function startRecordingSync() {
  if (!isZohoConfigured()) return null;
  const run = async () => {
    const since = new Date(Date.now() - 14 * 86400000);
    const batches = await Batch.find({ 'zohoMeetings.startAt': { $gte: since, $lte: new Date() } }).select('_id batchCode').lean();
    for (const b of batches) {
      try {
        const r = await syncBatchRecordings(String(b._id));
        if (r.added) console.log(`🎬 ${b.batchCode}: ${r.added} Zoho recording(s) added`);
      } catch (err: any) {
        console.warn(`⚠️ Zoho recordings for ${b.batchCode}: ${String(err?.message || err).slice(0, 160)}`);
      }
    }
  };
  setTimeout(() => run().catch(() => undefined), 60000);
  return setInterval(() => run().catch(() => undefined), 60 * 60000);
}
