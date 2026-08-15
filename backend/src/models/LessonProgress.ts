import mongoose, { Schema, Document } from 'mongoose';

export interface ILessonProgress extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  moduleId: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
  watchedSeconds: number;
  durationSeconds: number;
  videoPercentage: number;
  videoCompleted: boolean;
  notesViewed: boolean;
  quizCompleted: boolean;
  assignmentCompleted: boolean;
  lessonCompleted: boolean;
  lastWatchedPosition: number;
  completedAt?: Date;
  updatedAt: Date;
  createdAt: Date;
}

const LessonProgressSchema = new Schema<ILessonProgress>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    watchedSeconds: { type: Number, default: 0 },
    durationSeconds: { type: Number, default: 0 },
    videoPercentage: { type: Number, default: 0 },
    videoCompleted: { type: Boolean, default: false },
    notesViewed: { type: Boolean, default: false },
    quizCompleted: { type: Boolean, default: false },
    assignmentCompleted: { type: Boolean, default: false },
    lessonCompleted: { type: Boolean, default: false },
    lastWatchedPosition: { type: Number, default: 0 },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

LessonProgressSchema.index({ studentId: 1, lessonId: 1 }, { unique: true });

export const LessonProgress = mongoose.model<ILessonProgress>('LessonProgress', LessonProgressSchema);
