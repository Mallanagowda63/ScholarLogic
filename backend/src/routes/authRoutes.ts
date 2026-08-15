import { Router } from 'express';
import { register, login, refreshToken, getMe } from '../controllers/authController';
import { authenticateUser } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/refresh', asyncHandler(refreshToken));
router.get('/me', authenticateUser, asyncHandler(getMe));

export default router;
