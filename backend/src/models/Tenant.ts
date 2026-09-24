import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  subdomain: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true },
    subdomain: { type: String, required: true, unique: true, index: true },
    logoUrl: { type: String, default: '' },
    primaryColor: { type: String, default: '#4f46e5' },
    customDomain: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const Tenant = mongoose.model<ITenant>('Tenant', TenantSchema);
