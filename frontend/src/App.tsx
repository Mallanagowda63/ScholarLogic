import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { RoleGuard } from './components/RoleGuard';
import { GuestRoute } from './components/GuestRoute';

// Layouts
import { PublicLayout } from './layouts/PublicLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { TrainerLayout } from './layouts/TrainerLayout';
import { PlacementLayout } from './layouts/PlacementLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Public Pages
import { Home } from './pages/public/Home';
import { Login } from './pages/public/Login';
import { Register } from './pages/public/Register';
import { VerifyCertificate } from './pages/public/VerifyCertificate';
import { PlacementDrive } from './pages/public/PlacementDrive';
import { About } from './pages/public/About';

// Portal pages are code-split so public visitors don't download the whole app.
// Pages use named exports, so map the named export to the `default` React.lazy expects.
const lazyPage = <K extends string>(
  loader: () => Promise<Record<K, React.ComponentType>>,
  name: K
) => lazy(() => loader().then((m) => ({ default: m[name] })));

const PageFallback: React.FC = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
  </div>
);

// Student Pages
const StudentDashboard = lazyPage(() => import('./pages/student/StudentDashboard'), 'StudentDashboard');
const StudentCourses = lazyPage(() => import('./pages/student/StudentCourses'), 'StudentCourses');
const CourseDetail = lazyPage(() => import('./pages/student/CourseDetail'), 'CourseDetail');
const StudentExams = lazyPage(() => import('./pages/student/StudentExams'), 'StudentExams');
const ExamInstructions = lazyPage(() => import('./pages/student/ExamInstructions'), 'ExamInstructions');
const ExamRunner = lazyPage(() => import('./pages/student/ExamRunner'), 'ExamRunner');
const ExamResult = lazyPage(() => import('./pages/student/ExamResult'), 'ExamResult');
const ResumeBuilder = lazyPage(() => import('./pages/student/ResumeBuilder'), 'ResumeBuilder');
const StudentJobs = lazyPage(() => import('./pages/student/StudentJobs'), 'StudentJobs');
const StudentApplications = lazyPage(() => import('./pages/student/StudentApplications'), 'StudentApplications');
const StudentProfile = lazyPage(() => import('./pages/student/StudentProfile'), 'StudentProfile');
const Certificates = lazyPage(() => import('./pages/student/Certificates'), 'Certificates');
const VoiceMockInterview = lazyPage(() => import('./pages/student/VoiceMockInterview'), 'VoiceMockInterview');

