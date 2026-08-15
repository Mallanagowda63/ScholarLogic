import mongoose, { Schema, Document } from 'mongoose';

export interface IProject {
  title: string;
  description: string;
  technologies: string[];
  link?: string;
}

export interface ICertification {
  name: string;
  issuer: string;
  issueDate?: string;
  credentialId?: string;
}

export interface IStudent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  studentId: string; // Permanent format: SL-2026-00001
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  location?: string;
  college: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
  tenthPercentage?: number;
  twelfthPercentage?: number;
  skills: string[];
  projects: IProject[];
  certifications: ICertification[];
  githubUrl?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  preferredRole?: string;
  preferredLocation?: string;
  batch: string;
  enrollmentDate: Date;
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    studentId: { type: String, required: true, unique: true, index: true },
    phone: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    college: { type: String, default: 'ScholarLogic Institute of Technology' },
    degree: { type: String, default: 'B.Tech' },
    branch: { type: String, default: 'Computer Science & Engineering' },
    graduationYear: { type: Number, default: 2026 },
    cgpa: { type: Number, default: 8.5 },
    tenthPercentage: { type: Number, default: 90 },
    twelfthPercentage: { type: Number, default: 88 },
    skills: { type: [String], default: ['Python', 'JavaScript', 'SQL', 'React', 'Git'] },
    projects: [
      {
        title: String,
        description: String,
        technologies: [String],
        link: String,
      },
    ],
    certifications: [
      {
        name: String,
        issuer: String,
        issueDate: String,
        credentialId: String,
      },
    ],
    githubUrl: { type: String, default: '' },
    linkedInUrl: { type: String, default: '' },
    portfolioUrl: { type: String, default: '' },
    preferredRole: { type: String, default: 'Full Stack Web Developer' },
    preferredLocation: { type: String, default: 'Bangalore / Remote' },
    batch: { type: String, default: 'Batch 2026' },
    enrollmentDate: { type: Date, default: Date.now },
    accountStatus: { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const Student = mongoose.model<IStudent>('Student', StudentSchema);
