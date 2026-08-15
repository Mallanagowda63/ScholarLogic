import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { Course } from '../models/Course';
import { Module } from '../models/Module';
import { Lesson } from '../models/Lesson';
import { Quiz } from '../models/Quiz';
import { Assignment } from '../models/Assignment';
import { Exam } from '../models/Exam';
import { Question } from '../models/Question';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { Resume } from '../models/Resume';
import { ResumeAnalysis } from '../models/ResumeAnalysis';
import { Certificate } from '../models/Certificate';
import { Notification } from '../models/Notification';
import { Counter, getNextStudentId } from '../models/Counter';

export async function seedDatabase(force: boolean = true) {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0 && !force) {
    console.log('ℹ️ Database already contains data. Skipping seed step.');
    return;
  }

  if (existingUsers > 0 && force) {
    console.log('🧹 Cleaning seed collections in MongoDB Atlas while preserving registered student accounts...');
    const demoEmails = ['admin@scholarlogic.edu', 'trainer@scholarlogic.edu', 'placement@scholarlogic.edu', 'student@scholarlogic.edu', 'newstudent@scholarlogic.edu'];
    const demoUsers = await User.find({ email: { $in: demoEmails } });
    const demoUserIds = demoUsers.map((u) => u._id);

    await User.deleteMany({ email: { $in: demoEmails } });
    await Student.deleteMany({ $or: [{ userId: { $in: demoUserIds } }, { studentId: { $regex: '^SL-2026-' } }] });
    await Course.deleteMany({});
    await Module.deleteMany({});
    await Lesson.deleteMany({});
    await Quiz.deleteMany({});
    await Assignment.deleteMany({});
    await Exam.deleteMany({});
    await Question.deleteMany({});
    await Company.deleteMany({});
    await Job.deleteMany({});
    await Application.deleteMany({});
    await Resume.deleteMany({});
    await ResumeAnalysis.deleteMany({});
    await Certificate.deleteMany({});
    await Notification.deleteMany({});
    await Counter.deleteMany({});
  }

  console.log('🌱 Seeding initial ScholarLogic database with demo data...');

  const salt = await bcrypt.genSalt(10);
  const adminPassword = await bcrypt.hash('Admin@123', salt);
  const trainerPassword = await bcrypt.hash('Trainer@123', salt);
  const placementPassword = await bcrypt.hash('Placement@123', salt);
  const studentPassword = await bcrypt.hash('Student@123', salt);

  // 1. Create Core Users
  const adminUser = await User.create({
    email: 'admin@scholarlogic.edu',
    passwordHash: adminPassword,
    fullName: 'Dr. Sarah Jenkins (Super Admin)',
    role: 'ADMIN',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    isVerified: true,
  });

  const trainerUser = await User.create({
    email: 'trainer@scholarlogic.edu',
    passwordHash: trainerPassword,
    fullName: 'Prof. Michael Vance (Senior Lead Instructor)',
    role: 'TRAINER',
    avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
    isVerified: true,
  });

  const placementUser = await User.create({
    email: 'placement@scholarlogic.edu',
    passwordHash: placementPassword,
    fullName: 'Elena Rostova (Placement Director)',
    role: 'PLACEMENT_MANAGER',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    isVerified: true,
  });

  const studentUser = await User.create({
    email: 'student@scholarlogic.edu',
    passwordHash: studentPassword,
    fullName: 'Alex Morgan',
    role: 'STUDENT',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    isVerified: true,
  });

  const studentId1 = await getNextStudentId();
  const studentProfile1 = await Student.create({
    userId: studentUser._id,
    studentId: studentId1, // SL-2026-00001
    phone: '+91 98765 43210',
    dateOfBirth: '2004-05-15',
    gender: 'Male',
    location: 'Bangalore, Karnataka',
    college: 'ScholarLogic Institute of Technology',
    degree: 'B.Tech',
    branch: 'Computer Science & Engineering',
    graduationYear: 2026,
    cgpa: 8.8,
    tenthPercentage: 92,
    twelfthPercentage: 90,
    skills: ['Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'SQL', 'Git', 'REST API'],
    projects: [
      {
        title: 'ScholarLogic E-Learning Hub',
        description: 'Full stack career and assessment portal built using React and Express.',
        technologies: ['React', 'Node.js', 'MongoDB', 'Tailwind CSS'],
        link: 'https://github.com/scholarlogic/learning-hub',
      },
    ],
    certifications: [
      {
        name: 'Full Stack Python Professional',
        issuer: 'ScholarLogic Academy',
        issueDate: '2025-11-10',
        credentialId: 'CERT-2026-001',
      },
    ],
    githubUrl: 'https://github.com/alexmorgan',
    linkedInUrl: 'https://linkedin.com/in/alexmorgan',
    preferredRole: 'Python Full Stack Developer',
    preferredLocation: 'Bangalore / Remote',
    batch: 'Batch 2026',
  });

  // 2. Create the Four Seeded Initial Courses
  const course1 = await Course.create({
    title: 'Python Full Stack Development',
    slug: 'python-full-stack-development',
    description: 'Master Python backend architecture, Django/FastAPI, React frontend design, REST APIs, and database engineering.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=500',
    category: 'Software Engineering',
    level: 'BEGINNER',
    durationHours: 60,
    status: 'PUBLISHED',
    createdById: adminUser._id,
    assignedTrainerIds: [trainerUser._id],
  });

  const course2 = await Course.create({
    title: 'AWS / Cloud Architecture & Operations',
    slug: 'aws-cloud-architecture-operations',
    description: 'Learn AWS EC2, S3, Lambda, VPC networking, IAM security, Terraform, and cloud enterprise deployment.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=500',
    category: 'Cloud Computing',
    level: 'INTERMEDIATE',
    durationHours: 50,
    status: 'PUBLISHED',
    createdById: adminUser._id,
    assignedTrainerIds: [trainerUser._id],
  });

  const course3 = await Course.create({
    title: 'DevOps Engineering & CI/CD Pipelines',
    slug: 'devops-engineering-cicd-pipelines',
    description: 'Automate software delivery with Docker containerization, Kubernetes orchestration, Jenkins, GitHub Actions, and Prometheus.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=500',
    category: 'DevOps & Infrastructure',
    level: 'ADVANCED',
    durationHours: 45,
    status: 'PUBLISHED',
    createdById: adminUser._id,
    assignedTrainerIds: [trainerUser._id],
  });

  const course4 = await Course.create({
    title: 'Data Analytics & Power BI Mastery',
    slug: 'data-analytics-power-bi-mastery',
    description: 'Transform complex business datasets into actionable dashboards with SQL, Pandas, NumPy, Power BI DAX, and Tableau.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=500',
    category: 'Data Science',
    level: 'BEGINNER',
    durationHours: 40,
    status: 'PUBLISHED',
    createdById: adminUser._id,
    assignedTrainerIds: [trainerUser._id],
  });

  // 3. Create Modules & Lessons for Python Course
  const mod1 = await Module.create({
    courseId: course1._id,
    title: 'Module 1: Python Fundamentals & Data Structures',
    description: 'Variables, loops, functions, lists, dictionaries, and memory management.',
    order: 1,
  });

  const mod2 = await Module.create({
    courseId: course1._id,
    title: 'Module 2: Object-Oriented Programming (OOP)',
    description: 'Classes, inheritance, polymorphism, encapsulation, and design patterns.',
    order: 2,
  });

  const lesson1 = await Lesson.create({
    moduleId: mod1._id,
    courseId: course1._id,
    title: 'Lesson 1: Introduction to Python Environment & Syntax',
    type: 'VIDEO',
    order: 1,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    durationMinutes: 20,
  });

  const lesson2 = await Lesson.create({
    moduleId: mod1._id,
    courseId: course1._id,
    title: 'Lesson 2: Core Data Types & Control Flow',
    type: 'VIDEO',
    order: 2,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    durationMinutes: 25,
  });

  const lesson3 = await Lesson.create({
    moduleId: mod1._id,
    courseId: course1._id,
    title: 'Lesson 3: Python Data Structures Study Guide',
    type: 'NOTES',
    order: 3,
    notesFileUrl: 'https://scholarlogic.edu/notes/python-basics.pdf',
    notesFileType: 'PDF',
  });

  // Quiz for Module 1
  const quiz1 = await Quiz.create({
    lessonId: lesson2._id,
    title: 'Python Syntax & Logic Quick Quiz',
    questions: [
      {
        questionText: 'What is the output of type([]) in Python?',
        options: ['<class "tuple">', '<class "list">', '<class "dict">', '<class "set">'],
        correctAnswerIndex: 1,
        explanation: 'Square brackets [] represent a list in Python.',
        marks: 10,
      },
      {
        questionText: 'Which keyword is used for function declaration in Python?',
        options: ['func', 'function', 'def', 'define'],
        correctAnswerIndex: 2,
        explanation: 'The def keyword defines a function.',
        marks: 10,
      },
    ],
  });

  lesson2.quizId = quiz1._id;
  await lesson2.save();

  // 4. Create Assessment Exam
  const exam1 = await Exam.create({
    title: 'Python Full Stack Assessment Exam',
    description: 'Comprehensive evaluation of Python programming, OOP principles, REST API design, and SQL querying.',
    courseId: course1._id,
    durationMinutes: 45,
    totalMarks: 100,
    passingMarks: 60,
    negativeMarking: 0.25,
    attemptLimit: 3,
    isPublished: true,
    createdById: adminUser._id,
  });

  await Question.create([
    {
      examId: exam1._id,
      questionText: 'Which of the following data structures in Python is immutable?',
      type: 'MCQ',
      options: ['List', 'Dictionary', 'Tuple', 'Set'],
      correctAnswer: 2,
      marks: 20,
      explanation: 'Tuples are immutable sequences in Python once created.',
      topicTag: 'Python Basics',
    },
    {
      examId: exam1._id,
      questionText: 'In Object-Oriented Programming, what is method overriding?',
      type: 'MCQ',
      options: [
        'Defining multiple functions with the same name in the same class',
        'Re-implementing a method in a child class that is already defined in parent class',
        'Deleting a method from parent class',
        'Calling a static method inside constructor',
      ],
      correctAnswer: 1,
      marks: 20,
      explanation: 'Method overriding allows a child class to provide a specific implementation of a method already defined in its superclass.',
      topicTag: 'OOP Principles',
    },
    {
      examId: exam1._id,
      questionText: 'What HTTP method is idempotent and used to replace an existing resource?',
      type: 'MCQ',
      options: ['POST', 'PUT', 'PATCH', 'CONNECT'],
      correctAnswer: 1,
      marks: 20,
      explanation: 'PUT requests are idempotent and replace the entire target resource.',
      topicTag: 'REST APIs',
    },
    {
      examId: exam1._id,
      questionText: 'Which SQL clause is used to filter records aggregated by a GROUP BY clause?',
      type: 'MCQ',
      options: ['WHERE', 'HAVING', 'FILTER', 'ORDER BY'],
      correctAnswer: 1,
      marks: 20,
      explanation: 'The HAVING clause filters group records resulting from a GROUP BY clause.',
      topicTag: 'SQL & Databases',
    },
    {
      examId: exam1._id,
      questionText: 'Is GIL (Global Interpreter Lock) in CPython thread-safe for CPU-bound multithreading?',
      type: 'TRUE_FALSE',
      options: ['True', 'False'],
      correctAnswer: 'False',
      marks: 20,
      explanation: 'GIL prevents true parallel multi-core CPU execution of Python threads in standard CPython.',
      topicTag: 'Python Advanced',
    },
  ]);

  // 5. Create Placement Companies and Jobs with fixed deterministic ObjectIds
  const company1Id = new mongoose.Types.ObjectId('650000000000000000000010');
  const company2Id = new mongoose.Types.ObjectId('650000000000000000000011');
  const job1Id = new mongoose.Types.ObjectId('650000000000000000000020');
  const job2Id = new mongoose.Types.ObjectId('650000000000000000000021');

  const company1 = await Company.create({
    _id: company1Id,
    name: 'Google Cloud Labs',
    logoUrl: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=120',
    website: 'https://cloud.google.com',
    industry: 'Enterprise Cloud & AI',
    description: 'Global leader in cloud computing, modern AI infrastructure, and scalable technology solutions.',
    location: 'Bangalore / Hyderabad',
    contactEmail: 'careers@google.com',
  });

  const company2 = await Company.create({
    _id: company2Id,
    name: 'Microsoft Development Center',
    logoUrl: 'https://images.unsplash.com/photo-1642543492481-44e81e3914a7?w=120',
    website: 'https://microsoft.com',
    industry: 'Software & Cloud Services',
    description: 'Empowering individuals and organizations around the globe with innovative software platforms.',
    location: 'Bangalore',
    contactEmail: 'placements@microsoft.com',
  });

  const job1 = await Job.create({
    _id: job1Id,
    title: 'Python Full Stack Engineer',
    companyId: company1._id,
    description: 'We are seeking talented Python Engineers with expertise in React, FastAPI/Django, PostgreSQL, and AWS.',
    type: 'FULL_TIME',
    location: 'Bangalore',
    salaryPackage: '14.5 - 18.0 LPA',
    experienceLevel: 'Fresher / 0-1 Year',
    requiredSkills: ['Python', 'React', 'Node.js', 'SQL', 'Git', 'REST API'],
    eligibilityCriteria: {
      minCgpa: 7.5,
      allowedBranches: ['Computer Science & Engineering', 'Information Technology'],
      passoutYears: [2026],
    },
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    openings: 8,
    status: 'OPEN',
    createdById: placementUser._id,
  });

  const job2 = await Job.create({
    _id: job2Id,
    title: 'AWS Cloud Solutions Associate',
    companyId: company2._id,
    description: 'Architect scalable cloud infrastructure, manage CI/CD deployment pipelines, and ensure system uptime.',
    type: 'FULL_TIME',
    location: 'Bangalore / Remote',
    salaryPackage: '12.0 - 15.0 LPA',
    experienceLevel: 'Fresher',
    requiredSkills: ['AWS', 'Cloud', 'DevOps', 'Docker', 'Linux'],
    eligibilityCriteria: {
      minCgpa: 7.0,
      allowedBranches: ['Computer Science & Engineering', 'Information Technology', 'Electronics'],
      passoutYears: [2026],
    },
    deadline: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    openings: 5,
    status: 'OPEN',
    createdById: placementUser._id,
  });

  // 6. Create Job Application for Alex Morgan
  const resume1 = await Resume.create({
    studentId: studentProfile1._id,
    title: 'Alex Morgan — Python Developer Resume',
    versionName: 'Python Full Stack Focus',
    template: 'MODERN',
    data: {
      fullName: 'Alex Morgan',
      email: studentUser.email,
      phone: '+91 98765 43210',
      location: 'Bangalore, India',
      linkedInUrl: 'https://linkedin.com/in/alexmorgan',
      githubUrl: 'https://github.com/alexmorgan',
      summary: 'Passionate Python Full Stack Engineer with strong foundations in React, Express, MongoDB, and Cloud architecture.',
      skills: ['Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'SQL', 'Git', 'REST API'],
      experience: [
        {
          company: 'ScholarLogic Labs',
          role: 'Full Stack Trainee',
          startDate: 'Jan 2025',
          endDate: 'Present',
          current: true,
          description: 'Engineered web applications and automated grading modules using React and Node.js REST services.',
        },
      ],
      education: [
        {
          institution: 'ScholarLogic Institute of Technology',
          degree: 'B.Tech',
          fieldOfStudy: 'Computer Science & Engineering',
          startDate: '2022',
          endDate: '2026',
          grade: 'CGPA: 8.8',
        },
      ],
      projects: [
        {
          title: 'ScholarLogic Career & Assessment Hub',
          description: 'Built LMS and ATS resume evaluation module.',
          technologies: ['React', 'Node.js', 'Express', 'MongoDB'],
          link: 'https://github.com/scholarlogic/learning-hub',
        },
      ],
      certifications: ['Full Stack Python Professional - ScholarLogic'],
    },
    isDefault: true,
  });

  await Application.create({
    jobId: job1._id,
    studentId: studentProfile1._id,
    companyId: company1._id,
    resumeId: resume1._id,
    appliedAt: new Date(),
    status: 'SHORTLISTED',
    placementRound: 'Technical Interview Round 1',
    matchScore: 92,
    notes: 'Strong candidate with impressive exam score and project portfolio.',
  });

  // 7. Initial Notification for Student
  await Notification.create({
    userId: studentUser._id,
    title: 'Welcome to ScholarLogic Hub! 👋',
    message: `Your permanent Student ID is ${studentId1}. Access your LMS courses, exams, resume builder, and placement opportunities.`,
    type: 'SYSTEM',
  });

  console.log('✅ ScholarLogic database seeding complete!');
  console.log('----------------------------------------------------');
  console.log('🔑 DEMO ACCOUNTS CREATED:');
  console.log('   Admin:             admin@scholarlogic.edu     / Admin@123');
  console.log('   Trainer:           trainer@scholarlogic.edu   / Trainer@123');
  console.log('   Placement Manager: placement@scholarlogic.edu / Placement@123');
  console.log('   Student:           student@scholarlogic.edu   / Student@123 (ID: SL-2026-00001)');
  console.log('----------------------------------------------------');
}

if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  (async () => {
    try {
      await connectDB();
      await seedDatabase();
      process.exit(0);
    } catch (err) {
      console.error('❌ Seed execution failed:', err);
      process.exit(1);
    }
  })();
}

