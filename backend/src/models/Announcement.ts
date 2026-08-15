import mongoose, { Schema, Document } from 'mongoose';

export interface IAnnouncement extends Document {
  _id: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  trainerId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  targetBatch?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AnnouncementSchema = new Schema<IAnnouncement>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    trainerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    targetBatch: { type: String, default: 'ALL' },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
