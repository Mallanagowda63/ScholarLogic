import mongoose, { Schema, Document } from 'mongoose';

export type ExamAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'EXPIRED';
export type SubmissionReason = 'USER_SUBMITTED' | 'TIME_EXPIRED' | 'MAX_VIOLATIONS';

export interface IViolationRecord {
  type: 'TAB_SWITCH' | 'WINDOW_BLUR' | 'FULLSCREEN_EXIT' | 'CAMERA_DISCONNECTED' | 'MICROPHONE_DISCONNECTED' | 'TIME_EXPIRED';
  timestamp: Date;
  metadata?: any;
}

export interface IActivityLog {
  timestamp: Date;
  event: string;
  details?: string;
}

export interface IExamAttempt extends Document {
  _id: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  startTime: Date;
  expiresAt: Date;
  submitTime?: Date;
  submissionReason?: SubmissionReason;
  answers: Map<string, any>; // questionId -> student answer
  markedForReview: string[];
  score?: number;
  percentage?: number;
  passed?: boolean;
  violationsCount: number;
  violations: IViolationRecord[];
  status: ExamAttemptStatus;
  ipAddress?: string;
  activityLogs: IActivityLog[];
  createdAt: Date;
  updatedAt: Date;
}

const ExamAttemptSchema = new Schema<IExamAttempt>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    startTime: { type: Date, default: Date.now, required: true },
    expiresAt: { type: Date, required: true },
    submitTime: { type: Date },
    submissionReason: { type: String, enum: ['USER_SUBMITTED', 'TIME_EXPIRED', 'MAX_VIOLATIONS'], default: 'USER_SUBMITTED' },
    answers: { type: Map, of: Schema.Types.Mixed, default: {} },
    markedForReview: [{ type: String }],
    score: { type: Number },
    percentage: { type: Number },
    passed: { type: Boolean },
    violationsCount: { type: Number, default: 0 },
    violations: [
      {
        type: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        metadata: Schema.Types.Mixed,
      },
    ],
    status: { type: String, enum: ['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'], default: 'IN_PROGRESS' },
    ipAddress: { type: String, default: '' },
    activityLogs: [
      {
        timestamp: { type: Date, default: Date.now },
        event: String,
        details: String,
      },
    ],
  },
  { timestamps: true }
);

export const ExamAttempt = mongoose.model<IExamAttempt>('ExamAttempt', ExamAttemptSchema);
