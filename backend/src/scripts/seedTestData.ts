/**
 * DEVELOPMENT / TEST DATA ONLY — 20 dummy students with connected courses, subjects, batches,
 * trainers, allocations, trainer class updates, attendance and history.
 *
 * Safe to rerun: dummy records are matched by Student ID (DA-001…DA-020), trainer email and batch
 * code, and their tracking rows are rebuilt instead of duplicated.
 *
 * Runs automatically on the in-memory DB with `npm run dev:test`. Against a real database it
 * refuses to run unless ALLOW_TEST_SEED=true, and never when NODE_ENV=production.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { Attendance } from '../models/Attendance';
import { Subject } from '../models/tracking/Subject';
import { TrackCourse } from '../models/tracking/TrackCourse';
import { Batch } from '../models/tracking/Batch';
import { StudentBatchAllocation, AllocationStatus } from '../models/tracking/StudentBatchAllocation';
import { TrainerDailyUpdate } from '../models/tracking/TrainerDailyUpdate';
import { StudentTimeline, TimelineEventType } from '../models/tracking/StudentTimeline';
import { PLACEHOLDER_EMAIL_DOMAIN } from '../services/trackingService';

const DAY = 86400000;
const today = new Date();
today.setHours(0, 0, 0, 0);
/** Date `offset` days from today at the given hour */
const day = (offset: number, hour = 10) => new Date(today.getTime() + offset * DAY + hour * 3600000);

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const SUBJECTS: Record<string, { name: string; days: number; topics: string[] }> = {
  SQL: {
    name: 'SQL',
    days: 30,
    topics: ['Introduction to Databases', 'SELECT & FROM', 'WHERE Filters', 'ORDER BY & LIMIT', 'Aggregate Functions', 'GROUP BY', 'HAVING', 'INNER JOIN', 'LEFT & RIGHT JOIN', 'Self Join', 'Subqueries', 'CTEs', 'Window Functions', 'CASE Expressions', 'String Functions', 'Date Functions', 'Views', 'Indexes', 'Stored Procedures', 'Case Study'],
  },
  EX: {
    name: 'Excel',
    days: 25,
    topics: ['Excel Basics', 'Formatting', 'Formulas', 'Cell References', 'IF & Logical Functions', 'VLOOKUP / XLOOKUP', 'INDEX & MATCH', 'Text Functions', 'Date Functions', 'Sorting & Filtering', 'Conditional Formatting', 'Pivot Tables', 'Charts', 'Data Validation', 'Dashboard Project'],
  },
  PY: {
    name: 'Python',
    days: 45,
    topics: ['Introduction', 'Installation & Setup', 'Variables', 'Data Types', 'Operators', 'Input & Output', 'Conditions', 'Loops', 'Functions', 'Lists', 'Tuples', 'Sets', 'Dictionaries', 'Strings', 'List Comprehensions', 'File Handling', 'Exception Handling', 'Modules & Packages', 'OOP Basics', 'Inheritance', 'Iterators & Generators', 'Decorators', 'Virtual Environments', 'NumPy Basics', 'NumPy Arrays', 'Pandas Series', 'Pandas DataFrames', 'Data Cleaning', 'Matplotlib', 'Mini Project'],
  },
  PBI: {
    name: 'Power BI',
    days: 40,
    topics: ['Introduction to Power BI', 'Power BI Desktop', 'Connecting Data Sources', 'Power Query Basics', 'Data Transformation', 'Merging Queries', 'Data Modeling', 'Relationships', 'Star Schema', 'DAX Basics', 'Calculated Columns', 'Measures', 'CALCULATE', 'Time Intelligence', 'Bar & Line Charts', 'Tables & Matrix', 'Cards & KPIs', 'Slicers', 'Drill Through', 'Bookmarks', 'Row-Level Security', 'Publishing', 'Power BI Service', 'Scheduled Refresh', 'Dashboard Project'],
  },
  TAB: {
    name: 'Tableau',
    days: 35,
    topics: ['Introduction to Tableau', 'Connecting Data', 'Dimensions & Measures', 'Basic Charts', 'Filters', 'Sorting & Grouping', 'Sets', 'Parameters', 'Calculated Fields', 'Table Calculations', 'LOD Expressions', 'Maps', 'Dual Axis Charts', 'Dashboards', 'Actions', 'Stories', 'Formatting', 'Performance', 'Tableau Public', 'Capstone Project'],
  },
  LIN: {
    name: 'Linux',
    days: 30,
    topics: ['Linux Introduction', 'Installation', 'File System', 'Basic Commands', 'File Permissions', 'Users & Groups', 'Package Management', 'Processes', 'Services & systemd', 'Networking Commands', 'SSH', 'Shell Scripting Basics', 'Variables & Loops', 'Cron Jobs', 'Log Management', 'Disk Management', 'Troubleshooting', 'Practice Lab'],
  },
  AWS: {
    name: 'AWS',
    days: 35,
    topics: ['Cloud Concepts', 'AWS Global Infrastructure', 'IAM', 'EC2 Basics', 'EC2 Storage (EBS)', 'Security Groups', 'Elastic Load Balancing', 'Auto Scaling', 'S3', 'S3 Lifecycle', 'VPC', 'Subnets & Routing', 'RDS', 'DynamoDB', 'Route 53', 'CloudFront', 'Lambda', 'CloudWatch', 'CloudFormation', 'Billing & Pricing', 'Well-Architected Framework', 'Hands-on Project'],
  },
  NET: {
    name: 'Networking',
    days: 25,
    topics: ['Networking Basics', 'OSI Model', 'TCP/IP', 'IP Addressing', 'Subnetting', 'Routing', 'Switching', 'DNS', 'DHCP', 'NAT', 'Firewalls', 'VPN', 'Load Balancers', 'Troubleshooting', 'Lab'],
  },
  DEV: {
    name: 'DevOps',
    days: 35,
    topics: ['DevOps Introduction', 'Git Basics', 'Branching & Merging', 'CI/CD Concepts', 'Jenkins', 'Pipelines', 'Docker Basics', 'Dockerfiles', 'Docker Compose', 'Kubernetes Basics', 'Pods & Deployments', 'Services', 'Helm', 'Terraform Basics', 'Ansible', 'Monitoring', 'Prometheus', 'Grafana', 'DevSecOps', 'Capstone'],
  },
  HTML: {
    name: 'HTML/CSS',
    days: 25,
    topics: ['HTML Basics', 'Text & Links', 'Images & Media', 'Lists & Tables', 'Forms', 'Semantic HTML', 'CSS Basics', 'Selectors', 'Box Model', 'Flexbox', 'Grid', 'Responsive Design', 'Transitions', 'CSS Variables', 'Landing Page Project'],
  },
  JS: {
    name: 'JavaScript',
    days: 40,
    topics: ['JavaScript Introduction', 'Variables', 'Data Types', 'Operators', 'Conditionals', 'Loops', 'Functions', 'Arrow Functions', 'Arrays', 'Array Methods', 'Objects', 'Destructuring', 'Spread & Rest', 'Scope & Closures', 'this Keyword', 'DOM Basics', 'DOM Events', 'Forms & Validation', 'Local Storage', 'Promises', 'Async / Await', 'Fetch API', 'ES Modules', 'Error Handling', 'Project'],
  },
  REACT: {
    name: 'React',
    days: 35,
    topics: ['React Introduction', 'JSX', 'Components', 'Props', 'State', 'Events', 'Conditional Rendering', 'Lists & Keys', 'Forms', 'useEffect', 'Custom Hooks', 'Context API', 'React Router', 'API Calls', 'useReducer', 'Performance', 'Styling', 'Testing Basics', 'Deployment', 'Capstone Project'],
  },
};

