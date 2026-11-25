import mongoose, { Schema, Document } from 'mongoose';

// eSSL/ZKTeco attendance state codes (0 = check-in, 1 = check-out, 2/3 break, 4/5 overtime, 255 = unset)
export type PunchDirection = 'IN' | 'OUT' | 'UNKNOWN';

// Unlinked punches are never guessed onto a student: an unknown ID or a card registered to someone else
export type PunchReviewReason = 'UNKNOWN_ID' | 'ID_CONFLICT';

// One raw punch pushed by a biometric device. Stored as received; daily Present/Incomplete is derived on read.
export interface IBiometricPunch extends Document {
  _id: mongoose.Types.ObjectId;
  deviceSerial: string;
  userPin: string; // Biometric User ID enrolled on the device (= ScholarLogic Student ID)
  punchTime: Date; // UTC instant
  localDate: string; // YYYY-MM-DD in the device's local time
  localTime: string; // HH:mm:ss in the device's local time
  stateCode: number;
  direction: PunchDirection;
  verifyMode: number; // 1 = fingerprint, 15 = face, 4 = card, ...
  studentId?: mongoose.Types.ObjectId; // resolved Student, empty when the PIN matched nobody
  reviewReason?: PunchReviewReason; // why the punch is unlinked and waiting in the review queue
  reviewNote?: string;
  rawLine: string;
  createdAt: Date;
}

const BiometricPunchSchema = new Schema<IBiometricPunch>(
  {
    deviceSerial: { type: String, required: true },
    userPin: { type: String, required: true, index: true },
    punchTime: { type: Date, required: true },
    localDate: { type: String, required: true, index: true },
    localTime: { type: String, required: true },
    stateCode: { type: Number, default: 255 },
    direction: { type: String, enum: ['IN', 'OUT', 'UNKNOWN'], default: 'UNKNOWN' },
    verifyMode: { type: Number, default: 0 },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', index: true },
    reviewReason: { type: String, enum: ['UNKNOWN_ID', 'ID_CONFLICT'] },
    reviewNote: { type: String },
    rawLine: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Devices re-upload their whole log after a restart; this keeps each punch once
BiometricPunchSchema.index({ deviceSerial: 1, userPin: 1, punchTime: 1 }, { unique: true });
BiometricPunchSchema.index({ studentId: 1, localDate: 1 });

export const BiometricPunch = mongoose.model<IBiometricPunch>('BiometricPunch', BiometricPunchSchema);

// Last contact from each device, so admins can see whether the machine is online
export interface IBiometricDevice extends Document {
  serialNumber: string;
  lastSeenAt: Date;
  lastIp: string;
  lastPunchAt?: Date;
  totalPunches: number;
  attlogStamp: string; // last ATTLOG Stamp acknowledged, handed back on handshake so the device resumes there
  lastSyncAt?: Date; // last ATTLOG upload stored without error
  lastSyncReceived: number;
  lastSyncInserted: number;
  lastErrorAt?: Date;
  lastError: string;
  pushVersion: string; // "pushver" the firmware reports on handshake
  deviceInfo: string; // INFO string the firmware sends when polling (firmware, user/fingerprint/log counts, IP)
}

const BiometricDeviceSchema = new Schema<IBiometricDevice>(
  {
    serialNumber: { type: String, required: true, unique: true },
    lastSeenAt: { type: Date, default: Date.now },
    lastIp: { type: String, default: '' },
    lastPunchAt: { type: Date },
    totalPunches: { type: Number, default: 0 },
    attlogStamp: { type: String, default: '' },
    lastSyncAt: { type: Date },
    lastSyncReceived: { type: Number, default: 0 },
    lastSyncInserted: { type: Number, default: 0 },
    lastErrorAt: { type: Date },
    lastError: { type: String, default: '' },
    pushVersion: { type: String, default: '' },
    deviceInfo: { type: String, default: '' },
  },
  { timestamps: true }
);

export const BiometricDevice = mongoose.model<IBiometricDevice>('BiometricDevice', BiometricDeviceSchema);
