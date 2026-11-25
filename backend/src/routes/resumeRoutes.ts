import { Router } from 'express';
import multer from 'multer';
import {
  analyzeResume,
  getMyResumes,
  saveResume,
  updateResume,
  deleteResume,
  parseResumeFile,
  getStarterResume,
  uploadResumeFile,
  reviewMyResume,
} from '../controllers/resumeController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('STUDENT'));

// A resume file (PDF / Word) up to 5 MB, kept in memory only while the AI reads it
const resumeUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');

router.get('/starter', asyncHandler(getStarterResume));
router.post('/upload', resumeUpload, asyncHandler(uploadResumeFile));
router.post('/review', asyncHandler(reviewMyResume));
router.post('/parse', asyncHandler(parseResumeFile));
router.post('/analyze', asyncHandler(analyzeResume));
router.get('/', asyncHandler(getMyResumes));
router.post('/generate', asyncHandler(saveResume));
router.put('/:id', asyncHandler(updateResume));
router.delete('/:id', asyncHandler(deleteResume));

export default router;
