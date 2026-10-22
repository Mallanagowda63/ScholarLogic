import { Router } from 'express';
import { login, refreshToken, getMe, updateMyCredentials, getMyProfile, updateMyProfile } from '../controllers/authController';
import { authenticateUser, authorizeRoles } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/login', asyncHandler(login));
router.post('/refresh', asyncHandler(refreshToken));
router.get('/me', authenticateUser, asyncHandler(getMe));
// Admins change their own login email / password; nobody else can change theirs
// Staff edit their own details; no password / email / role changes here
const staff = authorizeRoles('ADMIN', 'SUPER_ADMIN', 'TRAINER', 'PLACEMENT_MANAGER');
router.get('/my-profile', authenticateUser, staff, asyncHandler(getMyProfile));
router.put('/my-profile', authenticateUser, staff, asyncHandler(updateMyProfile));
router.put('/my-credentials', authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN'), asyncHandler(updateMyCredentials));

export default router;
