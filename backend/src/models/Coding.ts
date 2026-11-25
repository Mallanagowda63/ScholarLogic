import mongoose, { Schema, Document } from 'mongoose';

// Technical practice: trainers make folders (e.g. "If-else") of coding questions with test cases.
// Students solve them in the browser IDE (Python / SQL / JavaScript run on the student's own device);
// every submission is saved with its test results and the trainer is told.
export type CodingLanguage = 'python' | 'sql' | 'javascript';

export interface ICodingFolder extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  language: CodingLanguage;
  batchIds: mongoose.Types.ObjectId[]; // empty = every student
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CodingFolderSchema = new Schema<ICodingFolder>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    language: { type: String, enum: ['python', 'sql', 'javascript'], required: true },
    batchIds: [{ type: Schema.Types.ObjectId, ref: 'Batch' }],
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);
export const CodingFolder = mongoose.model<ICodingFolder>('CodingFolder', CodingFolderSchema);

export interface ICodingTest {
  input: string;
  expected: string;
  hidden: boolean;
}

export interface ICodingQuestion extends Document {
  _id: mongoose.Types.ObjectId;
  folderId: mongoose.Types.ObjectId;
  order: number;
  title: string;
  description: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  starterCode: string;
  solution: string; // trainer's reference answer (never sent to students)
  sqlSetup: string; // SQL only: CREATE TABLE / INSERT run before the student's query
  tests: ICodingTest[];
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CodingQuestionSchema = new Schema<ICodingQuestion>(
  {
    folderId: { type: Schema.Types.ObjectId, ref: 'CodingFolder', required: true, index: true },
    order: { type: Number, default: 0 },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD'], default: 'EASY' },
    starterCode: { type: String, default: '' },
    solution: { type: String, default: '' },
    sqlSetup: { type: String, default: '' },
    tests: [{ input: { type: String, default: '' }, expected: { type: String, default: '' }, hidden: { type: Boolean, default: false } }],
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);
export const CodingQuestion = mongoose.model<ICodingQuestion>('CodingQuestion', CodingQuestionSchema);

export interface ICodingSubmission extends Document {
  _id: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  folderId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  language: CodingLanguage;
  code: string;
  passed: number;
  total: number;
  status: 'PASSED' | 'PARTIAL' | 'FAILED';
  results: { passed: boolean; got: string; error: string }[];
  trainerNote: string;
  createdAt: Date;
}

const CodingSubmissionSchema = new Schema<ICodingSubmission>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'CodingQuestion', required: true, index: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'CodingFolder', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    language: { type: String, required: true },
    code: { type: String, required: true },
    passed: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ['PASSED', 'PARTIAL', 'FAILED'], required: true },
    results: [{ passed: Boolean, got: String, error: String }],
    trainerNote: { type: String, default: '' },
  },
  { timestamps: true }
);
export const CodingSubmission = mongoose.model<ICodingSubmission>('CodingSubmission', CodingSubmissionSchema);

// A timed coding test made from Technical Practice questions, opened by a shareable link (/coding-test/<token>)
export interface ICodingTest extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  token: string;
  folderId: mongoose.Types.ObjectId;
  questionIds: mongoose.Types.ObjectId[];
  durationMinutes: number;
  examId?: mongoose.Types.ObjectId; // the LINK exam that lists it on the students' Exams page
  active: boolean;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
}

const CodingTestSchema = new Schema<ICodingTest>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    token: { type: String, required: true, unique: true },
    folderId: { type: Schema.Types.ObjectId, ref: 'CodingFolder', required: true },
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'CodingQuestion' }],
    durationMinutes: { type: Number, default: 60 },
    examId: { type: Schema.Types.ObjectId, ref: 'Exam' },
    active: { type: Boolean, default: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);
export const CodingTest = mongoose.model<ICodingTest>('CodingTest', CodingTestSchema);

export interface ICodingTestAttempt extends Document {
  _id: mongoose.Types.ObjectId;
  testId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  startedAt: Date;
  submittedAt?: Date;
  answers: { questionId: mongoose.Types.ObjectId; code: string; passed: number; total: number; savedAt: Date }[];
  score: number; // 0-100
  status: 'IN_PROGRESS' | 'SUBMITTED';
}

const CodingTestAttemptSchema = new Schema<ICodingTestAttempt>(
  {
    testId: { type: Schema.Types.ObjectId, ref: 'CodingTest', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    startedAt: { type: Date, required: true },
    submittedAt: { type: Date },
    answers: [{ questionId: Schema.Types.ObjectId, code: String, passed: Number, total: Number, savedAt: Date }],
    score: { type: Number, default: 0 },
    status: { type: String, enum: ['IN_PROGRESS', 'SUBMITTED'], default: 'IN_PROGRESS' },
  },
  { timestamps: true }
);
CodingTestAttemptSchema.index({ testId: 1, studentId: 1 }, { unique: true });
export const CodingTestAttempt = mongoose.model<ICodingTestAttempt>('CodingTestAttempt', CodingTestAttemptSchema);
