import mongoose, { Schema, Document } from 'mongoose';

export type InterviewStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ITranscriptMessage {
  speaker: 'AI' | 'STUDENT';
  message: string;
  timestamp: Date;
}

export interface IMockInterview extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  role: string;
  experienceLevel: string;
  difficulty: string;
  interviewType: string;
  questions: string[];
  currentQuestionIndex: number;
  transcript: ITranscriptMessage[];
  overallScore?: number;
  communicationScore?: number;
  technicalScore?: number;
  confidenceScore?: number;
  feedback?: {
    strengths: string[];
    improvements: string[];
    summary: string;
  };
  status: InterviewStatus;
  startedAt: Date;
  endedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MockInterviewSchema = new Schema<IMockInterview>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    role: { type: String, required: true },
    experienceLevel: { type: String, default: 'Junior / Entry Level' },
    difficulty: { type: String, default: 'MEDIUM' },
    interviewType: { type: String, default: 'TECHNICAL' },
    questions: [{ type: String }],
    currentQuestionIndex: { type: Number, default: 0 },
    transcript: [
      {
        speaker: { type: String, enum: ['AI', 'STUDENT'], required: true },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    overallScore: { type: Number },
    communicationScore: { type: Number },
    technicalScore: { type: Number },
    confidenceScore: { type: Number },
    feedback: {
      strengths: [{ type: String }],
      improvements: [{ type: String }],
      summary: { type: String },
    },
    status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'], default: 'IN_PROGRESS' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

export const MockInterview = mongoose.model<IMockInterview>('MockInterview', MockInterviewSchema);
