import { Router } from 'express';
import {
  getExams,
  getExamById,
  createExam,
  startExam,
  recordViolation,
  saveProgress,
  submitExam,
  getMyResults,
  getResultById,
  getQuestionBank,
  createQuestion,
  updateQuestion,
  archiveQuestion,
  duplicateQuestion,
  getExamResultsForTrainer,
} from '../controllers/examController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);

// Question Bank Routes
router.get('/questions', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(getQuestionBank));
router.post('/questions', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(createQuestion));
router.put('/questions/:id', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(updateQuestion));
router.post('/questions/:id/archive', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(archiveQuestion));
router.post('/questions/:id/duplicate', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(duplicateQuestion));

// Exam Builder & Management Routes
router.get('/', asyncHandler(getExams));
router.get('/results/me', authorizeRoles('STUDENT'), asyncHandler(getMyResults));
router.get('/results/:id', asyncHandler(getResultById));
router.get('/:id/trainer-results', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(getExamResultsForTrainer));
router.get('/:id', asyncHandler(getExamById));

router.post('/', authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(createExam));
router.post('/:id/start', authorizeRoles('STUDENT'), asyncHandler(startExam));
router.post('/attempts/:attemptId/violation', authorizeRoles('STUDENT'), asyncHandler(recordViolation));
router.post('/attempts/:attemptId/save', authorizeRoles('STUDENT'), asyncHandler(saveProgress));
router.post('/attempts/:attemptId/submit', authorizeRoles('STUDENT'), asyncHandler(submitExam));

export default router;
