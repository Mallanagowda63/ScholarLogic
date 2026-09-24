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
import { authenticateUser, authorizeRoles, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Course browsing is public (marketing "Courses" page); mutations & progress stay authenticated.
router.get('/', optionalAuth, asyncHandler(getCourses));
router.get('/:id', optionalAuth, asyncHandler(getCourseById));
router.post('/', authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(createCourse));
router.post('/:courseId/modules', authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(createModule));
router.post('/modules/:moduleId/lessons', authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(createLesson));
router.post('/progress', authenticateUser, authorizeRoles('STUDENT'), asyncHandler(updateVideoProgress));
router.post('/assignments/:assignmentId/submit', authenticateUser, authorizeRoles('STUDENT'), asyncHandler(submitAssignment));
router.post('/quizzes/:quizId/submit', authenticateUser, authorizeRoles('STUDENT'), asyncHandler(submitQuiz));

export default router;
