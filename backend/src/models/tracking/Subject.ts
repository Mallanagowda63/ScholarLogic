import mongoose, { Schema, Document } from 'mongoose';

export interface ISubjectTopic {
  _id: mongoose.Types.ObjectId;
  title: string;
  order: number;
}

// A teachable subject (e.g. Python) with its predefined topic syllabus
export interface ISubject extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string; // short prefix used for batch IDs, e.g. PY
  expectedDurationDays: number;
  topics: ISubjectTopic[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    expectedDurationDays: { type: Number, default: 30 },
    topics: [
      {
        title: { type: String, required: true, trim: true },
        order: { type: Number, required: true },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Subject = mongoose.model<ISubject>('Subject', SubjectSchema);
