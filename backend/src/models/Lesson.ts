import mongoose, { Schema, Document } from 'mongoose';

export type LessonType = 'VIDEO' | 'NOTES' | 'ASSIGNMENT' | 'QUIZ';

export interface ILesson extends Document {
  _id: mongoose.Types.ObjectId;
  moduleId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  title: string;
  type: LessonType;
  order: number;
  videoUrl?: string;
  durationMinutes?: number;
  notesFileUrl?: string;
  notesFileType?: string;
  assignmentId?: mongoose.Types.ObjectId;
  quizId?: mongoose.Types.ObjectId;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LessonSchema = new Schema<ILesson>(
  {
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['VIDEO', 'NOTES', 'ASSIGNMENT', 'QUIZ'],
      required: true,
      default: 'VIDEO',
    },
    order: { type: Number, required: true, default: 1 },
    videoUrl: { type: String, default: '' },
    durationMinutes: { type: Number, default: 15 },
    notesFileUrl: { type: String, default: '' },
    notesFileType: { type: String, default: 'PDF' },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment' },
    quizId: { type: Schema.Types.ObjectId, ref: 'Quiz' },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Lesson = mongoose.model<ILesson>('Lesson', LessonSchema);
