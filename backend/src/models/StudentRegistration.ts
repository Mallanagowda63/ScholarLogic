import mongoose, { Schema, Document } from 'mongoose';

export type RegistrationSource = 'GOOGLE_FORM' | 'MANUAL';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

// Intake record for a prospective student (e.g. from the Google Form). It becomes a real
// Student (with Student ID and login) only when an admin verifies it.
export interface IStudentRegistration extends Document {
  _id: mongoose.Types.ObjectId;
  source: RegistrationSource;
  fullName: string;
  email: string;
  phone: string;
  phoneNormalized: string;
  address: string;
  requestedCourse: string; // raw value from the form
  courseId?: mongoose.Types.ObjectId; // mapped TrackCourse, if recognised
  preferredModeRaw: string;
  preferredMode?: 'ONLINE' | 'OFFLINE';
  preferredTiming: string; // preference only; never auto-allocated
  joiningDate?: Date;
  comments: string;
  // Education / personal answers from the form, kept as typed (copied onto the Student on verify)
  dateOfBirth: string; // yyyy-MM-dd
  tenthPercentage: string;
  twelfthPercentage: string;
  degree: string;
  degreeStream: string;
  degreePercentage: string;
  passOutYear: string;
  college: string;
  photoUrl: string; // Google Drive link of the uploaded photo
  submittedByEmail: string; // Google account the form was filled from (may differ from the student's email)
  mappingWarnings: string[];
  submittedAt: Date; // first submission time from Google
  lastSubmittedAt: Date;
  submissionCount: number;
  verificationStatus: VerificationStatus;
  rejectionReason: string;
  verifiedAt?: Date;
  verifiedById?: mongoose.Types.ObjectId;
  studentId?: mongoose.Types.ObjectId; // Student created on verification
  createdAt: Date;
  updatedAt: Date;
}

const StudentRegistrationSchema = new Schema<IStudentRegistration>(
  {
    source: { type: String, enum: ['GOOGLE_FORM', 'MANUAL'], default: 'GOOGLE_FORM', index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, default: '', lowercase: true, trim: true, index: true },
    phone: { type: String, default: '' },
    phoneNormalized: { type: String, default: '', index: true },
    address: { type: String, default: '' },
    requestedCourse: { type: String, default: '' },
    courseId: { type: Schema.Types.ObjectId, ref: 'TrackCourse' },
    preferredModeRaw: { type: String, default: '' },
    preferredMode: { type: String, enum: ['ONLINE', 'OFFLINE'] },
    preferredTiming: { type: String, default: '' },
    joiningDate: { type: Date },
    comments: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    tenthPercentage: { type: String, default: '' },
    twelfthPercentage: { type: String, default: '' },
    degree: { type: String, default: '' },
    degreeStream: { type: String, default: '' },
    degreePercentage: { type: String, default: '' },
    passOutYear: { type: String, default: '' },
    college: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    submittedByEmail: { type: String, default: '', lowercase: true, trim: true },
    mappingWarnings: [{ type: String }],
    submittedAt: { type: Date, required: true },
    lastSubmittedAt: { type: Date, required: true },
    submissionCount: { type: Number, default: 1 },
    verificationStatus: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING', index: true },
    rejectionReason: { type: String, default: '' },
    verifiedAt: { type: Date },
    verifiedById: { type: Schema.Types.ObjectId, ref: 'User' },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student' },
  },
  { timestamps: true }
);

export const StudentRegistration = mongoose.model<IStudentRegistration>('StudentRegistration', StudentRegistrationSchema);
