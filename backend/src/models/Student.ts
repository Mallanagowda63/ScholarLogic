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

export interface IExperience {
  company: string;
  role: string;
  startDate?: string;
  endDate?: string;
  currentlyWorking?: boolean;
  description?: string;
}

// Columns of the eSSL master sheet that ScholarLogic has no field of its own for
export interface IEsslProfile {
  company: string;
  department: string;
  designation: string;
  applyType: string;
}

export type TrainingStatus = 'ACTIVE' | 'ON_HOLD' | 'DROPPED' | 'REJOINED';

// Batch-tracking enrollment: which program the student is in and how they attend
export interface IEnrollment {
  courseId?: mongoose.Types.ObjectId; // TrackCourse
  joiningDate?: Date;
  mode: 'ONLINE' | 'OFFLINE';
  preferredTiming: string;
  status: TrainingStatus;
  remarks: string;
}

export interface IStatusHistoryEntry {
  status: TrainingStatus;
  date: Date;
  reason: string;
  remarks: string;
  completedSubjectIds: mongoose.Types.ObjectId[];
  pendingSubjectIds: mongoose.Types.ObjectId[];
  byUserId?: mongoose.Types.ObjectId;
}

export interface IModeHistoryEntry {
  mode: 'ONLINE' | 'OFFLINE';
  from: Date;
  to?: Date;
  reason: string;
  byUserId?: mongoose.Types.ObjectId;
}

export interface IStudent extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  studentId: string; // Permanent format: SL-2026-00001
  biometricId?: string; // E Number: the User ID the student is enrolled under on the eSSL machine. Punches match on this only
  cardNumber?: string; // RFID card linked to the same Biometric ID (digits, no leading zeros)
  loginPassword?: string; // password the admin handed out, encrypted (utils/credentialVault); shown on Admin → Students
  classRecords?: { course: string; batchMonth?: string; note?: string; subjects: { name: string; status: string }[]; source?: string; importedAt?: Date }[]; // office class sheet, as written there
  essl?: IEsslProfile;
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
  experiences: IExperience[];
  githubUrl?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  preferredRole?: string;
  preferredLocation?: string;
  batch: string;
  enrollmentDate: Date;
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  enrollment?: IEnrollment;
  address?: string;
  registrationSource?: 'ADMIN' | 'GOOGLE_FORM' | 'SELF_SIGNUP';
  registrationId?: mongoose.Types.ObjectId;
  statusHistory: IStatusHistoryEntry[];
  modeHistory: IModeHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    studentId: { type: String, required: true, unique: true, index: true },
    biometricId: { type: String, trim: true, unique: true, sparse: true },
    cardNumber: { type: String, trim: true, unique: true, sparse: true },
    loginPassword: { type: String, select: false },
    classRecords: [
      {
        _id: false,
        course: { type: String, required: true },
        batchMonth: { type: String, default: '' },
        note: { type: String, default: '' },
        subjects: [{ _id: false, name: String, status: String }],
        source: { type: String, default: '' },
        importedAt: { type: Date },
      },
    ],
    essl: {
      company: { type: String, default: '' },
      department: { type: String, default: '' },
      designation: { type: String, default: '' },
      applyType: { type: String, default: '' },
    },
    phone: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    college: { type: String, default: '' },
    degree: { type: String, default: 'B.Tech' },
    branch: { type: String, default: '' },
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
    experiences: [
      {
        company: String,
        role: String,
        startDate: String,
        endDate: String,
        currentlyWorking: { type: Boolean, default: false },
        description: String,
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
    enrollment: {
      courseId: { type: Schema.Types.ObjectId, ref: 'TrackCourse', index: true },
      joiningDate: { type: Date },
      mode: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE' },
      preferredTiming: { type: String, default: '' },
      status: { type: String, enum: ['ACTIVE', 'ON_HOLD', 'DROPPED', 'REJOINED'], default: 'ACTIVE' },
      remarks: { type: String, default: '' },
    },
    address: { type: String, default: '' },
    // How the student entered ScholarLogic; GOOGLE_FORM links back to the intake registration
    registrationSource: { type: String, enum: ['ADMIN', 'GOOGLE_FORM', 'SELF_SIGNUP'] },
    registrationId: { type: Schema.Types.ObjectId, ref: 'StudentRegistration' },
    // Append-only histories; never rewrite past entries
    statusHistory: [
      {
        status: { type: String, enum: ['ACTIVE', 'ON_HOLD', 'DROPPED', 'REJOINED'] },
        date: { type: Date, default: Date.now },
        reason: { type: String, default: '' },
        remarks: { type: String, default: '' },
        completedSubjectIds: [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
        pendingSubjectIds: [{ type: Schema.Types.ObjectId, ref: 'Subject' }],
        byUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    modeHistory: [
      {
        mode: { type: String, enum: ['ONLINE', 'OFFLINE'] },
        from: { type: Date, default: Date.now },
        to: { type: Date },
        reason: { type: String, default: '' },
        byUserId: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

export const Student = mongoose.model<IStudent>('Student', StudentSchema);
