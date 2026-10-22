import mongoose, { Schema, Document } from 'mongoose';

export type AllocationStatus =
  | 'BATCH_ALLOCATED'
  | 'ATTENDING'
  | 'RE_ATTENDING'
  | 'COMPLETED'
  | 'MISSED'
  | 'MOVED'
  | 'REALLOCATION_REQUIRED'
  | 'DROPPED'
  | 'ON_HOLD';

// Statuses that mean "this allocation is the student's live seat in the batch"
export const ACTIVE_ALLOCATION_STATUSES: AllocationStatus[] = ['BATCH_ALLOCATED', 'ATTENDING', 'RE_ATTENDING'];

// One row per (student, batch) seat. Rows are never deleted: moves and
// reallocations close the old row and create a new one linked by previousAllocationId.
export interface IStudentBatchAllocation extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  allocationDate: Date;
  startDate: Date;
  endDate?: Date;
  status: AllocationStatus;
  mode: 'ONLINE' | 'OFFLINE';
  reason: string;
  remarks: string;
  previousAllocationId?: mongoose.Types.ObjectId;
  allocatedById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StudentBatchAllocationSchema = new Schema<IStudentBatchAllocation>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'TrackCourse' },
    allocationDate: { type: Date, default: Date.now },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ['BATCH_ALLOCATED', 'ATTENDING', 'RE_ATTENDING', 'COMPLETED', 'MISSED', 'MOVED', 'REALLOCATION_REQUIRED', 'DROPPED', 'ON_HOLD'],
      default: 'BATCH_ALLOCATED',
    },
    mode: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE' },
    reason: { type: String, default: '' },
    remarks: { type: String, default: '' },
    previousAllocationId: { type: Schema.Types.ObjectId, ref: 'StudentBatchAllocation' },
    allocatedById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const StudentBatchAllocation = mongoose.model<IStudentBatchAllocation>(
  'StudentBatchAllocation',
  StudentBatchAllocationSchema
);
