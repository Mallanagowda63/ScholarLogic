import mongoose, { Schema, Document } from 'mongoose';

export interface ICertificate extends Document {
  _id: mongoose.Types.ObjectId;
  certificateId: string; // e.g. CERT-2026-78412
  studentId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  issueDate: Date;
  verificationUrl: string;
  certificatePdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CertificateSchema = new Schema<ICertificate>(
  {
    certificateId: { type: String, required: true, unique: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    issueDate: { type: Date, default: Date.now },
    verificationUrl: { type: String, required: true },
    certificatePdfUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Certificate = mongoose.model<ICertificate>('Certificate', CertificateSchema);

export function generateCertificateId(): string {
  const currentYear = new Date().getFullYear();
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `CERT-${currentYear}-${randomNum}`;
}
