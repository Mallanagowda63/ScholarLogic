export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TRAINER' | 'PLACEMENT_MANAGER' | 'STUDENT';

export interface User {
  id: string;
  _id?: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  studentId?: string;
}

export interface StudentProfile {
  _id: string;
  userId: string;
  studentId: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  location?: string;
  college: string;
  degree: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
  tenthPercentage?: number;
  twelfthPercentage?: number;
  skills: string[];
  projects: Array<{ title: string; description: string; technologies: string[]; link?: string }>;
  certifications: Array<{ name: string; issuer: string; issueDate?: string; credentialId?: string }>;
  githubUrl?: string;
  linkedInUrl?: string;
  portfolioUrl?: string;
  preferredRole?: string;
  preferredLocation?: string;
  batch: string;
}

export interface Course {
  _id: string;
  title: string;
  slug: string;
  description: string;
  thumbnailUrl: string;
  category: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  durationHours: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  enrolledStudentCount: number;
}

export interface Lesson {
  _id: string;
  moduleId: string;
  courseId: string;
  title: string;
  type: 'VIDEO' | 'NOTES' | 'ASSIGNMENT' | 'QUIZ';
  order: number;
  videoUrl?: string;
  durationMinutes?: number;
  notesFileUrl?: string;
  notesFileType?: string;
  assignmentId?: string;
  quizId?: string;
  userProgress?: {
    progressPercentage: number;
    completed: boolean;
  };
}

export interface Module {
  _id: string;
  courseId: string;
  title: string;
  description?: string;
  order: number;
  lessons: Lesson[];
}

export interface Exam {
  _id: string;
  title: string;
  description: string;
  courseId?: Course;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  negativeMarking: number;
  attemptLimit: number;
  isPublished: boolean;
}

export interface Question {
  _id: string;
  examId: string;
  questionText: string;
  type: 'MCQ' | 'MULTIPLE_SELECT' | 'TRUE_FALSE' | 'SHORT_ANSWER';
  options: string[];
  marks: number;
  topicTag: string;
  explanation?: string;
}

export interface Result {
  _id: string;
  attemptId: string;
  examId: { _id: string; title: string; totalMarks: number; passingMarks: number };
  studentId: { _id: string; studentId: string; fullName: string };
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  rank?: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  timeSpentSeconds: number;
  topicBreakdown: Array<{ topic: string; totalQuestions: number; correctQuestions: number; percentage: number }>;
  evaluatedAt: string;
}

export interface ATSAnalysis {
  _id: string;
  atsScore: number;
  breakdown: {
    keywordMatch: number;
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    projectRelevance: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  recommendedKeywords: string[];
  formattingIssues: string[];
  contentImprovements: string[];
  potentialConcerns: string[];
}

export interface ResumeVersion {
  _id: string;
  title: string;
  versionName: string;
  template: 'CLASSIC' | 'MODERN' | 'TECHNICAL' | 'MINIMAL';
  data: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedInUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    summary: string;
    skills: string[];
    experience: Array<{ company: string; role: string; startDate: string; endDate?: string; current?: boolean; description: string }>;
    education: Array<{ institution: string; degree: string; fieldOfStudy: string; startDate: string; endDate: string; grade?: string }>;
    projects: Array<{ title: string; description: string; technologies: string[]; link?: string }>;
    certifications: string[];
  };
  isDefault: boolean;
  updatedAt: string;
}

export interface Company {
  _id: string;
  name: string;
  logoUrl?: string;
  website?: string;
  industry: string;
  description: string;
  location: string;
  contactEmail: string;
}

export interface Job {
  _id: string;
  title: string;
  companyId: Company;
  description: string;
  type: 'FULL_TIME' | 'INTERNSHIP' | 'CONTRACT';
  location: string;
  salaryPackage: string;
  experienceLevel: string;
  requiredSkills: string[];
  eligibilityCriteria: {
    minCgpa: number;
    allowedBranches: string[];
    passoutYears: number[];
  };
  deadline: string;
  openings: number;
  status: 'OPEN' | 'CLOSED';
  matchScore?: number;
  appliedStatus?: string | null;
}

export interface Application {
  _id: string;
  jobId: Job;
  studentId: { _id: string; studentId: string; fullName: string; cgpa: number; branch: string; skills: string[] };
  resumeId: ResumeVersion;
  appliedAt: string;
  status:
    | 'APPLIED'
    | 'SHORTLISTED'
    | 'ASSESSMENT'
    | 'TECH_INTERVIEW'
    | 'HR_INTERVIEW'
    | 'SELECTED'
    | 'OFFERED'
    | 'JOINED'
    | 'REJECTED'
    | 'WITHDRAWN';
  placementRound: string;
  matchScore: number;
}

export interface Certificate {
  _id: string;
  certificateId: string;
  studentId: any;
  courseId: Course;
  issueDate: string;
  verificationUrl: string;
  certificatePdfUrl?: string;
}

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: 'COURSE' | 'EXAM' | 'ASSIGNMENT' | 'JOB' | 'APPLICATION' | 'INTERVIEW' | 'OFFER' | 'SYSTEM';
  read: boolean;
  createdAt: string;
}
