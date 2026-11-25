import mongoose, { Schema, Document } from 'mongoose';

// A photo a student attached to a Google Form (registration or ID card form). The file sits in the form owner's
// private Google Drive, so the server fetches it through the form's Apps Script and keeps a copy here.
// Served at /api/form-photos/<driveId>; that URL is what the admin pages and the student profile use.
export interface IFormPhoto extends Document {
  driveId: string;
  source: string; // REGISTRATION | STUDENT_INFO | NEW_STUDENT
  data?: Buffer;
  type?: string;
  size: number;
  fetchedAt?: Date;
  tries: number;
  error: string;
}

const FormPhotoSchema = new Schema<IFormPhoto>(
  {
    driveId: { type: String, required: true, unique: true },
    source: { type: String, required: true },
    data: { type: Buffer },
    type: { type: String },
    size: { type: Number, default: 0 },
    fetchedAt: { type: Date },
    tries: { type: Number, default: 0 },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

export const FormPhoto = mongoose.model<IFormPhoto>('FormPhoto', FormPhotoSchema);
