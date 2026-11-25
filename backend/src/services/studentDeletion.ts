import mongoose from 'mongoose';
import { Student } from '../models/Student';
import { User } from '../models/User';

/**
 * Permanently removes one student: their login, profile and everything that belongs only to them
 * (progress, exams, results, resumes, applications, allocations, timeline, online attendance, …).
 * Records that also matter on their own are kept but unlinked: Google Form responses and
 * registrations, and eSSL machine punches (those return to the review queue under the machine code).
 */
const UNLINK_ONLY = new Set(['studentregistrations', 'googleformsubmissions', 'biometricpunches']);
const SKIP = new Set(['students', 'users', 'attendances']);

export async function deleteStudentCompletely(studentMongoId: string) {
  const student = await Student.findById(studentMongoId).select('studentId userId').lean();
  if (!student) return null;
  const db = mongoose.connection.db!;
  const ids = [student._id, student.userId].filter(Boolean);
  const summary: Record<string, number> = {};

  for (const c of await db.listCollections().toArray()) {
    if (SKIP.has(c.name) || c.name.startsWith('system.')) continue;
    const col = db.collection(c.name);
    if (UNLINK_ONLY.has(c.name)) {
      const r = await col.updateMany({ studentId: { $in: ids } }, { $unset: { studentId: '' } });
      if (r.modifiedCount) summary[`${c.name} (unlinked)`] = r.modifiedCount;
    } else {
      const r = await col.deleteMany({ $or: [{ studentId: { $in: ids } }, { userId: { $in: ids } }] });
      if (r.deletedCount) summary[c.name] = r.deletedCount;
    }
  }
  // Trainer-marked class attendance keeps the class; only this student's line goes
  await db.collection('attendances').updateMany({ 'records.studentId': student._id }, { $pull: { records: { studentId: student._id } } } as any);
  await Student.deleteOne({ _id: student._id });
  if (student.userId) await User.deleteOne({ _id: student.userId, role: 'STUDENT' });
  return { studentId: student.studentId, summary };
}
