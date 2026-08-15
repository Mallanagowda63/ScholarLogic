import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource: string;
  metadata?: any;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  userEmail: { type: String, default: '' },
  userRole: { type: String, default: '' },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed },
  ipAddress: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
