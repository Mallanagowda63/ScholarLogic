import mongoose, { Schema, Document } from 'mongoose';

// A written / classroom test whose marks a trainer uploaded from Excel. Counts in the student leaderboard
// together with the online exams.
export interface IOfflineTestEntry {
  studentId: mongoose.Types.ObjectId;
  studentCode: string; // Student ID as on the sheet (e.g. SCLR245)
  name: string;
  marks: number;
  outOf: number;
  percentage: number;
}

export interface IOfflineTest extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  date: Date;
  batchId?: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  outOf: number;
  entries: IOfflineTestEntry[];
  fileName: string;
  uploadedById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OfflineTestSchema = new Schema<IOfflineTest>(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject' },
    outOf: { type: Number, required: true },
    entries: [
      {
        studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
        studentCode: String,
        name: String,
        marks: Number,
        outOf: Number,
        percentage: Number,
      },
    ],
    fileName: { type: String, default: '' },
    uploadedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const OfflineTest = mongoose.model<IOfflineTest>('OfflineTest', OfflineTestSchema);
