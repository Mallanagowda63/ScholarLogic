import mongoose, { Schema, Document } from 'mongoose';

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface IOffer extends Document {
  _id: mongoose.Types.ObjectId;
  applicationId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  jobId: mongoose.Types.ObjectId;
  offerLetterUrl: string;
  packageAmount: string;
  joiningDate?: Date;
  status: OfferStatus;
  createdAt: Date;
  updatedAt: Date;
}

const OfferSchema = new Schema<IOffer>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, unique: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    offerLetterUrl: { type: String, default: '' },
    packageAmount: { type: String, required: true },
    joiningDate: { type: Date },
    status: { type: String, enum: ['PENDING', 'ACCEPTED', 'DECLINED'], default: 'PENDING' },
  },
  { timestamps: true }
);

export const Offer = mongoose.model<IOffer>('Offer', OfferSchema);
