import mongoose, { Schema, Document } from 'mongoose';

export type ResumeTemplate = 'CLASSIC' | 'MODERN' | 'TECHNICAL' | 'MINIMAL';

export interface IResumeExperience {
  company: string;
  role: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description: string;
  highlights?: string[];
}

export interface IResumeEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  grade?: string;
}

export interface IResumeProject {
  title: string;
  description: string;
  technologies: string[];
  link?: string;
}

export interface IResumeData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedInUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  summary: string;
  skills: string[];
  experience: IResumeExperience[];
  education: IResumeEducation[];
  projects: IResumeProject[];
  certifications: string[];
}

export interface IResume extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  title: string;
  versionName: string;
  template: ResumeTemplate;
  data: IResumeData;
  pdfUrl?: string;
  isDefault: boolean;
  rawText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ResumeSchema = new Schema<IResume>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    title: { type: String, required: true, default: 'My Resume' },
    versionName: { type: String, required: true, default: 'Primary Version' },
    template: {
      type: String,
      enum: ['CLASSIC', 'MODERN', 'TECHNICAL', 'MINIMAL'],
      default: 'MODERN',
    },
    data: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, default: '' },
      location: { type: String, default: '' },
      linkedInUrl: { type: String, default: '' },
      githubUrl: { type: String, default: '' },
      portfolioUrl: { type: String, default: '' },
      summary: { type: String, default: '' },
      skills: [{ type: String }],
      experience: [
        {
          company: String,
          role: String,
          startDate: String,
          endDate: String,
          current: Boolean,
          description: String,
          highlights: [String],
        },
      ],
      education: [
        {
          institution: String,
          degree: String,
          fieldOfStudy: String,
          startDate: String,
          endDate: String,
          grade: String,
        },
      ],
      projects: [
        {
          title: String,
          description: String,
          technologies: [String],
          link: String,
        },
      ],
      certifications: [{ type: String }],
    },
    pdfUrl: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    rawText: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Resume = mongoose.model<IResume>('Resume', ResumeSchema);
