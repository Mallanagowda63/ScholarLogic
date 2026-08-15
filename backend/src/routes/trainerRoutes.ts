import { Router } from 'express';
import {
  getTrainerDashboard,
  getTrainerCourses,
  createTrainerModule,
  createTrainerLesson,
  uploadLessonMedia,
  getTrainerStudents,
  getStudentDetailForTrainer,
  getTrainerAssignments,
  createTrainerAssignment,
  getAssignmentSubmissions,
  gradeSubmission,
  markAttendance,
  getAttendanceHistory,
  createAnnouncement,
  getAnnouncements,
  createSession,
  getTrainerCalendar,
} from '../controllers/trainerController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('TRAINER', 'ADMIN', 'SUPER_ADMIN'));

router.get('/dashboard', asyncHandler(getTrainerDashboard));
router.get('/courses', asyncHandler(getTrainerCourses));
router.post('/courses/:courseId/modules', asyncHandler(createTrainerModule));
router.post('/modules/:moduleId/lessons', asyncHandler(createTrainerLesson));
router.post('/lessons/:lessonId/media', asyncHandler(uploadLessonMedia));

router.get('/students', asyncHandler(getTrainerStudents));
router.get('/students/:id', asyncHandler(getStudentDetailForTrainer));

router.get('/assignments', asyncHandler(getTrainerAssignments));
router.post('/assignments', asyncHandler(createTrainerAssignment));
router.get('/assignments/:id/submissions', asyncHandler(getAssignmentSubmissions));
router.post('/submissions/:id/grade', asyncHandler(gradeSubmission));

router.post('/attendance', asyncHandler(markAttendance));
router.get('/attendance', asyncHandler(getAttendanceHistory));

router.post('/announcements', asyncHandler(createAnnouncement));
router.get('/announcements', asyncHandler(getAnnouncements));

router.post('/sessions', asyncHandler(createSession));
router.get('/calendar', asyncHandler(getTrainerCalendar));

export default router;