export const COURSES = [
  { code: 'DA', name: 'Data Analytics', months: 6, subjects: ['SQL', 'EX', 'PY', 'PBI', 'TAB'] },
  { code: 'CC', name: 'Cloud Computing', months: 6, subjects: ['LIN', 'AWS', 'NET', 'PY', 'DEV'] },
  { code: 'PFS', name: 'Python Full Stack', months: 6, subjects: ['PY', 'SQL', 'HTML', 'JS', 'REACT'] },
];

const TRAINERS: Record<string, { name: string; email: string }> = {
  A: { name: 'Arvind Rao (Trainer A)', email: 'trainer.a@scholarlogic.test' },
  B: { name: 'Bhavana Iyer (Trainer B)', email: 'trainer.b@scholarlogic.test' },
  C: { name: 'Chetan Desai (Trainer C)', email: 'trainer.c@scholarlogic.test' },
  D: { name: 'Divya Menon (Trainer D)', email: 'trainer.d@scholarlogic.test' },
  E: { name: 'Eshwar Naidu (Trainer E)', email: 'trainer.e@scholarlogic.test' },
};

interface BatchPlan {
  code: string;
  subject: string;
  timing: string;
  mode: 'ONLINE' | 'OFFLINE';
  trainer: string;
  start: number;
  plannedEnd: number;
  actualEnd?: number;
  status: 'RUNNING' | 'UPCOMING' | 'COMPLETED';
  topicsDone: number; // -1 = all topics
  classes: number;
}

