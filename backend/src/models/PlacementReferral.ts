import mongoose, { Schema, Document } from 'mongoose';

export type ReferralStatus = 'NEW' | 'IN_PROGRESS' | 'PLACED' | 'CLOSED';
export const OPEN_REFERRAL_STATUSES: ReferralStatus[] = ['NEW', 'IN_PROGRESS'];

// A trainer recommends a student to the placement team ("push to placement").
// One open referral per student; once placed or closed, a trainer can push them again.
export interface IPlacementReferral extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId; // TrackCourse at the time of the push
  courseName: string; // kept so the placement list still groups correctly if the course changes
  pushedById: mongoose.Types.ObjectId;
  note: string; // trainer's note, e.g. strengths or readiness
  status: ReferralStatus;
  placementNote: string;
  handledById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlacementReferralSchema = new Schema<IPlacementReferral>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'TrackCourse' },
    courseName: { type: String, default: '' },
    pushedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: ['NEW', 'IN_PROGRESS', 'PLACED', 'CLOSED'], default: 'NEW', index: true },
    placementNote: { type: String, default: '', maxlength: 1000 },
    handledById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const PlacementReferral = mongoose.model<IPlacementReferral>('PlacementReferral', PlacementReferralSchema);
