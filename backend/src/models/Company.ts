import mongoose, { Schema, Document } from 'mongoose';

export type HiringStatus = 'HIRING_NOW' | 'ACTIVE' | 'NOT_CURRENTLY_VERIFIED' | 'CLOSED' | 'UNKNOWN';
export type VerificationStatus = 'VERIFIED' | 'PENDING' | 'FAILED';

export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  logoUrl?: string;
  website?: string;
  officialCareersUrl?: string;
  industry: string;
  description: string;
  location: string;
  headquarters?: string;
  contactEmail: string;
  contactPhone?: string;
  hiringStatus: HiringStatus;
  verificationStatus: VerificationStatus;
  lastVerifiedAt?: Date;
  sourceUrl?: string;
  sourceType: 'OFFICIAL_COMPANY_CAREERS' | 'SCHOLARLOGIC_INTERNAL';
  openPositionsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    logoUrl: { type: String, default: '' },
    website: { type: String, default: '' },
    officialCareersUrl: { type: String, default: '' },
    industry: { type: String, required: true, default: 'Information Technology' },
    description: { type: String, required: true },
    location: { type: String, required: true },
    headquarters: { type: String, default: '' },
    contactEmail: { type: String, required: true },
    contactPhone: { type: String, default: '' },
    hiringStatus: {
      type: String,
      enum: ['HIRING_NOW', 'ACTIVE', 'NOT_CURRENTLY_VERIFIED', 'CLOSED', 'UNKNOWN'],
      default: 'HIRING_NOW',
    },
    verificationStatus: {
      type: String,
      enum: ['VERIFIED', 'PENDING', 'FAILED'],
      default: 'VERIFIED',
    },
    lastVerifiedAt: { type: Date, default: Date.now },
    sourceUrl: { type: String, default: '' },
    sourceType: {
      type: String,
      enum: ['OFFICIAL_COMPANY_CAREERS', 'SCHOLARLOGIC_INTERNAL'],
      default: 'OFFICIAL_COMPANY_CAREERS',
    },
    openPositionsCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const Company = mongoose.model<ICompany>('Company', CompanySchema);
