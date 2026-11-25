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

export const E_NUMBER_COUNTER = 'essl_e_number';

/**
 * Next value of the E Number sequence. The counter only ever moves forward (atomic $inc), so a
 * number is never handed out twice, even to concurrent requests or after a student is deleted.
 * `floor` seeds the counter the first time and lifts it past numbers assigned by hand or imported.
 */
export async function nextENumberSeq(floor = 0): Promise<number> {
  await raiseENumberSeq(floor);
  const counter = await Counter.findOneAndUpdate({ name: E_NUMBER_COUNTER }, { $inc: { seq: 1 } }, { new: true });
  return counter!.seq;
}

/** Lifts the E Number counter to at least `floor` (creating it if needed); never lowers it. */
export async function raiseENumberSeq(floor: number): Promise<void> {
  try {
    await Counter.updateOne({ name: E_NUMBER_COUNTER }, { $setOnInsert: { year: 0 }, $max: { seq: floor } }, { upsert: true });
  } catch (err: any) {
    // Two first-time callers raced on the upsert; the counter exists now
    if (err?.code !== 11000) throw err;
    await Counter.updateOne({ name: E_NUMBER_COUNTER }, { $max: { seq: floor } });
  }
}

export async function getNextStudentId(session?: mongoose.ClientSession): Promise<string> {
  const currentYear = new Date().getFullYear();
  const counterName = `student_id_${currentYear}`;

  const counter = await Counter.findOneAndUpdate(
    { name: counterName },
    { $inc: { seq: 1 }, $setOnInsert: { year: currentYear } },
    { new: true, upsert: true, session }
  );

  const seqFormatted = String(counter.seq).padStart(5, '0');
  return `SL-${currentYear}-${seqFormatted}`;
}
