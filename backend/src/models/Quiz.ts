import mongoose, { Schema, Document } from 'mongoose';

export interface IQuizQuestion {
  _id?: mongoose.Types.ObjectId;
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation?: string;
  marks: number;
}

export interface IQuiz extends Document {
  _id: mongoose.Types.ObjectId;
  lessonId: mongoose.Types.ObjectId;
  title: string;
  questions: IQuizQuestion[];
  passingScorePercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

const QuizSchema = new Schema<IQuiz>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    title: { type: String, required: true, trim: true },
    questions: [
      {
        questionText: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswerIndex: { type: Number, required: true },
        explanation: { type: String, default: '' },
        marks: { type: Number, default: 10 },
      },
    ],
    passingScorePercentage: { type: Number, default: 70 },
  },
  { timestamps: true }
);

export const Quiz = mongoose.model<IQuiz>('Quiz', QuizSchema);
