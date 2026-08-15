import mongoose, { Schema, Document } from 'mongoose';

export interface IStudentCourseProgress extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  completedLessons: number;
  totalLessons: number;
  progressPercentage: number;
  completedVideos: number;
  totalVideos: number;
  completedNotes: number;
  totalNotes: number;
  completedQuizzes: number;
  totalQuizzes: number;
  completedAssignments: number;
  totalAssignments: number;
  completedExams: number;
  totalExams: number;
  lastLessonId?: mongoose.Types.ObjectId;
  lastWatchedPosition?: number; // seconds
  lastAccessedAt?: Date;
  streakDays: number;
  learningTimeMinutes: number;
  academicScore: number;
  certificateEligible: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StudentCourseProgressSchema = new Schema<IStudentCourseProgress>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    completedLessons: { type: Number, default: 0 },
    totalLessons: { type: Number, default: 0 },
    progressPercentage: { type: Number, default: 0 },
    completedVideos: { type: Number, default: 0 },
    totalVideos: { type: Number, default: 0 },
    completedNotes: { type: Number, default: 0 },
    totalNotes: { type: Number, default: 0 },
    completedQuizzes: { type: Number, default: 0 },
    totalQuizzes: { type: Number, default: 0 },
    completedAssignments: { type: Number, default: 0 },
    totalAssignments: { type: Number, default: 0 },
    completedExams: { type: Number, default: 0 },
    totalExams: { type: Number, default: 0 },
    lastLessonId: { type: Schema.Types.ObjectId, ref: 'Lesson' },
    lastWatchedPosition: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: Date.now },
    streakDays: { type: Number, default: 1 },
    learningTimeMinutes: { type: Number, default: 0 },
    academicScore: { type: Number, default: 85 },
    certificateEligible: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound index to ensure unique progress per student per course
StudentCourseProgressSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export const StudentCourseProgress = mongoose.model<IStudentCourseProgress>('StudentCourseProgress', StudentCourseProgressSchema);
