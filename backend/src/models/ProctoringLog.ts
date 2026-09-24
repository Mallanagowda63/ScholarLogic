import mongoose, { Schema, Document } from 'mongoose';

export type ProctoringEventType =
  | 'TAB_SWITCH'
  | 'WINDOW_BLUR'
  | 'WINDOW_FOCUS'
  | 'FULLSCREEN_EXIT'
  | 'FULLSCREEN_ENTER';

export interface IProctoringLog extends Document {
  _id: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  attemptId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  eventType: ProctoringEventType;
  timestamp: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ProctoringLogSchema = new Schema<IProctoringLog>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    attemptId: { type: Schema.Types.ObjectId, ref: 'ExamAttempt', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    eventType: {
      type: String,
      enum: ['TAB_SWITCH', 'WINDOW_BLUR', 'WINDOW_FOCUS', 'FULLSCREEN_EXIT', 'FULLSCREEN_ENTER'],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const ProctoringLog = mongoose.model<IProctoringLog>('ProctoringLog', ProctoringLogSchema);
