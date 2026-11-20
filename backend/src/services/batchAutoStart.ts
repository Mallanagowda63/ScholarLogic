import { Batch } from '../models/tracking/Batch';
import { StudentBatchAllocation } from '../models/tracking/StudentBatchAllocation';

/**
 * Upcoming batches whose start date has come are switched to Running by themselves (before, they stayed
 * "Upcoming" until an admin pressed Start or the trainer posted the first class). Their students go from
 * "Assigned" to "Attending". Runs at start-up and every 30 minutes; no emails are sent.
 */
const IST_OFFSET_MS = 5.5 * 3600000;

export async function startDueBatches(now = new Date()): Promise<number> {
  // End of today in India: a batch starting today counts as started
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const endOfTodayIst = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 23, 59, 59, 999) - IST_OFFSET_MS);
  const due = await Batch.find({ status: 'UPCOMING', startDate: { $lte: endOfTodayIst } });
  for (const b of due) {
    b.status = 'RUNNING';
    (b as any).history?.push({ at: now, action: 'STATUS_CHANGED', details: 'UPCOMING → RUNNING (start date reached)' });
    await b.save();
    await StudentBatchAllocation.updateMany({ batchId: b._id, status: 'BATCH_ALLOCATED' }, { status: 'ATTENDING' });
  }
  if (due.length) console.log(`▶️ ${due.length} batch(es) started on their start date: ${due.map((b) => b.batchCode).join(', ')}`);
  return due.length;
}

export function startBatchAutoStart() {
  const run = () => startDueBatches().catch((e) => console.warn('Batch auto-start failed:', e?.message || e));
  setTimeout(run, 20000);
  return setInterval(run, 30 * 60000);
}