// JS-B01 is stored RUNNING with a past planned end, so it shows as DELAYED
const BATCHES: BatchPlan[] = [
  { code: 'SQL-B02', subject: 'SQL', timing: '11:00 AM - 12:00 PM', mode: 'ONLINE', trainer: 'B', start: -150, plannedEnd: -115, actualEnd: -115, status: 'COMPLETED', topicsDone: -1, classes: 26 },
  { code: 'EX-B01', subject: 'EX', timing: '8:00 AM - 9:00 AM', mode: 'OFFLINE', trainer: 'B', start: -110, plannedEnd: -85, actualEnd: -86, status: 'COMPLETED', topicsDone: -1, classes: 18 },
  { code: 'PY-B00', subject: 'PY', timing: '6:00 PM - 7:00 PM', mode: 'OFFLINE', trainer: 'A', start: -120, plannedEnd: -68, actualEnd: -65, status: 'COMPLETED', topicsDone: -1, classes: 40 },
  { code: 'HTML-B01', subject: 'HTML', timing: '4:00 PM - 5:00 PM', mode: 'OFFLINE', trainer: 'E', start: -95, plannedEnd: -70, actualEnd: -70, status: 'COMPLETED', topicsDone: -1, classes: 18 },
  { code: 'LIN-B01', subject: 'LIN', timing: '7:00 AM - 8:00 AM', mode: 'ONLINE', trainer: 'D', start: -70, plannedEnd: -38, actualEnd: -35, status: 'COMPLETED', topicsDone: -1, classes: 26 },
  { code: 'PY-B01', subject: 'PY', timing: '7:00 AM - 8:00 AM', mode: 'ONLINE', trainer: 'A', start: -40, plannedEnd: 12, status: 'RUNNING', topicsDone: 22, classes: 28 },
  { code: 'PY-B02', subject: 'PY', timing: '10:00 AM - 11:00 AM', mode: 'OFFLINE', trainer: 'A', start: -25, plannedEnd: 25, status: 'RUNNING', topicsDone: 15, classes: 18 },
  { code: 'SQL-B01', subject: 'SQL', timing: '9:00 AM - 10:00 AM', mode: 'OFFLINE', trainer: 'B', start: -30, plannedEnd: 6, status: 'RUNNING', topicsDone: 18, classes: 22 },
  { code: 'PBI-B01', subject: 'PBI', timing: '10:00 AM - 11:00 AM', mode: 'OFFLINE', trainer: 'C', start: -20, plannedEnd: 22, status: 'RUNNING', topicsDone: 10, classes: 14 },
  { code: 'TAB-B01', subject: 'TAB', timing: '11:00 AM - 12:00 PM', mode: 'OFFLINE', trainer: 'C', start: -22, plannedEnd: 14, status: 'RUNNING', topicsDone: 8, classes: 16 },
  { code: 'LIN-B02', subject: 'LIN', timing: '7:00 AM - 8:00 AM', mode: 'ONLINE', trainer: 'D', start: -24, plannedEnd: 8, status: 'RUNNING', topicsDone: 14, classes: 18 },
  { code: 'JS-B01', subject: 'JS', timing: '12:00 PM - 1:00 PM', mode: 'OFFLINE', trainer: 'E', start: -55, plannedEnd: -5, status: 'RUNNING', topicsDone: 9, classes: 20 },
  { code: 'PBI-B02', subject: 'PBI', timing: '12:00 PM - 1:00 PM', mode: 'ONLINE', trainer: 'C', start: 12, plannedEnd: 42, status: 'UPCOMING', topicsDone: 0, classes: 0 },
  { code: 'AWS-B01', subject: 'AWS', timing: '9:00 AM - 10:00 AM', mode: 'ONLINE', trainer: 'D', start: 7, plannedEnd: 40, status: 'UPCOMING', topicsDone: 0, classes: 0 },
  { code: 'DEV-B01', subject: 'DEV', timing: '10:00 AM - 11:00 AM', mode: 'ONLINE', trainer: 'D', start: 21, plannedEnd: 50, status: 'UPCOMING', topicsDone: 0, classes: 0 },
];

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

interface Rates {
  absent: number;
  late: number;
  excused: number;
}
const NORMAL: Rates = { absent: 0.08, late: 0.05, excused: 0.02 };
const POOR: Rates = { absent: 0.45, late: 0.08, excused: 0.02 };

interface AllocPlan {
  batch: string;
  status: AllocationStatus;
  from?: number; // default: later of batch start / joining
  to?: number; // default: batch actual end for COMPLETED, open otherwise
  allocatedAt?: number; // default: seat start (or 3 days before batch start)
  reason?: string;
  rates?: Rates;
}

