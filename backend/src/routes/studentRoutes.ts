import { Router } from 'express';
import { getStudentDashboard, updateStudentProfile, getAllStudents } from '../controllers/studentController';
import { getStudentCourseProgress, updateLessonProgress, markLessonComplete } from '../controllers/courseProgressController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);

router.get('/dashboard', authorizeRoles('STUDENT'), asyncHandler(getStudentDashboard));
router.put('/me', authorizeRoles('STUDENT'), asyncHandler(updateStudentProfile));
router.get('/', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PLACEMENT_MANAGER', 'TRAINER'), asyncHandler(getAllStudents));

// Course Progress & LMS Video/Notes Sync APIs
router.get('/courses/:courseId/progress', authorizeRoles('STUDENT'), asyncHandler(getStudentCourseProgress));
router.post('/lessons/:lessonId/progress', authorizeRoles('STUDENT'), asyncHandler(updateLessonProgress));
router.post('/lessons/:lessonId/complete', authorizeRoles('STUDENT'), asyncHandler(markLessonComplete));

export default router;
