import mongoose, { Schema, Document } from 'mongoose';

export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  durationHours: number;
  status: CourseStatus;
  createdById: mongoose.Types.ObjectId;
  assignedTrainerIds: mongoose.Types.ObjectId[];
  enrolledStudentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    thumbnailUrl: { type: String, default: '' },
    category: { type: String, required: true },
    level: { type: String, enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'], default: 'BEGINNER' },
    durationHours: { type: Number, default: 40 },
    status: { type: String, enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], default: 'PUBLISHED' },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTrainerIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    enrolledStudentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Course = mongoose.model<ICourse>('Course', CourseSchema);
