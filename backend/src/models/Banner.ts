import mongoose, { Schema, Document } from 'mongoose';

// A slide in the student dashboard carousel (e.g. a placement success banner). The image itself is kept
// in the database with the banner and served from imageUrl (/api/banners/<id>/image?v=<version>), so
// deleting the banner deletes the image too.
export interface IBanner extends Document {
  _id: mongoose.Types.ObjectId;
  title: string; // what the banner says, also used as the image's alt text
  imageUrl: string;
  imageData: Buffer; // not selected by default; only the image route reads it
  imageType: string;
  imageSize: number;
  sortOrder: number;
  isActive: boolean;
  createdById?: mongoose.Types.ObjectId;
  updatedById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    imageUrl: { type: String, required: true },
    imageData: { type: Buffer, required: true, select: false },
    imageType: { type: String, required: true },
    imageSize: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Banner = mongoose.model<IBanner>('Banner', BannerSchema);
