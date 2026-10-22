import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { authenticateUser, authorizeRoles, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { Student } from '../models/Student';
import { TrackCourse } from '../models/tracking/TrackCourse';
import { Batch } from '../models/tracking/Batch';
import { StudentBatchAllocation, ACTIVE_ALLOCATION_STATUSES } from '../models/tracking/StudentBatchAllocation';
import { PlacementReferral, OPEN_REFERRAL_STATUSES } from '../models/PlacementReferral';
import { sseService } from '../services/sseService';
import { PLACEHOLDER_EMAIL_DOMAIN } from '../services/trackingService';

// Trainers push students to the placement team; the placement team works through them course by course
const router = Router();
router.use(authenticateUser);

const trainers = authorizeRoles('TRAINER', 'ADMIN', 'SUPER_ADMIN');
const placementTeam = authorizeRoles('PLACEMENT_MANAGER', 'ADMIN', 'SUPER_ADMIN');
const oid = (raw: unknown, what: string) => {
  const id = String(raw || '');
  if (!mongoose.isValidObjectId(id)) throw new AppError(`Invalid ${what}`, 400, 'INVALID_ID');
  return new mongoose.Types.ObjectId(id);
};
const realEmail = (email?: string) => (email && !email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`) ? email : '');

// Current batch (code + trainer) for each student, from their live allocation
async function currentBatches(studentIds: mongoose.Types.ObjectId[]) {
  const allocations = await StudentBatchAllocation.find({ studentId: { $in: studentIds }, status: { $in: ACTIVE_ALLOCATION_STATUSES } })
    .select('studentId batchId')
    .lean();
  const batches = await Batch.find({ _id: { $in: allocations.map((a) => a.batchId) } })
    .select('batchCode trainerId')
    .populate('trainerId', 'fullName')
    .lean();
  const byId = new Map(batches.map((b: any) => [String(b._id), b]));
  const result = new Map<string, { batchCode: string; trainerId: string; trainerName: string }[]>();
  for (const a of allocations) {
    const b: any = byId.get(String(a.batchId));
    if (!b) continue;
    const list = result.get(String(a.studentId)) || [];
    list.push({ batchCode: b.batchCode, trainerId: String(b.trainerId?._id || ''), trainerName: b.trainerId?.fullName || '' });
    result.set(String(a.studentId), list);
  }
  return result;
}

// Trainer's student list: everyone, flagged when they are in one of this trainer's batches, with their referral state
router.get(
  '/students',
  trainers,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const students: any[] = await Student.find({}).select('studentId phone enrollment userId').populate('userId', 'fullName').lean();
    const ids = students.map((s) => s._id);
    const [courses, batchMap, referrals] = await Promise.all([
      TrackCourse.find({}).select('name').lean(),
      currentBatches(ids),
      PlacementReferral.find({ studentId: { $in: ids } }).sort({ createdAt: -1 }).populate('pushedById', 'fullName').lean(),
    ]);
    const courseName = new Map(courses.map((c: any) => [String(c._id), c.name]));
    const latest = new Map<string, any>();
    for (const r of referrals) if (!latest.has(String(r.studentId))) latest.set(String(r.studentId), r);
    const me = String(req.user?.userId);
    const rows = students
      .map((s) => {
        const batches = batchMap.get(String(s._id)) || [];
        const r: any = latest.get(String(s._id));
        return {
          _id: s._id,
          studentId: s.studentId,
          fullName: s.userId?.fullName || '',
          phone: s.phone || '',
          course: s.enrollment?.courseId ? courseName.get(String(s.enrollment.courseId)) || '' : '',
          batches: batches.map((b) => b.batchCode),
          inMyBatch: batches.some((b) => b.trainerId === me),
          referral: r ? { _id: r._id, status: r.status, pushedAt: r.createdAt, pushedBy: r.pushedById?.fullName || '', note: r.note } : null,
        };
      })
      .sort((a, b) => Number(b.inMyBatch) - Number(a.inMyBatch) || a.studentId.localeCompare(b.studentId, undefined, { numeric: true }));
    res.json({ success: true, data: { students: rows } });
  })
);

// Push a student to the placement team; every placement manager is notified
router.post(
  '/',
  trainers,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const student: any = await Student.findById(oid(req.body?.studentId, 'student')).select('studentId enrollment userId').populate('userId', 'fullName');
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
    const open = await PlacementReferral.findOne({ studentId: student._id, status: { $in: OPEN_REFERRAL_STATUSES } }).select('_id');
    if (open) throw new AppError(`${student.userId?.fullName || student.studentId} is already with the placement team`, 409, 'ALREADY_PUSHED');

    const course: any = student.enrollment?.courseId ? await TrackCourse.findById(student.enrollment.courseId).select('name').lean() : null;
    const note = String(req.body?.note || '').trim().slice(0, 1000);
    const referral = await PlacementReferral.create({
      studentId: student._id,
      courseId: course?._id,
      courseName: course?.name || '',
      pushedById: req.user!.userId,
      note,
    });

    const name = student.userId?.fullName || student.studentId;
    await sseService.broadcastNotification(
      { role: 'PLACEMENT_MANAGER' },
      {
        title: 'Student pushed to placement',
        message: `${req.user?.fullName || 'A trainer'} pushed ${name} (${student.studentId})${course ? `, ${course.name}` : ''}${note ? `: "${note.slice(0, 120)}"` : ''}`,
        type: 'JOB',
        linkUrl: `/placement/ready-students${course ? `?course=${encodeURIComponent(course.name)}` : ''}`,
      }
    );
    res.status(201).json({ success: true, message: `${name} pushed to the placement team`, data: { referral } });
  })
);

// Placement team: every pushed student, with course, batch, trainer and contact details
router.get(
  '/',
  placementTeam,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const referrals: any[] = await PlacementReferral.find({})
      .sort({ createdAt: -1 })
      .populate({ path: 'studentId', select: 'studentId phone college degree branch userId', populate: { path: 'userId', select: 'fullName email' } })
      .populate('pushedById', 'fullName')
      .populate('handledById', 'fullName')
      .lean();
    const batchMap = await currentBatches(referrals.map((r) => r.studentId?._id).filter(Boolean));
    const rows = referrals.map((r) => ({
      _id: r._id,
      status: r.status,
      note: r.note,
      placementNote: r.placementNote,
      courseName: r.courseName || 'No course',
      pushedAt: r.createdAt,
      pushedBy: r.pushedById?.fullName || '',
      handledBy: r.handledById?.fullName || '',
      updatedAt: r.updatedAt,
      student: r.studentId
        ? {
            _id: r.studentId._id,
            studentId: r.studentId.studentId,
            fullName: r.studentId.userId?.fullName || '',
            email: realEmail(r.studentId.userId?.email),
            phone: r.studentId.phone || '',
            college: r.studentId.college || '',
            degree: [r.studentId.degree, r.studentId.branch].filter(Boolean).join(' • '),
            batches: (batchMap.get(String(r.studentId._id)) || []).map((b) => b.batchCode),
          }
        : null,
    }));
    res.json({ success: true, data: { referrals: rows } });
  })
);

// Placement team updates progress on a pushed student
router.put(
  '/:id',
  placementTeam,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const referral = await PlacementReferral.findById(oid(req.params.id, 'referral'));
    if (!referral) throw new AppError('Not found', 404, 'NOT_FOUND');
    const { status, placementNote } = req.body || {};
    if (status !== undefined) {
      if (!['NEW', 'IN_PROGRESS', 'PLACED', 'CLOSED'].includes(status)) throw new AppError('Invalid status', 400, 'INVALID_STATUS');
      referral.status = status;
    }
    if (typeof placementNote === 'string') referral.placementNote = placementNote.trim().slice(0, 1000);
    referral.handledById = req.user?.userId as any;
    await referral.save();
    res.json({ success: true, message: 'Updated', data: { referral } });
  })
);

export default router;
