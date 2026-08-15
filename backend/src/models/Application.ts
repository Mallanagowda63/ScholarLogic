import mongoose, { Schema, Document } from 'mongoose';

export type ApplicationStatus =
  | 'APPLIED'
  | 'SHORTLISTED'
  | 'ASSESSMENT'
  | 'TECH_INTERVIEW'
  | 'HR_INTERVIEW'
  | 'SELECTED'
  | 'OFFERED'
  | 'JOINED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface IApplicationAnswer {
  question: string;
  answer: string;
}

export interface IApplicationDocument {
  name: string;
  url: string;
  type: string;
}

export interface IInterviewDetails {
  roundTitle: string;
  date: string;
  time: string;
  meetingLink: string;
  instructions: string;
}

export interface IApplication extends Document {
  _id: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  resumeId: mongoose.Types.ObjectId;
  appliedAt: Date;
  status: ApplicationStatus;
  placementRound: string;
  matchScore: number;
  coverLetter?: string;
  answers?: IApplicationAnswer[];
  selectedCertificates?: string[];
  documents?: IApplicationDocument[];
  interviewDetails?: IInterviewDetails;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema = new Schema<IApplication>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true },
    appliedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: [
        'APPLIED',
        'SHORTLISTED',
        'ASSESSMENT',
        'TECH_INTERVIEW',
        'HR_INTERVIEW',
        'SELECTED',
        'OFFERED',
        'JOINED',
        'REJECTED',
        'WITHDRAWN',
      ],
      default: 'APPLIED',
    },
    placementRound: { type: String, default: 'Initial Application' },
    matchScore: { type: Number, default: 85 },
    coverLetter: { type: String, default: '' },
    answers: [
      {
        question: { type: String },
        answer: { type: String },
      },
    ],
    selectedCertificates: [{ type: String }],
    documents: [
      {
        name: { type: String },
        url: { type: String },
        type: { type: String },
      },
    ],
    interviewDetails: {
      roundTitle: { type: String, default: '' },
      date: { type: String, default: '' },
      time: { type: String, default: '' },
      meetingLink: { type: String, default: '' },
      instructions: { type: String, default: '' },
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

ApplicationSchema.index({ jobId: 1, studentId: 1 }, { unique: true });

export const Application = mongoose.model<IApplication>('Application', ApplicationSchema);
