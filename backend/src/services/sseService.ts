import { Response } from 'express';
import { Notification, NotificationType } from '../models/Notification';

interface SSEClient {
  userId: string;
  res: Response;
}

class SSEService {
  private clients: SSEClient[] = [];

  addClient(userId: string, res: Response): void {
    this.clients.push({ userId, res });
    console.log(`📡 SSE client connected: User ${userId} (Total connected: ${this.clients.length})`);
  }

  removeClient(res: Response): void {
    this.clients = this.clients.filter((c) => c.res !== res);
    console.log(`📡 SSE client disconnected (Remaining connected: ${this.clients.length})`);
  }

  async sendNotificationToUser(
    userId: string,
    notificationData: {
      title: string;
      message: string;
      type: NotificationType;
      linkUrl?: string;
    }
  ) {
    try {
      const notification = await Notification.create({
        userId,
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        linkUrl: notificationData.linkUrl || '',
      });

      const userClients = this.clients.filter((c) => c.userId === userId.toString());
      userClients.forEach((client) => {
        client.res.write(`data: ${JSON.stringify({ type: 'NEW_NOTIFICATION', notification })}\n\n`);
      });

      return notification;
    } catch (err) {
      console.error('❌ Error sending SSE notification:', err);
    }
  }

  async broadcastNotification(
    userFilter: object,
    notificationData: {
      title: string;
      message: string;
      type: NotificationType;
      linkUrl?: string;
    }
  ) {
    try {
      const User = (await import('../models/User')).User;
      const targetUsers = await User.find(userFilter).select('_id');

      for (const u of targetUsers) {
        await this.sendNotificationToUser(u._id.toString(), notificationData);
      }
    } catch (err) {
      console.error('❌ Error broadcasting SSE notification:', err);
    }
  }
}

export const sseService = new SSEService();
