import mongoose, { Schema, Document } from 'mongoose';

// What a trainer submits after each class; replaces the paper progress register
export interface ITrainerDailyUpdate extends Document {
  _id: mongoose.Types.ObjectId;
  batchId: mongoose.Types.ObjectId;
  trainerId: mongoose.Types.ObjectId;
  date: Date;
  classConducted: boolean;
  topicTaught: string;
  topicCompleted: boolean;
  completedTopicIds: mongoose.Types.ObjectId[];
  additionalTopic: string;
  nextTopic: string;
  remarks: string;
  attendanceId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TrainerDailyUpdateSchema = new Schema<ITrainerDailyUpdate>(
  {
    batchId: { type: Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    trainerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    classConducted: { type: Boolean, default: true },
    topicTaught: { type: String, default: '' },
    topicCompleted: { type: Boolean, default: false },
    completedTopicIds: [{ type: Schema.Types.ObjectId }],
    additionalTopic: { type: String, default: '' },
    nextTopic: { type: String, default: '' },
    remarks: { type: String, default: '' },
    attendanceId: { type: Schema.Types.ObjectId, ref: 'Attendance' },
  },
  { timestamps: true }
);

export const TrainerDailyUpdate = mongoose.model<ITrainerDailyUpdate>('TrainerDailyUpdate', TrainerDailyUpdateSchema);
