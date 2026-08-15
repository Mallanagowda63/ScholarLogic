import mongoose, { Schema, Document } from 'mongoose';

export type InterviewMode = 'ONLINE' | 'OFFLINE';
export type InterviewStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';

export interface IInterview extends Document {
  _id: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  interviewDate: Date;
  roundName: string; // e.g. "Technical Round 1"
  mode: InterviewMode;
  meetingLink?: string;
  interviewerName?: string;
  notes?: string;
  status: InterviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewSchema = new Schema<IInterview>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    interviewDate: { type: Date, required: true },
    roundName: { type: String, required: true, default: 'Technical Interview' },
    mode: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' },
    meetingLink: { type: String, default: '' },
    interviewerName: { type: String, default: 'Placement Panel' },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'], default: 'SCHEDULED' },
  },
  { timestamps: true }
);

export const Interview = mongoose.model<IInterview>('Interview', InterviewSchema);
