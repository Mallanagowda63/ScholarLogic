import { Router, Response } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { authenticateUser, authorizeRoles, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { Banner } from '../models/Banner';

// Student dashboard banners: everyone signed in reads the active ones; admins and the placement team manage them.
// Images are stored in the database with the banner (MongoDB, max 5 MB each).
const router = Router();

const managers = authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PLACEMENT_MANAGER');
const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('image');

const oid = (raw: unknown) => {
  const id = String(raw || '');
  if (!mongoose.isValidObjectId(id)) throw new AppError('Invalid banner ID', 400, 'INVALID_ID');
  return id;
};

const imageFile = (req: AuthRequest) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (file && !IMAGE_TYPES[file.mimetype]) throw new AppError('Upload a PNG, JPG or WEBP image', 400, 'INVALID_FILE');
  return file;
};

// The image goes into the banner document; the URL carries a version so browsers fetch a replaced image
const imageFields = (id: mongoose.Types.ObjectId, file: Express.Multer.File) => ({
  imageData: file.buffer,
  imageType: file.mimetype,
  imageSize: file.size,
  imageUrl: `/api/banners/${id}/image?v=${Date.now()}`,
});

// Image itself. Public (an <img> tag sends no login token); banners are shown to every student anyway
router.get(
  '/:id/image',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const banner = await Banner.findById(oid(req.params.id)).select('+imageData imageType updatedAt').lean();
    if (!banner?.imageData) throw new AppError('Banner image not found', 404, 'NOT_FOUND');
    res.setHeader('Content-Type', banner.imageType);
    // The URL changes whenever the image does, so it can be cached for a long time
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from((banner.imageData as any).buffer ?? banner.imageData));
  })
);

router.use(authenticateUser);

const parseBool = (v: unknown) => (v === undefined ? undefined : v === true || v === 'true');

// Active banners for the student dashboard, in display order
router.get(
  '/',
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const banners = await Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).select('title imageUrl').lean();
    res.json({ success: true, data: { banners } });
  })
);

// Every banner, including hidden ones, for the manage screen
router.get(
  '/manage',
  managers,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    const banners = await Banner.find({})
      .sort({ sortOrder: 1, createdAt: 1 })
      .populate('createdById', 'fullName role')
      .populate('updatedById', 'fullName role')
      .lean();
    res.json({ success: true, data: { banners } });
  })
);

router.post(
  '/',
  managers,
  upload,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = imageFile(req);
    if (!file) throw new AppError('Choose a banner image', 400, 'MISSING_FILE');
    const title = String(req.body?.title || '').trim();
    if (!title) throw new AppError('Add a title (e.g. "Ranjith Kumar placed at TCS, 7 LPA")', 400, 'MISSING_FIELDS');
    const last = await Banner.findOne({}).sort({ sortOrder: -1 }).select('sortOrder').lean();
    const _id = new mongoose.Types.ObjectId();
    const banner = await Banner.create({
      _id,
      title,
      ...imageFields(_id, file),
      sortOrder: (last?.sortOrder ?? 0) + 1,
      isActive: parseBool(req.body?.isActive) ?? true,
      createdById: req.user?.userId,
      updatedById: req.user?.userId,
    });
    res.status(201).json({ success: true, message: 'Banner added', data: { banner: { _id: banner._id, title: banner.title, imageUrl: banner.imageUrl } } });
  })
);

// New display order: the full list of banner IDs, first to last
router.put(
  '/reorder',
  managers,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(oid) : [];
    if (!ids.length) throw new AppError('Send the banner IDs in their new order', 400, 'MISSING_FIELDS');
    await Banner.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { sortOrder: i + 1 } } } })));
    res.json({ success: true, message: 'Order saved' });
  })
);

// Edit the title, show/hide, or replace the image (the old image is overwritten in the database)
router.put(
  '/:id',
  managers,
  upload,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const banner = await Banner.findById(oid(req.params.id));
    if (!banner) throw new AppError('Banner not found', 404, 'NOT_FOUND');
    const file = imageFile(req);
    if (typeof req.body?.title === 'string') {
      const title = req.body.title.trim();
      if (!title) throw new AppError('The title cannot be empty', 400, 'MISSING_FIELDS');
      banner.title = title;
    }
    const active = parseBool(req.body?.isActive);
    if (active !== undefined) banner.isActive = active;

    if (file) Object.assign(banner, imageFields(banner._id, file));
    banner.updatedById = req.user?.userId as any;
    await banner.save();
    res.json({ success: true, message: 'Banner updated', data: { banner: { _id: banner._id, title: banner.title, imageUrl: banner.imageUrl, isActive: banner.isActive } } });
  })
);

// Deletes the banner and, with it, its image from the database
router.delete(
  '/:id',
  managers,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const res1 = await Banner.deleteOne({ _id: oid(req.params.id) });
    if (!res1.deletedCount) throw new AppError('Banner not found', 404, 'NOT_FOUND');
    res.json({ success: true, message: 'Banner deleted' });
  })
);

export default router;
