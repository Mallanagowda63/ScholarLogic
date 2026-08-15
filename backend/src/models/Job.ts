import mongoose, { Schema, Document } from 'mongoose';

export type JobType = 'FULL_TIME' | 'INTERNSHIP' | 'CONTRACT';
export type JobStatus = 'OPEN' | 'CLOSED' | 'DRAFT';
export type PostingType = 'SCHOLARLOGIC_POSTING' | 'OFFICIAL_COMPANY_POSTING';

export interface IEligibilityCriteria {
  minCgpa: number;
  allowedBranches: string[];
  passoutYears: number[];
  minTenthPercentage?: number;
  minTwelfthPercentage?: number;
}

export interface IJob extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  companyId: mongoose.Types.ObjectId;
  description: string;
  type: JobType;
  postingType: PostingType;
  location: string;
  salaryPackage: string; // e.g. "12 - 15 LPA"
  experienceLevel: string; // e.g. "Fresher / 0-1 Years"
  requiredSkills: string[];
  eligibilityCriteria: IEligibilityCriteria;
  deadline: Date;
  openings: number;
  status: JobStatus;
  jdAttachmentUrl?: string;
  sourceUrl?: string;
  sourceType: 'OFFICIAL_CAREERS_PAGE' | 'SCHOLARLOGIC_INTERNAL';
  lastVerifiedAt?: Date;
  discoveredAt?: Date;
  createdById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: { type: String, required: true, trim: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    description: { type: String, required: true },
    type: { type: String, enum: ['FULL_TIME', 'INTERNSHIP', 'CONTRACT'], default: 'FULL_TIME' },
    postingType: {
      type: String,
      enum: ['SCHOLARLOGIC_POSTING', 'OFFICIAL_COMPANY_POSTING'],
      default: 'SCHOLARLOGIC_POSTING',
    },
    location: { type: String, required: true },
    salaryPackage: { type: String, required: true },
    experienceLevel: { type: String, default: 'Fresher' },
    requiredSkills: [{ type: String, required: true }],
    eligibilityCriteria: {
      minCgpa: { type: Number, default: 6.0 },
      allowedBranches: [{ type: String, default: 'Computer Science & Engineering' }],
      passoutYears: [{ type: Number, default: 2026 }],
      minTenthPercentage: { type: Number, default: 60 },
      minTwelfthPercentage: { type: Number, default: 60 },
    },
    deadline: { type: Date, required: true },
    openings: { type: Number, default: 5 },
    status: { type: String, enum: ['OPEN', 'CLOSED', 'DRAFT'], default: 'OPEN' },
    jdAttachmentUrl: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    sourceType: {
      type: String,
      enum: ['OFFICIAL_CAREERS_PAGE', 'SCHOLARLOGIC_INTERNAL'],
      default: 'SCHOLARLOGIC_INTERNAL',
    },
    lastVerifiedAt: { type: Date, default: Date.now },
    discoveredAt: { type: Date, default: Date.now },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Job = mongoose.model<IJob>('Job', JobSchema);
