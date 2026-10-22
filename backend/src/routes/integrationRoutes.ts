import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { receiveGoogleFormSubmission } from '../controllers/registrationController';
import { asyncHandler } from '../utils/asyncHandler';

// Server-to-server integrations. Authenticated by shared secret header, not user login.
const router = Router();

const formLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { success: false, code: 'TOO_MANY_REQUESTS', message: 'Too many form submissions. Please retry shortly.' },
});

router.post('/google-form/student', formLimiter, asyncHandler(receiveGoogleFormSubmission));

export default router;
