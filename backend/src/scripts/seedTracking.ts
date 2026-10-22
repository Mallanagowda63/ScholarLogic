import { User } from '../models/User';
import { Subject } from '../models/tracking/Subject';
import { TrackCourse } from '../models/tracking/TrackCourse';
import { Batch } from '../models/tracking/Batch';

const PYTHON_TOPICS = [
  'Introduction', 'Installation & Setup', 'Variables', 'Data Types', 'Operators',
  'Input & Output', 'Conditions', 'Loops', 'Functions', 'Lists',
  'Tuples', 'Sets', 'Dictionaries', 'Strings', 'File Handling',
  'Exception Handling', 'Modules & Packages', 'OOP Basics', 'NumPy Intro', 'Pandas Intro',
];

const POWER_BI_TOPICS = ['Introduction', 'Connecting Data', 'Power Query', 'Data Modeling', 'DAX Basics', 'Visuals', 'Dashboards', 'Publishing'];

/**
 * MVP sample data for the batch-tracking module: 1 course, Python + Power BI subjects,
 * two Python batches. Idempotent — does nothing if the Python subject already exists.
 */
export async function seedTracking(): Promise<void> {
  if (await Subject.exists({ code: 'PY' })) return;

  const python = await Subject.create({
    name: 'Python',
    code: 'PY',
    expectedDurationDays: 30,
    topics: PYTHON_TOPICS.map((title, i) => ({ title, order: i + 1 })),
  });
  const powerBi = await Subject.create({
    name: 'Power BI',
    code: 'PBI',
    expectedDurationDays: 20,
    topics: POWER_BI_TOPICS.map((title, i) => ({ title, order: i + 1 })),
  });

  await TrackCourse.create({
    name: 'Data Analytics',
    code: 'DA',
    durationMonths: 6,
    subjects: [
      { subjectId: python._id, order: 1, expectedDurationDays: 30 },
      { subjectId: powerBi._id, order: 2, expectedDurationDays: 20 },
    ],
  });

  const trainer = await User.findOne({ role: 'TRAINER' }).sort({ createdAt: 1 });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = 86400000;

  await Batch.create([
    {
      batchCode: 'PY-B01',
      subjectId: python._id,
      trainerId: trainer?._id,
      mode: 'OFFLINE',
      timing: '7-8 AM',
      startDate: new Date(today.getTime() - 7 * day),
      expectedEndDate: new Date(today.getTime() + 23 * day),
      capacity: 25,
      status: 'RUNNING',
      history: [{ at: new Date(), action: 'CREATED', details: 'Python • 7-8 AM (sample data)' }],
    },
    {
      batchCode: 'PY-B02',
      subjectId: python._id,
      trainerId: trainer?._id,
      mode: 'ONLINE',
      timing: '10-11 AM',
      startDate: today,
      expectedEndDate: new Date(today.getTime() + 30 * day),
      capacity: 25,
      status: 'RUNNING',
      history: [{ at: new Date(), action: 'CREATED', details: 'Python • 10-11 AM (sample data)' }],
    },
  ]);
  console.log('🌱 Seeded batch-tracking sample data (Data Analytics, PY-B01, PY-B02)');
}

// Allow `npm run seed:tracking` against the configured database
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { connectDB } = require('../config/db');
  connectDB()
    .then(seedTracking)
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
