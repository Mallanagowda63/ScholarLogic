import { Router } from 'express';
import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { Student } from '../models/Student';
import { AuditLog } from '../models/AuditLog';
import { deleteStudentCompletely } from '../services/studentDeletion';
import {
  allocateStudent,
  changeMode,
  changeTrainingStatus,
  createBatch,
  createTrackedStudent,
  getBatchDetail,
  getGlobalTimeline,
  getMonthlyPlanning,
  getMyJourney,
  getNextAllocations,
  getOverview,
  getTrackedStudent,
  listBatches,
  listCourses,
  listMyBatches,
  listSubjects,
  listTrackedStudents,
  listTrainers,
  reallocate,
  saveCourse,
  saveSubject,
  setAllocationStatus,
  submitDailyUpdate,
  updateBatch,
  updateTrackedStudent,
} from '../controllers/trackingController';
import {
  getGoogleFormSyncStatus,
  syncGoogleForm,
  getRegistration,
  listRegistrations,
  listSubmissions,
  rejectRegistration,
  retrySubmission,
  updateRegistration,
  verifyRegistration,
} from '../controllers/registrationController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

// Student + Batch + Trainer tracking
const router = Router();
router.use(authenticateUser);

const admin = authorizeRoles('ADMIN', 'SUPER_ADMIN');
const adminOrTrainer = authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER');

// Student self-view (read only)
router.get('/me', authorizeRoles('STUDENT'), asyncHandler(getMyJourney));

// Trainer
router.get('/trainer/batches', authorizeRoles('TRAINER'), asyncHandler(listMyBatches));
router.get('/batches/:id', adminOrTrainer, asyncHandler(getBatchDetail));
router.post('/batches/:id/updates', adminOrTrainer, asyncHandler(submitDailyUpdate));

// Admin
router.get('/overview', admin, asyncHandler(getOverview));
router.get('/next-allocations', admin, asyncHandler(getNextAllocations));
router.get('/planning', admin, asyncHandler(getMonthlyPlanning));
router.get('/timeline', admin, asyncHandler(getGlobalTimeline));
router.get('/trainers', admin, asyncHandler(listTrainers));

router.get('/subjects', admin, asyncHandler(listSubjects));
router.post('/subjects', admin, asyncHandler(saveSubject));
router.put('/subjects/:id', admin, asyncHandler(saveSubject));

router.get('/courses', admin, asyncHandler(listCourses));
router.post('/courses', admin, asyncHandler(saveCourse));
router.put('/courses/:id', admin, asyncHandler(saveCourse));

router.get('/batches', admin, asyncHandler(listBatches));
router.post('/batches', admin, asyncHandler(createBatch));
router.put('/batches/:id', admin, asyncHandler(updateBatch));

router.get('/students', admin, asyncHandler(listTrackedStudents));
router.post('/students', admin, asyncHandler(createTrackedStudent));
router.get('/students/:id', admin, asyncHandler(getTrackedStudent));
router.put('/students/:id', admin, asyncHandler(updateTrackedStudent));
// Permanently delete a student (login, profile and their own records); audit-logged
router.delete(
  '/students/:id',
  admin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid student', 400, 'INVALID_ID');
    const student: any = await Student.findById(id).select('studentId userId').populate('userId', 'fullName email').lean();
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
    const result = await deleteStudentCompletely(id);
    await AuditLog.create({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      action: 'STUDENT_DELETED',
      resource: 'STUDENT',
      metadata: { studentId: student.studentId, fullName: student.userId?.fullName, removed: result?.summary },
      ipAddress: req.ip,
    }).catch(() => undefined);
    res.json({ success: true, message: `${student.userId?.fullName || student.studentId} was deleted`, data: result });
  })
);
router.post('/students/:id/allocate', admin, asyncHandler(allocateStudent));
router.post('/students/:id/status', admin, asyncHandler(changeTrainingStatus));
router.post('/students/:id/mode', admin, asyncHandler(changeMode));

router.post('/allocations/:id/status', admin, asyncHandler(setAllocationStatus));
router.post('/allocations/:id/reallocate', admin, asyncHandler(reallocate));

// New Registrations (Google Form intake → admin verification)
router.get('/registrations', admin, asyncHandler(listRegistrations));
router.post('/registrations/sync', admin, asyncHandler(syncGoogleForm));
router.get('/registrations/sync-status', admin, asyncHandler(getGoogleFormSyncStatus));
router.get('/registrations/submissions', admin, asyncHandler(listSubmissions));
router.post('/registrations/submissions/:id/retry', admin, asyncHandler(retrySubmission));
router.get('/registrations/:id', admin, asyncHandler(getRegistration));
router.put('/registrations/:id', admin, asyncHandler(updateRegistration));
router.post('/registrations/:id/verify', admin, asyncHandler(verifyRegistration));
router.post('/registrations/:id/reject', admin, asyncHandler(rejectRegistration));

export default router;
