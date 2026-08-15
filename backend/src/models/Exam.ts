import mongoose, { Schema, Document } from 'mongoose';

export type ExamStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface ISecuritySettings {
  requireFullscreen: boolean;
  requireCamera: boolean;
  requireMicrophone: boolean;
  detectTabSwitch: boolean;
  detectWindowBlur: boolean;
  autoSubmitOnViolations: boolean;
  maxViolations: number;
  questionRandomization: boolean;
  optionRandomization: boolean;
}

export interface IExam extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  courseId?: mongoose.Types.ObjectId;
  moduleId?: mongoose.Types.ObjectId;
  durationMinutes: number;
  startTime?: Date;
  endTime?: Date;
  totalMarks: number;
  passingMarks: number;
  negativeMarking: number;
  attemptLimit: number;
  status: ExamStatus;
  isPublished: boolean;
  securitySettings: ISecuritySettings;
  questionIds: mongoose.Types.ObjectId[];
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ExamSchema = new Schema<IExam>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course' },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module' },
    durationMinutes: { type: Number, required: true, default: 60 },
    startTime: { type: Date },
    endTime: { type: Date },
    totalMarks: { type: Number, required: true, default: 100 },
    passingMarks: { type: Number, required: true, default: 60 },
    negativeMarking: { type: Number, default: 0 },
    attemptLimit: { type: Number, default: 3 },
    status: { type: String, enum: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'ARCHIVED'], default: 'ACTIVE' },
    isPublished: { type: Boolean, default: true },
    securitySettings: {
      requireFullscreen: { type: Boolean, default: true },
      requireCamera: { type: Boolean, default: true },
      requireMicrophone: { type: Boolean, default: false },
      detectTabSwitch: { type: Boolean, default: true },
      detectWindowBlur: { type: Boolean, default: true },
      autoSubmitOnViolations: { type: Boolean, default: true },
      maxViolations: { type: Number, default: 3 },
      questionRandomization: { type: Boolean, default: true },
      optionRandomization: { type: Boolean, default: false },
    },
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Exam = mongoose.model<IExam>('Exam', ExamSchema);
