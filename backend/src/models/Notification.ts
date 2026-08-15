import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType =
  | 'COURSE'
  | 'EXAM'
  | 'ASSIGNMENT'
  | 'JOB'
  | 'APPLICATION'
  | 'INTERVIEW'
  | 'OFFER'
  | 'SYSTEM';

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  linkUrl?: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: ['COURSE', 'EXAM', 'ASSIGNMENT', 'JOB', 'APPLICATION', 'INTERVIEW', 'OFFER', 'SYSTEM'],
      default: 'SYSTEM',
    },
    linkUrl: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
