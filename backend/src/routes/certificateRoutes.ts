import { Router } from 'express';
import { getMyCertificates, verifyCertificate, issueCertificate } from '../controllers/certificateController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Public verification endpoint (No auth required!)
router.get('/verify/:certificateId', asyncHandler(verifyCertificate));

// Protected endpoints
router.get('/me', authenticateUser, authorizeRoles('STUDENT'), asyncHandler(getMyCertificates));
router.post('/issue', authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(issueCertificate));

export default router;
