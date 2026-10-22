import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TRAINER' | 'PLACEMENT_MANAGER' | 'STUDENT';

export interface IStaffProfile {
  phone: string;
  designation: string;
  department: string;
  specialization: string;
  experience: string;
  bio: string;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  isVerified: boolean;
  refreshToken?: string;
  profile?: IStaffProfile; // staff edit these themselves on My Profile (never email, password or role)
  isActive: boolean; // false = access removed by an admin; login and existing sessions are refused
  passwordChangedAt?: Date; // sessions issued before this are no longer accepted
  createdById?: mongoose.Types.ObjectId; // admin who created a staff account
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'TRAINER', 'PLACEMENT_MANAGER', 'STUDENT'],
      default: 'STUDENT',
      required: true,
    },
    avatarUrl: { type: String, default: '' },
    isVerified: { type: Boolean, default: true },
    refreshToken: { type: String },
    profile: {
      phone: { type: String, default: '', trim: true, maxlength: 20 },
      designation: { type: String, default: '', trim: true, maxlength: 80 },
      department: { type: String, default: '', trim: true, maxlength: 80 },
      specialization: { type: String, default: '', trim: true, maxlength: 120 },
      experience: { type: String, default: '', trim: true, maxlength: 40 },
      bio: { type: String, default: '', trim: true, maxlength: 600 },
    },
    isActive: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
    createdById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
