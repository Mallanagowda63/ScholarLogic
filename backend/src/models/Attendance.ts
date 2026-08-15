import mongoose, { Schema, Document } from 'mongoose';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface IAttendanceRecord {
  studentId: mongoose.Types.ObjectId;
  status: AttendanceStatus;
  remarks?: string;
}

export interface IAttendance extends Document {
  _id: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  trainerId: mongoose.Types.ObjectId;
  sessionName: string;
  date: Date;
  records: IAttendanceRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    trainerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionName: { type: String, required: true, trim: true },
    date: { type: Date, required: true, default: Date.now },
    records: [
      {
        studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
        status: { type: String, enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'], default: 'PRESENT' },
        remarks: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
