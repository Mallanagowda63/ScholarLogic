import { Router } from 'express';
import {
  startInterviewSession,
  submitInterviewResponse,
  finishInterviewSession,
  getInterviewHistory,
  getInterviewDetail,
  getLiveSessionToken,
} from '../controllers/mockInterviewController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('STUDENT'));

router.get('/', asyncHandler(getInterviewHistory));
router.get('/live-token', asyncHandler(getLiveSessionToken));
router.post('/start', asyncHandler(startInterviewSession));
router.get('/:id', asyncHandler(getInterviewDetail));
router.post('/:id/respond', asyncHandler(submitInterviewResponse));
router.post('/:id/finish', asyncHandler(finishInterviewSession));

export default router;
