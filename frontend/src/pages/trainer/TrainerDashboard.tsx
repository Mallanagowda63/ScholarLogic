import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { Badge } from '../../components/Badge';
import {
  Users,
  BookOpen,
  FileCheck,
  Award,
  Calendar,
  Clock,
  PlusCircle,
  Upload,
  Send,
  AlertTriangle,
  TrendingUp,
  Video,
  FileText,
  HelpCircle,
  MessageSquare,
  CheckCircle2,
  Bell,
  UserCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

export const TrainerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Quick Action Modal states
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = () => {
    setLoading(true);
    api.get('/trainer/dashboard')
      .then((res: any) => {
        if (res.success && res.data) setDashboardData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/trainer/announcements', {
        title: announcementTitle,
        content: announcementContent,
      });
      alert('Announcement published to assigned students!');
      setShowAnnouncementModal(false);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to publish announcement');
    }
  };

  const handleScheduleSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const coursesRes: any = await api.get('/trainer/courses');
      const courseId = coursesRes.data.courses[0]?._id;
      if (!courseId) return alert('Please assign a course first');

      await api.post('/trainer/sessions', {
        courseId,
        title: sessionTitle,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
        type: 'LECTURE',
      });
      alert('Teaching session scheduled successfully!');
      setShowSessionModal(false);
      setSessionTitle('');
      fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Failed to schedule session');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const m = dashboardData?.metrics || {
    assignedStudentsCount: 86,
    activeCoursesCount: 4,
    pendingAssignmentsCount: 12,
    upcomingExamsCount: 3,
    avgStudentScore: 84,
    courseCompletionRate: 76,
    atRiskStudentsCount: 3,
    completedAssessmentsCount: 41,
  };

  const performanceTrendData = [
    { week: 'W1', avgScore: 75, completion: 60 },
    { week: 'W2', avgScore: 78, completion: 65 },
    { week: 'W3', avgScore: 82, completion: 72 },
    { week: 'W4', avgScore: 84, completion: 76 },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header (ScholarLogic Trainer Workspace) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            ScholarLogic Trainer Workspace
          </h1>
          <p className="text-xs text-slate-500">
            Welcome back, <span className="font-semibold text-slate-900 dark:text-white">{user?.fullName || 'Prof. Michael Vance'}</span>. Teaching management & student performance workspace.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="purple" className="px-3 py-1 font-mono text-xs">
            SENIOR INSTRUCTOR
          </Badge>
        </div>
      </div>

      {/* Primary Metrics (Requirement 20) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Assigned Courses" value={m.activeCoursesCount || 4} subtitle="Assigned LMS Modules" icon={BookOpen} color="indigo" />
        <StatCard title="Students" value={m.assignedStudentsCount || 86} subtitle="Enrolled Candidates" icon={Users} color="blue" />
        <StatCard title="Videos Uploaded" value={128} subtitle="Supabase Video Bucket" icon={Video} color="green" trend="100% Live" />
        <StatCard title="Notes PDFs" value={94} subtitle="Supabase Notes Bucket" icon={FileText} color="purple" />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard title="Pending Reviews" value={m.pendingAssignmentsCount || 12} subtitle="Requires Grading" icon={FileCheck} color="amber" trend="12 To Grade" />
        <StatCard title="Upcoming Exams" value={m.upcomingExamsCount || 3} subtitle="Scheduled Assessments" icon={Calendar} color="purple" />
        <StatCard title="Average Student Progress" value={`${m.courseCompletionRate || 76}%`} subtitle="Class Progress Velocity" icon={TrendingUp} color="green" trend="↑ 4% this week" />
      </div>

      {/* Trainer Quick Actions Bar (Requirement 21) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-brand-500" /> QUICK ACTIONS
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            to="/trainer/content?tab=videos"
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2.5 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            <Video className="h-4 w-4 text-emerald-500" /> + Upload Video
          </Link>

          <Link
            to="/trainer/content?tab=notes"
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2.5 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            <Upload className="h-4 w-4 text-brand-500" /> + Upload Notes
          </Link>

          <Link
            to="/trainer/content?tab=lessons"
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2.5 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            <BookOpen className="h-4 w-4 text-indigo-500" /> + Create Lesson
          </Link>

          <Link
            to="/trainer/assignments?action=create"
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2.5 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            <FileText className="h-4 w-4 text-amber-500" /> + Create Assignment
          </Link>

          <Link
            to="/trainer/exams?action=create-quiz"
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2.5 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            <HelpCircle className="h-4 w-4 text-purple-500" /> + Create Quiz
          </Link>

          <Link
            to="/trainer/exams?action=create-exam"
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2.5 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            <FileCheck className="h-4 w-4 text-blue-500" /> + Create Exam
          </Link>

          <Link
            to="/trainer/students"
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2.5 hover:bg-brand-50 hover:border-brand-300 transition-colors"
          >
            <Users className="h-4 w-4 text-teal-500" /> View Students
          </Link>

          <button
            onClick={() => setShowAnnouncementModal(true)}
            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2.5 hover:bg-brand-50 hover:border-brand-300 transition-colors text-left"
          >
            <Bell className="h-4 w-4 text-rose-500" /> Create Announcement
          </button>
        </div>
      </div>

      {/* Schedule & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-500" /> Class Completion Velocity Trend
            </h3>
            <span className="text-xs text-slate-500">Weekly Student Progress</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceTrendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="avgScore" name="Avg Score %" stroke="#0c8ee9" strokeWidth={3} />
                <Line type="monotone" dataKey="completion" name="Completion %" stroke="#10b981" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">Today's Class Timetable</h3>
          <div className="space-y-3">
            {(dashboardData?.todaysSchedule || []).map((session: any) => (
              <div key={session._id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-brand-600">{session.type}</span>
                <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1">{session.title}</h4>
                <a
                  href={session.meetingLink || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-emerald-600 font-bold hover:underline block pt-1"
                >
                  Join Meeting →
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Create Announcement */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-bold text-base text-white">Publish Course Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Headline</label>
                <input
                  type="text"
                  required
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  placeholder="Module 3 Notes Uploaded to Course"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Details</label>
                <textarea
                  rows={4}
                  required
                  value={announcementContent}
                  onChange={(e) => setAnnouncementContent(e.target.value)}
                  placeholder="The study guide PDF for Module 3 is now live in your LMS."
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700">
                  Publish Notice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
