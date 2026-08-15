import mongoose, { Schema, Document } from 'mongoose';

export interface IJobDescription extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  title: string;
  companyName: string;
  rawText: string;
  fileUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobDescriptionSchema = new Schema<IJobDescription>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    title: { type: String, required: true },
    companyName: { type: String, default: 'Target Company' },
    rawText: { type: String, required: true },
    fileUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

export const JobDescription = mongoose.model<IJobDescription>('JobDescription', JobDescriptionSchema);
