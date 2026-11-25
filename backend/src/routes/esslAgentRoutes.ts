import express, { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { punchCutoff, recordAgentFailure, storeSnapshot } from '../services/esslPullService';
import { logSync } from '../services/biometricShared';

/**
 * Campus helper → server. The helper runs on a computer inside the campus network (the only place
 * the eSSL machine can be reached), reads the machine every few minutes and posts what it read here.
 * Authenticated with ESSL_AGENT_SECRET (header X-ESSL-Agent-Secret).
 */
const router = Router();
// The first push can carry the machine's whole log, larger than the app-wide 2 MB limit
router.use(express.json({ limit: '15mb' }));

const secretOk = (given: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(env.ESSL_AGENT_SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

router.use((req: Request, _res: Response, next) => {
  if (!env.ESSL_AGENT_SECRET) return next(new AppError('Campus helper is not enabled on this server (ESSL_AGENT_SECRET)', 503, 'NOT_CONFIGURED'));
  if (!secretOk(String(req.header('X-ESSL-Agent-Secret') || ''))) return next(new AppError('Invalid helper secret', 401, 'UNAUTHORIZED'));
  next();
});

// What the helper needs to send: punches on or after this date (everything when empty)
router.get(
  '/cursor',
  asyncHandler(async (req: Request, res: Response) => {
    const serial = String(req.query.serial || '').trim();
    if (!serial) throw new AppError('serial is required', 400, 'MISSING_FIELDS');
    res.json({ success: true, data: { cutoff: await punchCutoff(serial), intervalMinutes: env.ESSL_PULL_INTERVAL_MINUTES } });
  })
);

const isStr = (v: unknown, max = 64) => typeof v === 'string' && v.length <= max;

router.post(
  '/push',
  asyncHandler(async (req: Request, res: Response) => {
    const { serialNumber, users = [], punches = [] } = req.body || {};
    if (!isStr(serialNumber) || !serialNumber) throw new AppError('serialNumber is required', 400, 'MISSING_FIELDS');
    if (!Array.isArray(users) || !Array.isArray(punches)) throw new AppError('users and punches must be lists', 400, 'INVALID_PAYLOAD');
    if (env.BIOMETRIC_DEVICE_SERIALS.length && !env.BIOMETRIC_DEVICE_SERIALS.includes(serialNumber)) {
      throw new AppError(`Machine ${serialNumber} is not allowed (BIOMETRIC_DEVICE_SERIALS on the server)`, 403, 'UNKNOWN_DEVICE');
    }
    // Keep only well-formed rows; the machine's own data, nothing else
    const cleanUsers = users
      .filter((u: any) => u && isStr(u.userId, 24) && u.userId && isStr(u.name ?? '', 64) && isStr(String(u.card ?? ''), 20))
      .map((u: any) => ({ uid: Number(u.uid) || 0, userId: u.userId, name: u.name || '', card: String(u.card || ''), privilege: Number(u.privilege) || 0 }));
    const cleanPunches = punches
      .filter((p: any) => p && isStr(p.userId, 24) && p.userId && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(p.localTime)))
      .map((p: any) => ({ userId: p.userId, localTime: p.localTime, state: Number(p.state) || 0, verify: Number(p.verify) || 0 }));
    const result = await storeSnapshot({ serialNumber, users: cleanUsers, punches: cleanPunches }, 'agent', `Campus helper (${req.ip})`);
    res.json({ success: true, data: result });
  })
);

// The helper reports when it cannot reach the machine, so admins see it on the eSSL page
router.post(
  '/error',
  asyncHandler(async (req: Request, res: Response) => {
    const message = String(req.body?.message || 'Unknown error').slice(0, 300);
    recordAgentFailure(`Campus helper: ${message}`);
    await logSync('DEVICE', 'ERROR', `Campus helper could not read the machine: ${message}`);
    res.json({ success: true });
  })
);

export default router;
