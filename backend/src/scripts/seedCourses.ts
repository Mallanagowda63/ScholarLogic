/**
 * Course catalogue for the batch-tracking module: Data Analytics, Cloud Computing and Python
 * Full Stack with their subjects and topic syllabus. No students, batches or trainers.
 *
 * Safe on the real database and safe to rerun: matched by course/subject code, existing
 * subjects keep their topics (so trainer progress stays valid) and nothing is deleted.
 *
 *   npm run seed:courses
 */
import { Subject } from '../models/tracking/Subject';
import { TrackCourse } from '../models/tracking/TrackCourse';
import { SUBJECTS, COURSES } from './seedTestData';

export async function seedCourses() {
  const created = { subjects: 0, courses: 0 };
  const subjectIds: Record<string, any> = {};

  for (const [code, s] of Object.entries(SUBJECTS)) {
    let doc = await Subject.findOne({ code });
    if (!doc) {
      doc = await Subject.create({
        code,
        name: s.name,
        expectedDurationDays: s.days,
        topics: s.topics.map((title, i) => ({ title, order: i + 1 })),
      });
      created.subjects += 1;
    }
    subjectIds[code] = doc._id;
  }

  for (const c of COURSES) {
    if (await TrackCourse.exists({ code: c.code })) continue;
    await TrackCourse.create({
      code: c.code,
      name: c.name,
      durationMonths: c.months,
      subjects: c.subjects.map((code, i) => ({ subjectId: subjectIds[code], order: i + 1, expectedDurationDays: SUBJECTS[code].days })),
    });
    created.courses += 1;
  }
  return created;
}

if (require.main === module) {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { connectDB } = require('../config/db');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mongoose = require('mongoose');
    await connectDB();
    const host = mongoose.connection.host;
    const result = await seedCourses();
    console.log(`📚 Course catalogue on ${host}: added ${result.courses} course(s), ${result.subjects} subject(s) (existing ones left unchanged)`);
    process.exit(0);
  })().catch((err) => {
    console.error('❌', err.message || err);
    process.exit(1);
  });
}
