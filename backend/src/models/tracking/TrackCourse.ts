import mongoose, { Schema, Document } from 'mongoose';

export interface ICourseSubject {
  subjectId: mongoose.Types.ObjectId;
  order: number;
  expectedDurationDays: number;
}

// A training program (e.g. Data Analytics) = ordered sequence of subjects.
// Separate from the LMS `Course` model, which holds video/notes content.
export interface ITrackCourse extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  durationMonths: number;
  subjects: ICourseSubject[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TrackCourseSchema = new Schema<ITrackCourse>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    durationMonths: { type: Number, default: 6 },
    subjects: [
      {
        subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
        order: { type: Number, required: true },
        expectedDurationDays: { type: Number, default: 30 },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const TrackCourse = mongoose.model<ITrackCourse>('TrackCourse', TrackCourseSchema);
