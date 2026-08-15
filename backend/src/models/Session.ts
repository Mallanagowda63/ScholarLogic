import mongoose, { Schema, Document } from 'mongoose';

export type SessionType = 'LECTURE' | 'LAB' | 'ASSESSMENT' | 'DOUBT_CLEARING';

export interface ISession extends Document {
  _id: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  trainerId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  meetingLink?: string;
  type: SessionType;
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    trainerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    meetingLink: { type: String, default: '' },
    type: { type: String, enum: ['LECTURE', 'LAB', 'ASSESSMENT', 'DOUBT_CLEARING'], default: 'LECTURE' },
  },
  { timestamps: true }
);

export const Session = mongoose.model<ISession>('Session', SessionSchema);
