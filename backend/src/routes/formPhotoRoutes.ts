import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { FormPhoto } from '../models/FormPhoto';

// A student's form photo, by its Google Drive file id (long and random, like the Drive link itself).
// Public so an <img> can show it (it sends no token), the same as profile photos.
const router = Router();

router.get(
  '/:driveId',
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.driveId || '');
    if (!/^[\w-]{20,}$/.test(id)) throw new AppError('No photo', 404, 'NOT_FOUND');
    const photo = await FormPhoto.findOne({ driveId: id, fetchedAt: { $ne: null } }).lean();
    if (!photo?.data) throw new AppError('No photo', 404, 'NOT_FOUND');
    res.setHeader('Content-Type', photo.type || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(Buffer.from((photo.data as any).buffer ?? photo.data));
  })
);

export default router;
