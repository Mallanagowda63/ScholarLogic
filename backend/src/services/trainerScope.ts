import mongoose from 'mongoose';
import { Batch } from '../models/tracking/Batch';
import { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } from '../models/tracking/StudentBatchAllocation';
import { AppError } from '../middleware/errorHandler';

/**
 * A trainer only sees the students currently allocated to one of their batches.
 * Admins (and anyone who isn't a trainer) are not limited by this.
 */
export async function trainerStudentIds(trainerUserId: string): Promise<mongoose.Types.ObjectId[]> {
  const batches = await Batch.find({ trainerId: trainerUserId }).select('_id').lean();
  if (!batches.length) return [];
  const allocations = await StudentBatchAllocation.find({ batchId: { $in: batches.map((b) => b._id) }, status: { $in: ACTIVE_ALLOCATION_STATUSES } })
    .select('studentId')
    .lean();
  const seen = new Set<string>();
  return allocations.map((a) => a.studentId).filter((id) => (seen.has(String(id)) ? false : (seen.add(String(id)), true)));
}

/** Throws 403 when a trainer asks for a student who isn't in one of their batches */
export async function assertTrainerCanSee(user: { userId?: string; role?: string } | undefined, studentId: unknown) {
  if (user?.role !== 'TRAINER') return;
  const mine = await trainerStudentIds(String(user.userId));
  if (!mine.some((id) => String(id) === String(studentId))) {
    throw new AppError('This student is not in any of your batches', 403, 'NOT_YOUR_STUDENT');
  }
}
