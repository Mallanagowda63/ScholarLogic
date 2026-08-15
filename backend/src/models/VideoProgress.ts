import mongoose, { Schema, Document } from 'mongoose';

export interface IVideoProgress extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  progressPercentage: number;
  completed: boolean;
  lastWatchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VideoProgressSchema = new Schema<IVideoProgress>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    progressPercentage: { type: Number, default: 0, min: 0, max: 100 },
    completed: { type: Boolean, default: false },
    lastWatchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

VideoProgressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });

export const VideoProgress = mongoose.model<IVideoProgress>('VideoProgress', VideoProgressSchema);
