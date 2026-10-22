import mongoose, { Schema, Document } from 'mongoose';

// ---------- commands queued for the machine (delivered when it polls /iclock/getrequest) ----------

export type BiometricCommandKind = 'USER_UPSERT' | 'USER_QUERY';

// QUEUED: waiting for the machine to poll. SENT: handed to the machine, no answer yet.
// CONFIRMED / FAILED: the machine's own reply (Return code). CANCELLED: replaced before it was sent.
export type BiometricCommandStatus = 'QUEUED' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

export interface IBiometricCommand extends Document {
  _id: mongoose.Types.ObjectId;
  deviceSerial: string;
  commandId: number; // ID the machine echoes back in its reply
  kind: BiometricCommandKind;
  studentId?: mongoose.Types.ObjectId;
  biometricId: string;
  cardNumber: string;
  text: string; // command exactly as sent
  dedupeKey: string; // one live command per device + student + kind
  active?: boolean; // set while QUEUED or SENT; unset once finished
  status: BiometricCommandStatus;
  attempts: number;
  returnCode?: number;
  error: string;
  requestedBy?: mongoose.Types.ObjectId;
  sentAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BiometricCommandSchema = new Schema<IBiometricCommand>(
  {
    deviceSerial: { type: String, required: true },
    commandId: { type: Number, required: true, unique: true },
    kind: { type: String, enum: ['USER_UPSERT', 'USER_QUERY'], required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', index: true },
    biometricId: { type: String, required: true },
    cardNumber: { type: String, default: '' },
    text: { type: String, required: true },
    dedupeKey: { type: String, required: true },
    active: { type: Boolean },
    status: { type: String, enum: ['QUEUED', 'SENT', 'CONFIRMED', 'FAILED', 'CANCELLED'], default: 'QUEUED' },
    attempts: { type: Number, default: 0 },
    returnCode: { type: Number },
    error: { type: String, default: '' },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sentAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// Pushing the same student again while a command is still live must not create a second one
BiometricCommandSchema.index({ dedupeKey: 1 }, { unique: true, partialFilterExpression: { active: true } });
BiometricCommandSchema.index({ deviceSerial: 1, status: 1 });

export const BiometricCommand = mongoose.model<IBiometricCommand>('BiometricCommand', BiometricCommandSchema);

// ---------- users as the machine itself reports them (OPERLOG / USERINFO uploads) ----------

export interface IBiometricDeviceUser extends Document {
  deviceSerial: string;
  pin: string;
  name: string;
  card: string; // exactly as the machine reported it
  privilege: string;
  rawLine: string;
  reportedAt: Date;
}

const BiometricDeviceUserSchema = new Schema<IBiometricDeviceUser>({
  deviceSerial: { type: String, required: true },
  pin: { type: String, required: true },
  name: { type: String, default: '' },
  card: { type: String, default: '' },
  privilege: { type: String, default: '' },
  rawLine: { type: String, default: '' },
  reportedAt: { type: Date, default: Date.now },
});

BiometricDeviceUserSchema.index({ deviceSerial: 1, pin: 1 }, { unique: true });

export const BiometricDeviceUser = mongoose.model<IBiometricDeviceUser>('BiometricDeviceUser', BiometricDeviceUserSchema);

// ---------- sync / error log ----------

export type BiometricLogKind = 'ATTLOG' | 'USERS' | 'COMMAND' | 'PUSH' | 'IMPORT' | 'EXPORT' | 'E_NUMBER' | 'DEVICE';

export interface IBiometricSyncLog extends Document {
  deviceSerial: string;
  kind: BiometricLogKind;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const BiometricSyncLogSchema = new Schema<IBiometricSyncLog>(
  {
    deviceSerial: { type: String, default: '' },
    kind: { type: String, required: true },
    level: { type: String, enum: ['INFO', 'WARN', 'ERROR'], default: 'INFO', index: true },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Keep 90 days of history
BiometricSyncLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 86400 });

export const BiometricSyncLog = mongoose.model<IBiometricSyncLog>('BiometricSyncLog', BiometricSyncLogSchema);

// ---------- eSSL master sheet settings (single document) ----------

export interface IBiometricSettings extends Document {
  key: string;
  // Used on export when a student has no value of their own
  defaults: { company: string; department: string; designation: string; applyType: string };
  applyTypeAllowed: string[]; // empty = allowed values not confirmed yet, any non-blank value passes with a warning
  templateHeaders: string[]; // header row of the last eSSL file imported; export reproduces it
  templateSheetName: string;
}

const BiometricSettingsSchema = new Schema<IBiometricSettings>(
  {
    key: { type: String, required: true, unique: true },
    defaults: {
      company: { type: String, default: '' },
      department: { type: String, default: '' },
      designation: { type: String, default: '' },
      applyType: { type: String, default: '' },
    },
    applyTypeAllowed: { type: [String], default: [] },
    templateHeaders: { type: [String], default: [] },
    templateSheetName: { type: String, default: '' },
  },
  { timestamps: true }
);

export const BiometricSettings = mongoose.model<IBiometricSettings>('BiometricSettings', BiometricSettingsSchema);
