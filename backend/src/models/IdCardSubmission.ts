import mongoose, { Schema, Document } from 'mongoose';

// One answer to the "Student info - ScholarLogic" Google Form, where students type the ID on their card.
// A matched student gets their login emailed automatically; anything doubtful waits for an admin.
export type IdCardStatus =
  | 'SENT' // login emailed
  | 'NEEDS_REVIEW' // no / unknown ID, or the name and phone don't match that student
  | 'EMAIL_FAILED' // matched, but the email could not be sent (retry from the admin page)
  | 'DUPLICATE' // the same student already got their login from an earlier answer
  | 'IGNORED' // an admin dismissed it
  | 'DELETED'; // an admin deleted it: hidden, but kept so the next form check doesn't import it again

export type IdCardFormKind = 'STUDENT_INFO' | 'NEW_STUDENT';

export interface IIdCardSubmission extends Document {
  _id: mongoose.Types.ObjectId;
  form: IdCardFormKind; // STUDENT_INFO = existing students get their login; NEW_STUDENT = a student is created with the next SCLR code
  externalSubmissionId: string;
  submittedAt: Date;
  name: string;
  phone: string;
  email: string;
  course: string;
  education: string;
  idCardRaw: string; // as typed, e.g. "sclr207" or "NA didn't receive id"
  idCardCode: string; // normalised, e.g. SCLR207 ('' when none could be read)
  idCardPicUrl: string;
  tenthPercentage: string;
  twelfthPercentage: string;
  answers: { question: string; answer: string }[];
  status: IdCardStatus;
  note: string; // why it needs review / what happened
  studentId?: mongoose.Types.ObjectId; // matched or admin-confirmed student
  loginId: string;
  emailedTo: string;
  emailedAt?: Date;
  reviewedById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IdCardSubmissionSchema = new Schema<IIdCardSubmission>(
  {
    externalSubmissionId: { type: String, required: true, unique: true },
    form: { type: String, enum: ['STUDENT_INFO', 'NEW_STUDENT'], default: 'STUDENT_INFO', index: true },
    submittedAt: { type: Date, required: true, index: true },
    name: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    course: { type: String, default: '', trim: true },
    education: { type: String, default: '', trim: true },
    idCardRaw: { type: String, default: '', trim: true },
    idCardCode: { type: String, default: '', trim: true, index: true },
    idCardPicUrl: { type: String, default: '', trim: true },
    tenthPercentage: { type: String, default: '', trim: true },
    twelfthPercentage: { type: String, default: '', trim: true },
    answers: [{ _id: false, question: String, answer: String }],
    status: { type: String, enum: ['SENT', 'NEEDS_REVIEW', 'EMAIL_FAILED', 'DUPLICATE', 'IGNORED', 'DELETED'], default: 'NEEDS_REVIEW', index: true },
    note: { type: String, default: '' },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', index: true },
    loginId: { type: String, default: '' },
    emailedTo: { type: String, default: '' },
    emailedAt: { type: Date },
    reviewedById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const IdCardSubmission = mongoose.model<IIdCardSubmission>('IdCardSubmission', IdCardSubmissionSchema);
