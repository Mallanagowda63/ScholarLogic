import mongoose, { Schema, Document } from 'mongoose';

export interface ITopicPerformance {
  topic: string;
  totalQuestions: number;
  correctQuestions: number;
  percentage: number;
}

export interface IResult extends Document {
  _id: mongoose.Types.ObjectId;
  attemptId: mongoose.Types.ObjectId;
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  rank?: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  timeSpentSeconds: number;
  topicBreakdown: ITopicPerformance[];
  evaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ResultSchema = new Schema<IResult>(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: 'ExamAttempt', required: true, unique: true },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    score: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    percentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    rank: { type: Number },
    correctCount: { type: Number, required: true },
    wrongCount: { type: Number, required: true },
    unansweredCount: { type: Number, required: true },
    timeSpentSeconds: { type: Number, default: 0 },
    topicBreakdown: [
      {
        topic: String,
        totalQuestions: Number,
        correctQuestions: Number,
        percentage: Number,
      },
    ],
    evaluatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Result = mongoose.model<IResult>('Result', ResultSchema);
