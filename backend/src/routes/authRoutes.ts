import { Router } from 'express';
import multer from 'multer';
import { login, refreshToken, getMe, updateMyCredentials, getMyProfile, updateMyProfile, uploadMyPhoto, removeMyPhoto, getPhoto } from '../controllers/authController';
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
// Profile photo: up to 2 MB, kept in the database; anyone may view it (it appears in the top bar)
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } }).single('photo');
router.put('/my-photo', authenticateUser, staff, photoUpload, asyncHandler(uploadMyPhoto));
router.delete('/my-photo', authenticateUser, staff, asyncHandler(removeMyPhoto));
router.get('/photo/:userId', asyncHandler(getPhoto));
router.put('/my-credentials', authenticateUser, authorizeRoles('ADMIN', 'SUPER_ADMIN'), asyncHandler(updateMyCredentials));

export default router;
