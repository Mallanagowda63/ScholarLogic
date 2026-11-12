import mongoose, { Schema, Document } from 'mongoose';

export interface IATSBreakdown {
  keywordMatch: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  projectRelevance: number;
}

export interface IResumeAnalysis extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  resumeId: mongoose.Types.ObjectId;
  jobDescriptionId?: mongoose.Types.ObjectId;
  atsScore: number;
  kind?: 'REVIEW' | 'JOB_MATCH'; // AI resume review (score out of 100) or match with a job description
  target?: string; // role reviewed for, or the job title (and company)
  resumeName?: string;
  breakdown: IATSBreakdown;
  matchedSkills: string[];
  missingSkills: string[];
  recommendedKeywords: string[];
  formattingIssues: string[];
  contentImprovements: string[];
  potentialConcerns: string[];
  analyzedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ResumeAnalysisSchema = new Schema<IResumeAnalysis>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true },
    jobDescriptionId: { type: Schema.Types.ObjectId, ref: 'JobDescription' },
    atsScore: { type: Number, required: true },
    kind: { type: String, enum: ['REVIEW', 'JOB_MATCH'], default: 'JOB_MATCH' },
    target: { type: String, default: '' },
    resumeName: { type: String, default: '' },
    breakdown: {
      keywordMatch: { type: Number, default: 80 },
      skillsMatch: { type: Number, default: 80 },
      experienceMatch: { type: Number, default: 80 },
      educationMatch: { type: Number, default: 90 },
      projectRelevance: { type: Number, default: 80 },
    },
    matchedSkills: [{ type: String }],
    missingSkills: [{ type: String }],
    recommendedKeywords: [{ type: String }],
    formattingIssues: [{ type: String }],
    contentImprovements: [{ type: String }],
    potentialConcerns: [{ type: String }],
    analyzedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const ResumeAnalysis = mongoose.model<IResumeAnalysis>('ResumeAnalysis', ResumeAnalysisSchema);
