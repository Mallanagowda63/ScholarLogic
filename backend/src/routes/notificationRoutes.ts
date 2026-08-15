import { Router } from 'express';
import { getNotifications, markNotificationAsRead } from '../controllers/notificationController';
import { authenticateUser } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticateUser);

router.get('/', asyncHandler(getNotifications));
router.put('/:id/read', asyncHandler(markNotificationAsRead));

export default router;
