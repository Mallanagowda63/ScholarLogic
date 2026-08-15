import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TRAINER' | 'PLACEMENT_MANAGER' | 'STUDENT';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  isVerified: boolean;
  refreshToken?: string;
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
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
