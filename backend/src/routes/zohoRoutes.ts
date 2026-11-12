import { Router, Request, Response } from 'express';
import { authenticateUser, authorizeRoles, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { disconnectZoho, finishZohoConnect, zohoConnectUrl, zohoStatus } from '../services/zohoOAuthService';

/** Trainer ↔ Zoho Meeting connection (Connect Zoho button). The callback is where Zoho sends the browser back. */
const router = Router();
const trainer = [authenticateUser, authorizeRoles('TRAINER')];

router.get(
  '/status',
  ...trainer,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ success: true, data: await zohoStatus(String(req.user!.userId)) });
  })
);

router.get(
  '/connect-url',
  ...trainer,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json({ success: true, data: { url: zohoConnectUrl(String(req.user!.userId), String(req.query.returnTo || '/trainer/batches')) } });
  })
);

router.post(
  '/disconnect',
  ...trainer,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await disconnectZoho(String(req.user!.userId));
    res.json({ success: true, message: 'Zoho disconnected' });
  })
);

// Zoho redirects here after the trainer signs in; no ScholarLogic session in this request, the signed state says who it is
router.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code || !state) {
      res.redirect(`${(process.env.FRONTEND_URL || '').replace(/\/+$/, '')}/trainer/batches?zoho=cancelled`);
      return;
    }
    res.redirect(await finishZohoConnect(code, state));
  })
);

export default router;
