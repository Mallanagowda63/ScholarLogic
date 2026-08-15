import mongoose, { Schema, Document } from 'mongoose';

export interface IModule extends Document {
  _id: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const ModuleSchema = new Schema<IModule>(
  {
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    order: { type: Number, required: true, default: 1 },
  },
  { timestamps: true }
);

export const Module = mongoose.model<IModule>('Module', ModuleSchema);
