import mongoose, { Schema, Document } from 'mongoose';

export type QuestionType = 'MCQ' | 'MULTIPLE_SELECT' | 'TRUE_FALSE' | 'SHORT_ANSWER';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionStatus = 'ACTIVE' | 'ARCHIVED';

export interface IQuestion extends Document {
  _id: mongoose.Types.ObjectId;
  examId?: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  moduleId?: mongoose.Types.ObjectId;
  lessonId?: mongoose.Types.ObjectId;
  questionText: string;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  options: string[];
  correctAnswer: any; // MCQ index, Array of indices, boolean, or string
  marks: number;
  negativeMarks: number;
  explanation?: string;
  topicTag: string;
  tags: string[];
  status: QuestionStatus;
  createdById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module' },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson' },
    questionText: { type: String, required: true },
    type: {
      type: String,
      enum: ['MCQ', 'MULTIPLE_SELECT', 'TRUE_FALSE', 'SHORT_ANSWER'],
      required: true,
      default: 'MCQ',
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD'],
      default: 'MEDIUM',
    },
    options: [{ type: String }],
    correctAnswer: { type: Schema.Types.Mixed, required: true },
    marks: { type: Number, required: true, default: 5 },
    negativeMarks: { type: Number, default: 0 },
    explanation: { type: String, default: '' },
    topicTag: { type: String, required: true, default: 'General' },
    tags: [{ type: String }],
    status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
    createdById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Question = mongoose.model<IQuestion>('Question', QuestionSchema);
