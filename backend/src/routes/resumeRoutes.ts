import { Router } from 'express';
import {
  analyzeResume,
  getMyResumes,
  saveResume,
  updateResume,
  deleteResume,
} from '../controllers/resumeController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('STUDENT'));

router.post('/analyze', asyncHandler(analyzeResume));
router.get('/', asyncHandler(getMyResumes));
router.post('/generate', asyncHandler(saveResume));
router.put('/:id', asyncHandler(updateResume));
router.delete('/:id', asyncHandler(deleteResume));

export default router;
