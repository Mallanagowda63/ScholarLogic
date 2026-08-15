import { Router } from 'express';
import {
  getCourses,
  getCourseById,
  createCourse,
  createModule,
  createLesson,
  updateVideoProgress,
  submitAssignment,
  submitQuiz,
} from '../controllers/courseController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);

router.get('/', asyncHandler(getCourses));
router.get('/:id', asyncHandler(getCourseById));
router.post('/', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(createCourse));
router.post('/:courseId/modules', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(createModule));
router.post('/modules/:moduleId/lessons', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(createLesson));
router.post('/progress', authorizeRoles('STUDENT'), asyncHandler(updateVideoProgress));
router.post('/assignments/:assignmentId/submit', authorizeRoles('STUDENT'), asyncHandler(submitAssignment));
router.post('/quizzes/:quizId/submit', authorizeRoles('STUDENT'), asyncHandler(submitQuiz));

export default router;
