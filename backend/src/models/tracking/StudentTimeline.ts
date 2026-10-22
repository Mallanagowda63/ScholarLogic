import mongoose, { Schema, Document } from 'mongoose';

export type TimelineEventType =
  | 'JOINED'
  | 'ALLOCATED'
  | 'MOVED'
  | 'REALLOCATED'
  | 'ALLOCATION_STATUS'
  | 'SUBJECT_COMPLETED'
  | 'STATUS_CHANGED'
  | 'REJOINED'
  | 'MODE_CHANGED'
  | 'PROFILE_UPDATED';

// Append-only student history. Never updated or deleted.
export interface IStudentTimeline extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  type: TimelineEventType;
  title: string;
  details: string;
  date: Date;
  batchId?: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  allocationId?: mongoose.Types.ObjectId;
  byUserId?: mongoose.Types.ObjectId;
  byName?: string;
  createdAt: Date;
}

const StudentTimelineSchema = new Schema<IStudentTimeline>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    details: { type: String, default: '' },
    date: { type: Date, default: Date.now, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch' },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
    allocationId: { type: Schema.Types.ObjectId, ref: 'StudentBatchAllocation' },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StudentTimeline = mongoose.model<IStudentTimeline>('StudentTimeline', StudentTimelineSchema);
