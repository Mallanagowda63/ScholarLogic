import mongoose, { Schema, Document } from 'mongoose';

export type SubmissionStatus = 'SUBMITTED' | 'GRADED' | 'LATE';

export interface ISubmission extends Document {
  _id: mongoose.Types.ObjectId;
  assignmentId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  submissionFileUrl?: string;
  submissionText?: string;
  marksObtained?: number;
  feedback?: string;
  submittedAt: Date;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema = new Schema<ISubmission>(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    submissionFileUrl: { type: String, default: '' },
    submissionText: { type: String, default: '' },
    marksObtained: { type: Number },
    feedback: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['SUBMITTED', 'GRADED', 'LATE'], default: 'SUBMITTED' },
  },
  { timestamps: true }
);

SubmissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

export const Submission = mongoose.model<ISubmission>('Submission', SubmissionSchema);
