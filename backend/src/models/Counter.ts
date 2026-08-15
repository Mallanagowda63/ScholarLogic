import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  name: string;
  year: number;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  name: { type: String, required: true, unique: true },
  year: { type: Number, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);

export async function getNextStudentId(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const counterName = `student_id_${currentYear}`;
  
  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 }, $setOnInsert: { year: currentYear } },
    { new: true, upsert: true }
  );

  const seqFormatted = String(counter.seq).padStart(5, '0');
  return `SL-${currentYear}-${seqFormatted}`;
}
