import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Student } from '../models/Student';
import { User } from '../models/User';
import { getNextStudentId } from '../models/Counter';
import { TrackCourse } from '../models/tracking/TrackCourse';
import { AppError } from '../middleware/errorHandler';
import { AuthUserPayload } from '../middleware/auth';
import { addTimeline, PLACEHOLDER_EMAIL_DOMAIN } from './trackingService';
import { assignENumberQuietly } from './esslService';
import { sealPassword } from '../utils/credentialVault';

/** Two letters from the course name: first letters of the first two words (Data Analytics → DA) */
export function courseLetters(courseName: string, fallbackCode = ''): string {
  const words = courseName.toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || fallbackCode).slice(0, 2);
  return (letters || 'ST').padEnd(2, 'X');
}

/**
 * Auto Student ID: FIRSTNAME-CC-NN, e.g. MOHIT-DA-01. NN counts up per name+course
 * (MOHIT-DA-02 for a second Mohit in Data Analytics).
 */
export async function generateStudentId(fullName: string, course: { name: string; code?: string }): Promise<string> {
  const first = (fullName.trim().split(/\s+/)[0] || 'STUDENT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'STUDENT';
  const prefix = `${first}-${courseLetters(course.name, course.code)}`;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existing = await Student.find({ studentId: new RegExp(`^${escaped}-\\d+$`) }).select('studentId').lean();
  const max = existing.reduce((m, s: any) => Math.max(m, Number(String(s.studentId).split('-').pop()) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

export interface NewStudentInput {
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  courseId?: string | mongoose.Types.ObjectId | null;
  mode?: 'ONLINE' | 'OFFLINE';
  preferredTiming?: string;
  joiningDate?: string | Date | null;
  remarks?: string;
  password: string;
  customStudentId?: string;
  registrationSource?: 'ADMIN' | 'GOOGLE_FORM';
  registrationId?: mongoose.Types.ObjectId;
  joinedDetails?: string; // extra text for the JOINED timeline event
  education?: {
    dateOfBirth?: string;
    college?: string;
    degree?: string;
    branch?: string;
    graduationYear?: string;
    cgpa?: string;
    tenthPercentage?: string;
    twelfthPercentage?: string;
  };
}

// Only numbers within range are stored, so a blank or odd answer keeps the schema default
const num = (v: unknown, max: number) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 && n <= max ? n : undefined;
};

function educationFields(e: NewStudentInput['education']) {
  if (!e) return {};
  const out: Record<string, unknown> = {};
  if (e.dateOfBirth?.trim()) out.dateOfBirth = e.dateOfBirth.trim();
  if (e.college?.trim()) out.college = e.college.trim();
  if (e.degree?.trim()) out.degree = e.degree.trim();
  if (e.branch?.trim()) out.branch = e.branch.trim();
  const year = num(e.graduationYear, 2100);
  if (year && year >= 1950) out.graduationYear = Math.round(year);
  const cgpa = num(e.cgpa, 10); // a degree percentage like 84 isn't a CGPA; it stays on the registration only
  if (cgpa) out.cgpa = cgpa;
  const tenth = num(e.tenthPercentage, 100);
  if (tenth) out.tenthPercentage = tenth;
  const twelfth = num(e.twelfthPercentage, 100);
  if (twelfth) out.twelfthPercentage = twelfth;
  return out;
}

/**
 * Creates the login (User) and Student profile. Email is optional: accounts without one get an
 * internal placeholder and log in with Student ID + password.
 */
export async function createStudentAccount(input: NewStudentInput, actor?: AuthUserPayload) {
  const fullName = input.fullName?.trim();
  if (!fullName) throw new AppError('Name is required', 400, 'MISSING_FIELDS');
  if (!input.password || String(input.password).length < 6) throw new AppError('Password must be at least 6 characters', 400, 'MISSING_FIELDS');

  const course = input.courseId ? await TrackCourse.findById(input.courseId) : null;
  if (input.courseId && !course) throw new AppError('Course not found', 404, 'NOT_FOUND');

  const email = input.email?.trim().toLowerCase() || '';
  if (email && (await User.exists({ email }))) throw new AppError('A user with this email already exists', 409, 'DUPLICATE');

  let studentId = input.customStudentId?.trim().toUpperCase();
  if (studentId) {
    if (await Student.exists({ studentId })) throw new AppError(`Student ID ${studentId} is already taken`, 409, 'DUPLICATE');
  } else {
    studentId = course ? await generateStudentId(fullName, course) : await getNextStudentId();
  }

  const mode = input.mode === 'ONLINE' ? 'ONLINE' : 'OFFLINE';
  const preferredTiming = input.preferredTiming || '';
  const remarks = input.remarks || '';
  const joined = input.joiningDate ? new Date(input.joiningDate) : new Date();

  const user = await User.create({
    email: email || `${studentId.toLowerCase()}@${PLACEHOLDER_EMAIL_DOMAIN}`,
    passwordHash: await bcrypt.hash(String(input.password), 10),
    fullName,
    role: 'STUDENT',
  });

  let student;
  try {
    student = await Student.create({
      userId: user._id,
      studentId,
      loginPassword: sealPassword(String(input.password)),
      phone: input.phone?.trim() || '',
      address: input.address?.trim() || '',
      college: '',
      branch: '',
      ...educationFields(input.education),
      registrationSource: input.registrationSource || 'ADMIN',
      registrationId: input.registrationId,
      enrollment: { courseId: course?._id, joiningDate: joined, mode, preferredTiming, status: 'ACTIVE', remarks },
      statusHistory: [{ status: 'ACTIVE', date: joined, reason: 'Admission', remarks, byUserId: actor?.userId }],
      modeHistory: [{ mode, from: joined, reason: 'Admission', byUserId: actor?.userId }],
    });
  } catch (err) {
    // Don't leave an orphan login behind if the profile can't be created
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  // E Number = Biometric ID on the eSSL machine; separate from the Student ID above
  student.biometricId = await assignENumberQuietly(student._id);

  await addTimeline(
    student._id,
    'JOINED',
    `Joined ${course?.name || 'ScholarLogic'}`,
    [`${mode === 'ONLINE' ? 'Online' : 'Offline'} • Preferred timing: ${preferredTiming || 'Not specified'}`, input.joinedDetails].filter(Boolean).join(' • '),
    {},
    actor,
    joined
  );

  return { student, studentId, course };
}
