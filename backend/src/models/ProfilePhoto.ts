import mongoose, { Schema, Document } from 'mongoose';

// A user's profile photo, kept in the database (one per user) and served at /api/auth/photo/<userId>.
// User.avatarUrl points there with a version so a new photo replaces the cached one.
export interface IProfilePhoto extends Document {
  userId: mongoose.Types.ObjectId;
  data: Buffer;
  type: string;
  size: number;
  updatedAt: Date;
}

const ProfilePhotoSchema = new Schema<IProfilePhoto>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    data: { type: Buffer, required: true },
    type: { type: String, required: true },
    size: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

export const ProfilePhoto = mongoose.model<IProfilePhoto>('ProfilePhoto', ProfilePhotoSchema);
