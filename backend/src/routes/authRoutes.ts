import { Router } from 'express';
import { login, refreshToken, getMe, updateMyCredentials } from '../controllers/authController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/login', asyncHandler(login));
router.post('/refresh', asyncHandler(refreshToken));
router.get('/me', authenticateUser, asyncHandler(getMe));
// Admins change their own login email / password; nobody else can change theirs
router.put('/my-credentials', authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN'), asyncHandler(updateMyCredentials));

export default router;
