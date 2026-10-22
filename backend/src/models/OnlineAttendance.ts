import mongoose, { Schema, Document } from 'mongoose';

// Attendance for online students, marked by scanning the QR code on their dashboard.
// Kept separate from eSSL machine punches (BiometricPunch): one record per student per day.
export interface IOnlineAttendance extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  localDate: string; // YYYY-MM-DD in institute time (IST)
  checkedInAt: Date;
  topic: string; // class / topic the student attended, entered when scanning
  note: string;
  courseName: string;
  batchCodes: string[];
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

const OnlineAttendanceSchema = new Schema<IOnlineAttendance>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    localDate: { type: String, required: true, index: true },
    checkedInAt: { type: Date, required: true },
    topic: { type: String, required: true, trim: true, maxlength: 200 },
    note: { type: String, default: '', trim: true, maxlength: 500 },
    courseName: { type: String, default: '' },
    batchCodes: [{ type: String }],
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '', maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

OnlineAttendanceSchema.index({ studentId: 1, localDate: 1 }, { unique: true });

export const OnlineAttendance = mongoose.model<IOnlineAttendance>('OnlineAttendance', OnlineAttendanceSchema);