interface StudentPlan {
  id: string;
  name: string;
  course: 'DA' | 'CC' | 'PFS';
  mode: 'ONLINE' | 'OFFLINE';
  join: number;
  timing: string;
  status: 'ACTIVE' | 'ON_HOLD' | 'DROPPED' | 'REJOINED';
  statusEvents?: { status: 'ON_HOLD' | 'DROPPED' | 'REJOINED'; at: number; reason: string }[];
  modeChange?: { at: number; reason: string }; // switched to `mode` from the other mode
  allocs: AllocPlan[];
}

const STUDENTS: StudentPlan[] = [
  { id: 'DA-001', name: 'Prabhas Reddy', course: 'DA', mode: 'ONLINE', join: -155, timing: '7-8 AM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'EX-B01', status: 'COMPLETED' }, { batch: 'PY-B01', status: 'ATTENDING' }, { batch: 'TAB-B01', status: 'ATTENDING', from: -15 }] },
  { id: 'DA-002', name: 'Balaji Kumar', course: 'DA', mode: 'OFFLINE', join: -155, timing: '10-11 AM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'EX-B01', status: 'COMPLETED' },
      { batch: 'PY-B01', status: 'MISSED', to: -20, reason: 'Timing issue — cannot attend the 7 AM batch', rates: { absent: 0.55, late: 0.05, excused: 0 } },
      { batch: 'PBI-B01', status: 'ATTENDING' }] },
  { id: 'DA-003', name: 'Mohit Sharma', course: 'DA', mode: 'ONLINE', join: -150, timing: '7-8 AM', status: 'ACTIVE',
    modeChange: { at: -12, reason: 'Relocated — switched to online classes' },
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'PY-B02', status: 'MOVED', to: -12, reason: 'Changed Offline → Online' }, { batch: 'PY-B01', status: 'ATTENDING', from: -12 }] },
  { id: 'DA-004', name: 'Rahul Patil', course: 'DA', mode: 'OFFLINE', join: -160, timing: '10-11 AM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'EX-B01', status: 'COMPLETED' }, { batch: 'PY-B00', status: 'COMPLETED' }, { batch: 'PBI-B01', status: 'ATTENDING', rates: POOR }] },
  { id: 'DA-005', name: 'Sneha Rao', course: 'DA', mode: 'OFFLINE', join: -32, timing: '9-10 AM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B01', status: 'ATTENDING' }] },
  { id: 'DA-006', name: 'Pooja Hegde', course: 'DA', mode: 'OFFLINE', join: -155, timing: '10-11 AM', status: 'ON_HOLD',
    statusEvents: [{ status: 'ON_HOLD', at: -8, reason: 'Health issue' }],
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'EX-B01', status: 'COMPLETED' }, { batch: 'PY-B02', status: 'ON_HOLD', to: -8, reason: 'Health issue' }] },
  { id: 'DA-007', name: 'Sanjay Kulkarni', course: 'DA', mode: 'OFFLINE', join: -150, timing: '6-7 PM', status: 'REJOINED',
    statusEvents: [{ status: 'ON_HOLD', at: -90, reason: 'Timing issue — job shift change' }, { status: 'REJOINED', at: -3, reason: 'Shift changed back, resuming the course' }],
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'EX-B01', status: 'COMPLETED' }, { batch: 'PY-B00', status: 'ON_HOLD', to: -90, reason: 'Timing issue — job shift change' }] },
  { id: 'DA-008', name: 'Deepak M', course: 'DA', mode: 'OFFLINE', join: -160, timing: '12-1 PM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'EX-B01', status: 'COMPLETED' }, { batch: 'PY-B00', status: 'COMPLETED' }] },
  { id: 'DA-009', name: 'Shreya Patil', course: 'DA', mode: 'OFFLINE', join: -35, timing: '9-10 AM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B01', status: 'MISSED', to: -15, reason: 'Student unavailable — university exams', rates: { absent: 0.5, late: 0.05, excused: 0.1 } }] },
  { id: 'DA-010', name: 'Harish Gowda', course: 'DA', mode: 'OFFLINE', join: -4, timing: '7-8 AM', status: 'ACTIVE', allocs: [] },
  { id: 'DA-011', name: 'Meghana S', course: 'DA', mode: 'OFFLINE', join: -150, timing: '8-9 AM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }] },
  { id: 'DA-012', name: 'Kavya Rao', course: 'DA', mode: 'ONLINE', join: -145, timing: '7-8 AM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'EX-B01', status: 'COMPLETED' }] },
  { id: 'DA-013', name: 'Nithya Gowda', course: 'CC', mode: 'ONLINE', join: -75, timing: '9-10 AM', status: 'ACTIVE',
    allocs: [{ batch: 'LIN-B01', status: 'COMPLETED' }, { batch: 'AWS-B01', status: 'BATCH_ALLOCATED', allocatedAt: -2 }] },
  { id: 'DA-014', name: 'Kiran Kumar', course: 'CC', mode: 'ONLINE', join: -26, timing: '7-8 AM', status: 'ACTIVE',
    allocs: [{ batch: 'LIN-B02', status: 'ATTENDING' }] },
  { id: 'DA-015', name: 'Akash Naik', course: 'CC', mode: 'ONLINE', join: -72, timing: '7-8 AM', status: 'DROPPED',
    statusEvents: [{ status: 'DROPPED', at: -50, reason: 'Personal issue — family relocation' }],
    allocs: [{ batch: 'LIN-B01', status: 'DROPPED', to: -50, reason: 'Personal issue' }] },
  { id: 'DA-016', name: 'Vinay K', course: 'CC', mode: 'ONLINE', join: -72, timing: '9-10 AM', status: 'ACTIVE',
    allocs: [{ batch: 'LIN-B01', status: 'COMPLETED' }] },
  { id: 'DA-017', name: 'Priya Shetty', course: 'PFS', mode: 'OFFLINE', join: -155, timing: '12-1 PM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'PY-B00', status: 'COMPLETED' }, { batch: 'HTML-B01', status: 'COMPLETED' }, { batch: 'JS-B01', status: 'ATTENDING' }] },
  { id: 'DA-018', name: 'Ananya R', course: 'PFS', mode: 'ONLINE', join: -150, timing: '12-1 PM', status: 'REJOINED',
    statusEvents: [{ status: 'DROPPED', at: -40, reason: 'Personal issue' }, { status: 'REJOINED', at: -2, reason: 'Back after a personal break' }],
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'PY-B00', status: 'COMPLETED' }, { batch: 'HTML-B01', status: 'COMPLETED' }, { batch: 'JS-B01', status: 'DROPPED', to: -40, reason: 'Personal issue' }] },
  { id: 'DA-019', name: 'Rohit Kumar', course: 'PFS', mode: 'OFFLINE', join: -150, timing: '12-1 PM', status: 'ON_HOLD',
    statusEvents: [{ status: 'ON_HOLD', at: -20, reason: 'Temporary break — internship' }],
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'PY-B00', status: 'COMPLETED' }, { batch: 'HTML-B01', status: 'COMPLETED' }, { batch: 'JS-B01', status: 'ON_HOLD', to: -20, reason: 'Temporary break' }] },
  { id: 'DA-020', name: 'Aishwarya M', course: 'PFS', mode: 'OFFLINE', join: -150, timing: '4-5 PM', status: 'ACTIVE',
    allocs: [{ batch: 'SQL-B02', status: 'COMPLETED' }, { batch: 'PY-B00', status: 'COMPLETED' }, { batch: 'HTML-B01', status: 'COMPLETED' }] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Deterministic PRNG so reruns produce the same attendance
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/** `count` teaching days (Mon–Sat) spread evenly between two day offsets, inclusive */
function classDays(fromOffset: number, toOffset: number, count: number): Date[] {
  const available: Date[] = [];
  for (let o = fromOffset; o <= toOffset; o++) {
    const d = day(o, 0);
    if (d.getDay() !== 0) available.push(d);
  }
  if (count >= available.length) return available;
  return Array.from({ length: count }, (_, i) => available[Math.floor((i * available.length) / count)]);
}

export function assertSafeToSeed(memoryDb: boolean) {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed dummy data: NODE_ENV=production');
  if (!memoryDb && process.env.ALLOW_TEST_SEED !== 'true') {
    throw new Error(
      'Refusing to seed dummy data into a real database. Use `npm run dev:test` (in-memory DB), ' +
        'or set ALLOW_TEST_SEED=true when pointing MONGODB_URI at a development database.'
    );
  }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function seedTestData(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const bump = (k: string, n = 1) => (counts[k] = (counts[k] || 0) + n);
  const passwordStudent = await bcrypt.hash('Student@123', 10);
  const passwordTrainer = await bcrypt.hash('Trainer@123', 10);
  const admin = await User.findOne({ role: { $in: ['SUPER_ADMIN', 'ADMIN'] } }).sort({ createdAt: 1 });
  const actor = { byUserId: admin?._id, byName: admin?.fullName || 'Admin' };

  // Subjects (upsert by code; topics replaced only if the syllabus length differs)
  const subjectIds: Record<string, mongoose.Types.ObjectId> = {};
  const subjectDocs: Record<string, any> = {};
  for (const [code, s] of Object.entries(SUBJECTS)) {
    let doc = await Subject.findOne({ code });
    if (!doc) doc = new Subject({ code });
    doc.name = s.name;
    doc.expectedDurationDays = s.days;
    if (doc.topics.length !== s.topics.length) doc.set('topics', s.topics.map((title, i) => ({ title, order: i + 1 })));
    await doc.save();
    subjectIds[code] = doc._id;
    subjectDocs[code] = doc;
    bump('subjects');
  }

  // Courses
  const courseIds: Record<string, mongoose.Types.ObjectId> = {};
  for (const c of COURSES) {
    const doc = await TrackCourse.findOneAndUpdate(
      { code: c.code },
      {
        name: c.name,
        durationMonths: c.months,
        isActive: true,
        subjects: c.subjects.map((code, i) => ({ subjectId: subjectIds[code], order: i + 1, expectedDurationDays: SUBJECTS[code].days })),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    courseIds[c.code] = doc!._id;
    bump('courses');
  }

  // Trainers
  const trainerIds: Record<string, mongoose.Types.ObjectId> = {};
  for (const [key, t] of Object.entries(TRAINERS)) {
    let user = await User.findOne({ email: t.email });
    if (!user) user = await User.create({ email: t.email, passwordHash: passwordTrainer, fullName: t.name, role: 'TRAINER' });
    else if (user.fullName !== t.name) await User.updateOne({ _id: user._id }, { fullName: t.name, role: 'TRAINER' });
    trainerIds[key] = user._id;
    bump('trainers');
  }

  // Batches (reset progress so reruns rebuild it)
  const batchDocs: Record<string, any> = {};
  for (const b of BATCHES) {
    const subject = subjectDocs[b.subject];
    const doc = await Batch.findOneAndUpdate(
      { batchCode: b.code },
      {
        subjectId: subject._id,
        trainerId: trainerIds[b.trainer],
        mode: b.mode,
        timing: b.timing,
        startDate: day(b.start, 0),
        expectedEndDate: day(b.plannedEnd, 0),
        actualEndDate: b.actualEnd !== undefined ? day(b.actualEnd, 0) : undefined,
        capacity: 25,
        status: b.status,
        remarks: b.code === 'JS-B01' ? 'Trainer on leave for a week — syllabus behind schedule' : '',
        completedTopicIds: [],
        classesConducted: 0,
        history: [{ at: day(b.start - 10), action: 'CREATED', details: `${subject.name} • ${b.timing}`, byUserId: admin?._id }],
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    batchDocs[b.code] = doc;
    bump('batches');
  }
  const dummyBatchIds = Object.values(batchDocs).map((b) => b._id);

  // Students (upsert user + student by Student ID; reset histories)
  const studentDocs: Record<string, any> = {};
  for (const [i, s] of STUDENTS.entries()) {
    const email = `${s.id.toLowerCase()}@${PLACEHOLDER_EMAIL_DOMAIN}`;
    let user = await User.findOne({ email });
    if (!user) user = await User.create({ email, passwordHash: passwordStudent, fullName: s.name, role: 'STUDENT' });
    else await User.updateOne({ _id: user._id }, { fullName: s.name, role: 'STUDENT' });

    const firstMode = s.modeChange ? (s.mode === 'ONLINE' ? 'OFFLINE' : 'ONLINE') : s.mode;
    const statusHistory: any[] = [{ status: 'ACTIVE', date: day(s.join), reason: 'Admission', remarks: '', byUserId: admin?._id }];
    (s.statusEvents || []).forEach((e) => statusHistory.push({ status: e.status, date: day(e.at), reason: e.reason, remarks: '', byUserId: admin?._id }));
    const modeHistory: any[] = s.modeChange
      ? [
          { mode: firstMode, from: day(s.join), to: day(s.modeChange.at), reason: 'Admission' },
          { mode: s.mode, from: day(s.modeChange.at), reason: s.modeChange.reason, byUserId: admin?._id },
        ]
      : [{ mode: s.mode, from: day(s.join), reason: 'Admission' }];

    const doc = await Student.findOneAndUpdate(
      { studentId: s.id },
      {
        userId: user._id,
        phone: `90000${String(10001 + i)}`,
        college: '',
        branch: '',
        enrollmentDate: day(s.join),
        enrollment: {
          courseId: courseIds[s.course],
          joiningDate: day(s.join),
          mode: s.mode,
          preferredTiming: s.timing,
          status: s.status,
          remarks: 'Dummy development data',
        },
        statusHistory,
        modeHistory,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    studentDocs[s.id] = doc;
    bump('students');
  }
  const dummyStudentIds = Object.values(studentDocs).map((s) => s._id);

  // Wipe previously seeded tracking rows for these students / batches, then rebuild
  await Promise.all([
    StudentBatchAllocation.deleteMany({ studentId: { $in: dummyStudentIds } }),
    StudentTimeline.deleteMany({ studentId: { $in: dummyStudentIds } }),
    TrainerDailyUpdate.deleteMany({ batchId: { $in: dummyBatchIds } }),
    Attendance.deleteMany({ batchId: { $in: dummyBatchIds } }),
  ]);

  // Allocations + timeline
  interface Seat { plan: AllocPlan; student: StudentPlan; from: number; to: number | null; rates: Rates; allocationId?: any }
  const seatsByBatch: Record<string, Seat[]> = {};
  const timeline: any[] = [];
  const event = (studentId: any, type: TimelineEventType, title: string, details: string, at: number, refs: Record<string, any> = {}, hour = 10) =>
    timeline.push({ studentId, type, title, details, date: day(at, hour), ...refs, ...actor });

  for (const s of STUDENTS) {
    const student = studentDocs[s.id];
    const courseName = COURSES.find((c) => c.code === s.course)!.name;
    const joinedMode = s.modeChange ? (s.mode === 'ONLINE' ? 'Offline' : 'Online') : s.mode === 'ONLINE' ? 'Online' : 'Offline';
    event(student._id, 'JOINED', `Joined ${courseName}`, `${joinedMode} • Preferred timing: ${s.timing}`, s.join, {}, 9);

    let previousId: any;
    for (const a of s.allocs) {
      const bp = BATCHES.find((b) => b.code === a.batch)!;
      const batch = batchDocs[a.batch];
      const subjectName = SUBJECTS[bp.subject].name;
      const from = a.from ?? Math.max(bp.start, s.join);
      const to = a.to ?? (a.status === 'COMPLETED' ? bp.actualEnd! : null);
      const allocatedAt = a.allocatedAt ?? (bp.start > 0 ? -2 : from - (from === bp.start ? 3 : 0));
      const moveTarget = a.status === 'MOVED';
      const alloc = await StudentBatchAllocation.create({
        studentId: student._id,
        batchId: batch._id,
        subjectId: batch.subjectId,
        courseId: courseIds[s.course],
        allocationDate: day(allocatedAt),
        startDate: day(Math.max(from, bp.start), 0),
        endDate: to !== null ? day(to, 18) : undefined,
        status: a.status,
        mode: bp.mode,
        reason: a.reason || '',
        remarks: '',
        previousAllocationId: a.from !== undefined && previousId && s.allocs.some((x) => x.status === 'MOVED') ? previousId : undefined,
        allocatedById: admin?._id,
      });
      bump('allocations');
      const refs = { batchId: batch._id, subjectId: batch.subjectId, allocationId: alloc._id };

      if (!(a.from !== undefined && s.allocs.some((x) => x.status === 'MOVED'))) {
        event(student._id, 'ALLOCATED', `Allocated ${a.batch}`, `${subjectName} • ${bp.timing} • ${bp.mode === 'ONLINE' ? 'Online' : 'Offline'}`, allocatedAt, refs);
      }
      if (a.status === 'COMPLETED') event(student._id, 'SUBJECT_COMPLETED', `${subjectName} completed`, `Batch ${a.batch} completed`, to!, refs, 17);
      if (a.status === 'MISSED') event(student._id, 'ALLOCATION_STATUS', `Missed ${a.batch} — ${subjectName} reallocation required`, a.reason || '', to!, refs, 12);
      if (moveTarget) {
        const next = s.allocs[s.allocs.indexOf(a) + 1];
        event(student._id, 'MOVED', `Moved ${a.batch} → ${next.batch}`, a.reason || '', to!, { ...refs }, 11);
      }
      if (a.status === 'ON_HOLD' || a.status === 'DROPPED') {
        event(student._id, 'ALLOCATION_STATUS', `${a.batch} seat released (${a.status === 'ON_HOLD' ? 'on hold' : 'dropped'})`, a.reason || '', to!, refs, 12);
      }

      if (!seatsByBatch[a.batch]) seatsByBatch[a.batch] = [];
      seatsByBatch[a.batch].push({ plan: a, student: s, from: Math.max(from, bp.start), to, rates: a.rates || NORMAL, allocationId: alloc._id });
      previousId = alloc._id;
    }

    (s.statusEvents || []).forEach((e) =>
      event(
        student._id,
        e.status === 'REJOINED' ? 'REJOINED' : 'STATUS_CHANGED',
        e.status === 'REJOINED' ? 'Rejoined — previous progress restored' : e.status === 'ON_HOLD' ? 'Put on hold' : 'Dropped',
        e.reason,
        e.at,
        {},
        13
      )
    );
    if (s.modeChange) {
      const fromLabel = s.mode === 'ONLINE' ? 'Offline' : 'Online';
      const toLabel = s.mode === 'ONLINE' ? 'Online' : 'Offline';
      event(student._id, 'MODE_CHANGED', `Mode changed ${fromLabel} → ${toLabel}`, s.modeChange.reason, s.modeChange.at, {}, 10);
    }
  }

  // Trainer class updates, topic progress and attendance per batch
  for (const bp of BATCHES) {
    if (!bp.classes) continue;
    const batch = batchDocs[bp.code];
    const topics = [...subjectDocs[bp.subject].topics].sort((a: any, b: any) => a.order - b.order);
    const done = bp.topicsDone < 0 ? topics.length : bp.topicsDone;
    const lastDay = bp.status === 'COMPLETED' ? bp.actualEnd! : -1;
    const dates = classDays(bp.start, lastDay, bp.classes);
    const seats = seatsByBatch[bp.code] || [];

    for (const [ci, date] of dates.entries()) {
      // Spread the `done` topics across the classes in order
      const ticked = topics.filter((_: any, ti: number) => ti < done && Math.floor((ti * dates.length) / done) === ci);
      const offset = Math.round((date.getTime() - today.getTime()) / DAY);
      const present = seats.filter((st) => offset >= st.from && (st.to === null || offset <= st.to));

      let attendanceId;
      if (present.length) {
        const records = present.map((st) => {
          const r = rng(hash(`${st.student.id}-${bp.code}-${ci}`))();
          const status = r < st.rates.absent ? 'ABSENT' : r < st.rates.absent + st.rates.late ? 'LATE' : r < st.rates.absent + st.rates.late + st.rates.excused ? 'EXCUSED' : 'PRESENT';
          return { studentId: studentDocs[st.student.id]._id, status, remarks: '' };
        });
        const session = await Attendance.create({
          batchId: batch._id,
          trainerId: batch.trainerId,
          sessionName: `${bp.code} • ${date.toDateString()}`,
          date,
          records,
        });
        attendanceId = session._id;
        bump('attendanceSessions');
        bump('attendanceRecords', records.length);
      }

      const nextTopic = topics[topics.findIndex((t: any) => String(t._id) === String(ticked[ticked.length - 1]?._id)) + 1];
      await TrainerDailyUpdate.create({
        batchId: batch._id,
        trainerId: batch.trainerId,
        date,
        classConducted: true,
        topicTaught: ticked.length ? ticked.map((t: any) => t.title).join(', ') : 'Revision & practice exercises',
        topicCompleted: ticked.length > 0,
        completedTopicIds: ticked.map((t: any) => t._id),
        additionalTopic: ci % 7 === 3 ? 'Interview questions' : '',
        nextTopic: nextTopic?.title || '',
        remarks: ci % 9 === 5 ? 'Doubt-clearing session at the end' : '',
        attendanceId,
      });
      bump('trainerDailyUpdates');
    }

    batch.completedTopicIds = topics.slice(0, done).map((t: any) => t._id);
    batch.classesConducted = dates.length;
    seats.forEach((st) =>
      batch.history.push({ at: day(st.plan.allocatedAt ?? st.from), action: 'STUDENT_ADDED', details: `${st.student.id} allocated`, byUserId: admin?._id })
    );
    if (bp.status === 'COMPLETED') batch.history.push({ at: day(bp.actualEnd!, 18), action: 'STATUS_CHANGED', details: 'RUNNING → COMPLETED', byUserId: admin?._id });
    if (bp.code === 'JS-B01') batch.history.push({ at: day(-18), action: 'CLASS_UPDATE', details: 'No classes for a week — trainer on leave', byUserId: admin?._id });
    await batch.save();
  }

  await StudentTimeline.insertMany(timeline);
  bump('timelineEvents', timeline.length);
  return counts;
}

// `npm run seed:test` — seed the configured database (guarded)
if (require.main === module) {
  (async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { env } = require('../config/env');
    assertSafeToSeed(env.USE_MEMORY_DB);
    if (env.USE_MEMORY_DB) {
      console.log('ℹ️  In-memory DB is wiped when this process exits. Use `npm run dev:test` to browse the dummy data.');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { connectDB } = require('../config/db');
    await connectDB();
    const counts = await seedTestData();
    console.log('🌱 Dummy test data seeded:', counts);
    process.exit(0);
  })().catch((err) => {
    console.error('❌', err.message || err);
    process.exit(1);
  });
}
