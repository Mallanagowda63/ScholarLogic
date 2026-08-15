import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { RoleGuard } from './components/RoleGuard';

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

// Student Pages
import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentCourses } from './pages/student/StudentCourses';
import { CourseDetail } from './pages/student/CourseDetail';
import { StudentExams } from './pages/student/StudentExams';
import { ExamInstructions } from './pages/student/ExamInstructions';
import { ExamRunner } from './pages/student/ExamRunner';
import { ExamResult } from './pages/student/ExamResult';
import { ResumeBuilder } from './pages/student/ResumeBuilder';
import { StudentJobs } from './pages/student/StudentJobs';
import { StudentApplications } from './pages/student/StudentApplications';
import { StudentProfile } from './pages/student/StudentProfile';
import { Certificates } from './pages/student/Certificates';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminStudents } from './pages/admin/AdminStudents';

// Upgraded Trainer Workspace Pages
import { TrainerDashboard } from './pages/trainer/TrainerDashboard';
import { TrainerCourses } from './pages/trainer/TrainerCourses';
import { CourseContentEditor } from './pages/trainer/CourseContentEditor';
import { TrainerStudents } from './pages/trainer/TrainerStudents';
import { StudentDetailView } from './pages/trainer/StudentDetailView';
import { TrainerAssignments } from './pages/trainer/TrainerAssignments';
import { TrainerAssessments } from './pages/trainer/TrainerAssessments';
import { TrainerQuestionBank } from './pages/trainer/TrainerQuestionBank';
import { TrainerExamResults } from './pages/trainer/TrainerExamResults';
import { TrainerAttendance } from './pages/trainer/TrainerAttendance';
import { TrainerCalendar } from './pages/trainer/TrainerCalendar';
import { TrainerAnnouncements } from './pages/trainer/TrainerAnnouncements';
import { TrainerMessages } from './pages/trainer/TrainerMessages';
import { TrainerAnalytics } from './pages/trainer/TrainerAnalytics';
import { TrainerProfile } from './pages/trainer/TrainerProfile';

// Upgraded Placement Intelligence Platform Pages
import { PlacementDashboard } from './pages/placement/PlacementDashboard';
import { PlacementCompanies } from './pages/placement/PlacementCompanies';
import { CompanyComparison } from './pages/placement/CompanyComparison';
import { PlacementJobs } from './pages/placement/PlacementJobs';
import { HiringIntelligence } from './pages/placement/HiringIntelligence';
import { PlacementReports } from './pages/placement/PlacementReports';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Marketing Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/courses" element={<StudentCourses />} />
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
                <Route path="/trainer/exams" element={<TrainerAssessments />} />
                <Route path="/trainer/question-bank" element={<TrainerQuestionBank />} />
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
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
