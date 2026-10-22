import mongoose, { Schema, Document } from 'mongoose';

export type BatchStatus = 'UPCOMING' | 'RUNNING' | 'DELAYED' | 'COMPLETED' | 'CANCELLED';
export type LearningMode = 'ONLINE' | 'OFFLINE';

export interface IBatchHistoryEntry {
  at: Date;
  action: string;
  details: string;
  byUserId?: mongoose.Types.ObjectId;
}

export interface IBatch extends Document {
  _id: mongoose.Types.ObjectId;
  batchCode: string; // short ID, e.g. PY-B01
  subjectId: mongoose.Types.ObjectId;
  trainerId?: mongoose.Types.ObjectId; // User with role TRAINER
  mode: LearningMode;
  timing: string; // e.g. "7-8 AM"
  startDate: Date;
  expectedEndDate: Date;
  actualEndDate?: Date;
  capacity: number;
  status: BatchStatus;
  remarks: string;
  completedTopicIds: mongoose.Types.ObjectId[]; // syllabus topics the trainer has finished for this batch
  classesConducted: number;
  history: IBatchHistoryEntry[]; // append-only log of batch changes
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatch>(
  {
    batchCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    trainerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    mode: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE' },
    timing: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    expectedEndDate: { type: Date, required: true },
    actualEndDate: { type: Date },
    capacity: { type: Number, default: 30 },
    status: { type: String, enum: ['UPCOMING', 'RUNNING', 'DELAYED', 'COMPLETED', 'CANCELLED'], default: 'UPCOMING' },
    remarks: { type: String, default: '' },
    completedTopicIds: [{ type: Schema.Types.ObjectId }],
    classesConducted: { type: Number, default: 0 },
    history: [
      {
        at: { type: Date, default: Date.now },
        action: String,
        details: String,
        byUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

export const Batch = mongoose.model<IBatch>('Batch', BatchSchema);
