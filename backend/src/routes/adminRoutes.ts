import { Router } from 'express';
import { getAdminMetrics, getAuditLogs } from '../controllers/adminController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('ADMIN', 'SUPER_ADMIN'));

router.get('/metrics', asyncHandler(getAdminMetrics));
router.get('/audit-logs', asyncHandler(getAuditLogs));

export default router;
