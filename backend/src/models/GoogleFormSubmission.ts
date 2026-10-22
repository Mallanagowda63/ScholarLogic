import mongoose, { Schema, Document } from 'mongoose';

export type SubmissionProcessingStatus = 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'DUPLICATE';

// Raw copy of every Google Form response the backend receives, stored before any processing
// so a mapping failure never loses a response. Admins can retry FAILED rows.
export interface IGoogleFormSubmission extends Document {
  _id: mongoose.Types.ObjectId;
  externalSubmissionId: string;
  submittedAt: Date;
  rawPayload: any;
  processingStatus: SubmissionProcessingStatus;
  errorMessage: string;
  resultNote: string;
  attempts: number;
  registrationId?: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const GoogleFormSubmissionSchema = new Schema<IGoogleFormSubmission>(
  {
    externalSubmissionId: { type: String, required: true, unique: true },
    submittedAt: { type: Date, required: true },
    rawPayload: { type: Schema.Types.Mixed, required: true },
    processingStatus: { type: String, enum: ['RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE'], default: 'RECEIVED', index: true },
    errorMessage: { type: String, default: '' },
    resultNote: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    registrationId: { type: Schema.Types.ObjectId, ref: 'StudentRegistration', index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  },
  { timestamps: true }
);

export const GoogleFormSubmission = mongoose.model<IGoogleFormSubmission>('GoogleFormSubmission', GoogleFormSubmissionSchema);
