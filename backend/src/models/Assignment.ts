import mongoose, { Schema, Document } from 'mongoose';

export interface IAssignment extends Document {
  _id: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  dueDate: Date;
  maxMarks: number;
  attachmentUrl?: string;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    dueDate: { type: Date, required: true },
    maxMarks: { type: Number, default: 100 },
    attachmentUrl: { type: String, default: '' },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Assignment = mongoose.model<IAssignment>('Assignment', AssignmentSchema);