// Admin Pages
const AdminDashboard = lazyPage(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard');
const AdminStudents = lazyPage(() => import('./pages/admin/AdminStudents'), 'AdminStudents');

// Upgraded Trainer Workspace Pages
const TrainerDashboard = lazyPage(() => import('./pages/trainer/TrainerDashboard'), 'TrainerDashboard');
const TrainerCourses = lazyPage(() => import('./pages/trainer/TrainerCourses'), 'TrainerCourses');
const CourseContentEditor = lazyPage(() => import('./pages/trainer/CourseContentEditor'), 'CourseContentEditor');
const TrainerStudents = lazyPage(() => import('./pages/trainer/TrainerStudents'), 'TrainerStudents');
const StudentDetailView = lazyPage(() => import('./pages/trainer/StudentDetailView'), 'StudentDetailView');
const TrainerAssignments = lazyPage(() => import('./pages/trainer/TrainerAssignments'), 'TrainerAssignments');
const TrainerAssessments = lazyPage(() => import('./pages/trainer/TrainerAssessments'), 'TrainerAssessments');
const TrainerQuestionBank = lazyPage(() => import('./pages/trainer/TrainerQuestionBank'), 'TrainerQuestionBank');
const TrainerExamResults = lazyPage(() => import('./pages/trainer/TrainerExamResults'), 'TrainerExamResults');
const TrainerAttendance = lazyPage(() => import('./pages/trainer/TrainerAttendance'), 'TrainerAttendance');
const TrainerCalendar = lazyPage(() => import('./pages/trainer/TrainerCalendar'), 'TrainerCalendar');
const TrainerAnnouncements = lazyPage(() => import('./pages/trainer/TrainerAnnouncements'), 'TrainerAnnouncements');
const TrainerMessages = lazyPage(() => import('./pages/trainer/TrainerMessages'), 'TrainerMessages');
const TrainerAnalytics = lazyPage(() => import('./pages/trainer/TrainerAnalytics'), 'TrainerAnalytics');
const TrainerProfile = lazyPage(() => import('./pages/trainer/TrainerProfile'), 'TrainerProfile');
const TrainerGradingPanel = lazyPage(() => import('./pages/trainer/TrainerGradingPanel'), 'TrainerGradingPanel');
const QuestionBankImporter = lazyPage(() => import('./pages/trainer/QuestionBankImporter'), 'QuestionBankImporter');

// Upgraded Placement Intelligence Platform Pages
const PlacementDashboard = lazyPage(() => import('./pages/placement/PlacementDashboard'), 'PlacementDashboard');
const PlacementCompanies = lazyPage(() => import('./pages/placement/PlacementCompanies'), 'PlacementCompanies');
const CompanyComparison = lazyPage(() => import('./pages/placement/CompanyComparison'), 'CompanyComparison');
const PlacementJobs = lazyPage(() => import('./pages/placement/PlacementJobs'), 'PlacementJobs');
const HiringIntelligence = lazyPage(() => import('./pages/placement/HiringIntelligence'), 'HiringIntelligence');
const PlacementReports = lazyPage(() => import('./pages/placement/PlacementReports'), 'PlacementReports');

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Public Marketing Routes */}
            <Route element={<PublicLayout />}>
              <Route element={<GuestRoute />}>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>
              <Route path="/courses" element={<StudentCourses />} />
              <Route path="/placement" element={<PlacementDrive />} />
              <Route path="/about" element={<About />} />
              <Route path="/verify/:certificateId" element={<VerifyCertificate />} />
            </Route>

            {/* Exam Runner View (Full Screen Canvas Layout for Enrolled Students) */}
            <Route element={<RoleGuard allowedRoles={['STUDENT']} />}>
              <Route path="/student/exams/:id/runner" element={<ExamRunner />} />
            </Route>

            {/* 1. STUDENT PORTAL (RoleGuard STUDENT) */}
            <Route element={<RoleGuard allowedRoles={['STUDENT']} />}>
              <Route element={<StudentLayout />}>
                <Route path="/student/dashboard" element={<StudentDashboard />} />
                <Route path="/student/courses" element={<StudentCourses />} />
                <Route path="/student/courses/:id" element={<CourseDetail />} />
                <Route path="/student/exams" element={<StudentExams />} />
                <Route path="/student/exams/:id/instructions" element={<ExamInstructions />} />
                <Route path="/student/results/:id" element={<ExamResult />} />
                <Route path="/student/results" element={<StudentDashboard />} />
                <Route path="/student/resume" element={<ResumeBuilder />} />
                <Route path="/student/jobs" element={<StudentJobs />} />
                <Route path="/student/applications" element={<StudentApplications />} />
                <Route path="/student/mock-interview" element={<VoiceMockInterview />} />
                <Route path="/student/profile" element={<StudentProfile />} />
                <Route path="/student/certificates" element={<Certificates />} />
              </Route>
            </Route>

            {/* 2. TRAINER PORTAL (RoleGuard TRAINER, ADMIN, SUPER_ADMIN) */}
            <Route element={<RoleGuard allowedRoles={['TRAINER', 'ADMIN', 'SUPER_ADMIN']} />}>
              <Route element={<TrainerLayout />}>
                <Route path="/trainer/dashboard" element={<TrainerDashboard />} />
                <Route path="/trainer/courses" element={<TrainerCourses />} />
                <Route path="/trainer/content" element={<CourseContentEditor />} />
                <Route path="/trainer/students" element={<TrainerStudents />} />
                <Route path="/trainer/students/:id" element={<StudentDetailView />} />
                <Route path="/trainer/assignments" element={<TrainerAssignments />} />
                <Route path="/trainer/grading" element={<TrainerGradingPanel />} />
                <Route path="/trainer/exams" element={<TrainerAssessments />} />
                <Route path="/trainer/question-bank" element={<TrainerQuestionBank />} />
                <Route path="/trainer/question-bank/import" element={<QuestionBankImporter />} />
                <Route path="/trainer/exams/:examId/results" element={<TrainerExamResults />} />
                <Route path="/trainer/attendance" element={<TrainerAttendance />} />
                <Route path="/trainer/calendar" element={<TrainerCalendar />} />
                <Route path="/trainer/announcements" element={<TrainerAnnouncements />} />
                <Route path="/trainer/messages" element={<TrainerMessages />} />
                <Route path="/trainer/analytics" element={<TrainerAnalytics />} />
                <Route path="/trainer/profile" element={<TrainerProfile />} />
              </Route>
            </Route>

            {/* 3. PLACEMENT MANAGER PORTAL (RoleGuard PLACEMENT_MANAGER, ADMIN, SUPER_ADMIN) */}
            <Route element={<RoleGuard allowedRoles={['PLACEMENT_MANAGER', 'ADMIN', 'SUPER_ADMIN']} />}>
              <Route element={<PlacementLayout />}>
                <Route path="/placement/dashboard" element={<PlacementDashboard />} />
                <Route path="/placement/companies" element={<PlacementCompanies />} />
                <Route path="/placement/comparison" element={<CompanyComparison />} />
                <Route path="/placement/jobs" element={<PlacementJobs />} />
                <Route path="/placement/jobs/official" element={<PlacementJobs />} />
                <Route path="/placement/applications" element={<StudentApplications />} />
                <Route path="/placement/hiring-intelligence" element={<HiringIntelligence />} />
                <Route path="/placement/hiring-intelligence/skills" element={<HiringIntelligence />} />
                <Route path="/placement/hiring-intelligence/locations" element={<HiringIntelligence />} />
                <Route path="/placement/hiring-intelligence/trends" element={<HiringIntelligence />} />
                <Route path="/placement/reports" element={<PlacementReports />} />
              </Route>
            </Route>

            {/* 4. ADMIN PORTAL (RoleGuard ADMIN, SUPER_ADMIN) */}
            <Route element={<RoleGuard allowedRoles={['ADMIN', 'SUPER_ADMIN']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/students" element={<AdminStudents />} />
                <Route path="/admin/courses" element={<StudentCourses />} />
                <Route path="/admin/exams" element={<StudentExams />} />
                <Route path="/admin/audit-logs" element={<AdminDashboard />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
