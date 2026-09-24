import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { AppError } from '../middleware/errorHandler';
import { sseService } from '../services/sseService';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  const notifications = await Notification.find({ userId: req.user.userId })
    .sort({ createdAt: -1 })
    .limit(20);

  const unreadCount = await Notification.countDocuments({ userId: req.user.userId, read: false });

  res.json({
    success: true,
    data: { notifications, unreadCount },
  });
};

export const markNotificationAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const notification = await Notification.findById(id);
  if (!notification) throw new AppError('Notification not found', 404, 'NOT_FOUND');

  notification.read = true;
  await notification.save();

  res.json({
    success: true,
    message: 'Notification marked as read',
  });
};

export const markAllNotificationsAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  await Notification.updateMany({ userId: req.user.userId, read: false }, { $set: { read: true } });

  res.json({
    success: true,
    message: 'All notifications marked as read',
  });
};

export const streamNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Connection Established' })}\n\n`);

  sseService.addClient(req.user.userId.toString(), res);

  req.on('close', () => {
    sseService.removeClient(res);
  });
};
