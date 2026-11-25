import mongoose from 'mongoose';
import { Student } from '../models/Student';
import { StudentBatchAllocation } from '../models/tracking/StudentBatchAllocation';

/**
 * Lessons a trainer sent to specific batches (Lesson.batchIds) are shown only to students who have
 * ever been allocated to one of those batches; a student who finished or moved on keeps their notes.
 * Lessons with no batchIds stay visible to everyone in the course.
 */
export async function batchIdsForStudentUser(userId: string | mongoose.Types.ObjectId): Promise<Set<string>> {
  const student = await Student.findOne({ userId }).select('_id').lean();
  if (!student) return new Set();
  const ids = await StudentBatchAllocation.distinct('batchId', { studentId: student._id });
  return new Set(ids.map(String));
}

export function filterLessonsForBatches<T extends { batchIds?: mongoose.Types.ObjectId[] }>(lessons: T[], batchIds: Set<string>): T[] {
  return lessons.filter((l) => !l.batchIds?.length || l.batchIds.some((id) => batchIds.has(String(id))));
}
