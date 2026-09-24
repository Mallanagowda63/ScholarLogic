import { Router } from 'express';
import { getMyCertificates, verifyCertificate, issueCertificate, downloadCertificatePDF } from '../controllers/certificateController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Public verification & PDF download endpoints (No auth required!)
router.get('/verify/:certificateId', asyncHandler(verifyCertificate));
router.get('/:certificateId/pdf', asyncHandler(downloadCertificatePDF));

// Protected endpoints
router.get('/me', authenticateUser, authorizeRoles('STUDENT'), asyncHandler(getMyCertificates));
router.post('/issue', authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER'), asyncHandler(issueCertificate));

export default router;
