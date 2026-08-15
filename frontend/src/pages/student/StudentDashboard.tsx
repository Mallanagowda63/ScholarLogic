import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { Badge } from '../../components/Badge';
import {
  BookOpen,
  Award,
  Sparkles,
  Briefcase,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Clock,
  HelpCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';

export const StudentDashboard: React.FC = () => {
  const { user, studentProfile } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = () => {
    setLoading(true);
    api.get('/students/dashboard')
      .then((res: any) => {
        if (res.success) setData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const metrics = data?.metrics || {};
  const student = data?.student || studentProfile;
  const skillData = data?.skillData || [];
  const continueLearningCourses = data?.continueLearningCourses || [];
  const upcomingExams = data?.upcomingExams || [];
  const placementDrive = data?.placementDrive || null;

  return (
    <div className="space-y-8 pb-12">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-brand-200">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-300" /> Student Identity Verified
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase">
              WELCOME BACK, {user?.fullName || 'STUDENT'} 👋
            </h1>
            <p className="text-xs sm:text-sm text-brand-100 font-medium">
              ScholarLogic Student ID:{' '}
              <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded-lg text-white">
                {student?.studentId || user?.studentId || 'SL-2026'}
              </span>
              {' '}• {student?.college || 'ScholarLogic Academy'} ({student?.branch || 'General Track'})
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/student/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-brand-700 shadow-md hover:bg-slate-100 transition-colors"
            >
              <BookOpen className="h-4 w-4" /> Start Learning
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Metrics Grid (100% Data-Driven) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Learning Progress"
          value={`${metrics.learningProgressPct || 0}%`}
          subtitle={metrics.enrolledCoursesCount > 0 ? `Across ${metrics.enrolledCoursesCount} Enrolled Courses` : 'No courses assigned yet'}
          icon={BookOpen}
          color="blue"
          trend={metrics.learningProgressPct > 0 ? `${metrics.learningProgressPct}% Completed` : 'Start your first course'}
        />

        <StatCard
          title="Resume ATS Score"
          value={metrics.atsScore !== null && metrics.atsScore !== undefined ? `${metrics.atsScore}%` : 'Not analyzed'}
          subtitle={metrics.atsScore !== null ? 'Latest Resume ATS Match' : 'Upload resume to analyze'}
          icon={Sparkles}
          color="purple"
          trend={metrics.atsScore !== null ? `Score Verified` : 'No analysis yet'}
        />

        <StatCard
          title="Applications"
          value={metrics.totalApplications || 0}
          subtitle={metrics.totalApplications > 0 ? `${metrics.shortlistedApplications || 0} Shortlisted` : 'No applications yet'}
          icon={Briefcase}
          color="green"
          trend={metrics.pendingInterviews > 0 ? `${metrics.pendingInterviews} Interviews Pending` : 'Explore job postings'}
        />

        <StatCard
          title="Upcoming Exam"
          value={metrics.nextExam ? metrics.nextExam.title : 'No upcoming exams'}
          subtitle={metrics.nextExam ? `${metrics.nextExam.durationMinutes} Mins • ${metrics.nextExam.totalMarks} Marks` : 'Check back later'}
          icon={Calendar}
          color="amber"
        />
      </div>

      {/* Analytics & Continue Learning Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Skill Radar & Course Progress */}
        <div className="lg:col-span-2 space-y-8">
          {/* Skill Performance Radar Chart */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-brand-500" /> Skill Proficiency Radar
                </h3>
                <p className="text-xs text-slate-500">Evaluated from your actual online assessment exams and quizzes</p>
              </div>
              {skillData.length > 0 && <Badge variant="green" className="font-mono">Exam Verified</Badge>}
            </div>

            {skillData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={skillData}>
                    <PolarGrid stroke="#94a3b8" strokeDasharray="3 3" opacity={0.3} />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar name="Score" dataKey="score" stroke="#0c8ee9" fill="#0c8ee9" fillOpacity={0.4} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex flex-col items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/50 p-6 text-center">
                <HelpCircle className="h-10 w-10 text-slate-400 mb-2" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">No assessment data yet</h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                  Complete your first course assessment or online exam to generate your personalized skill proficiency radar.
                </p>
              </div>
            )}
          </div>

          {/* Continue Learning Course Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Continue Learning</h3>
              <Link to="/student/courses" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                View All Courses →
              </Link>
            </div>

            {continueLearningCourses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {continueLearningCourses.map((course: any) => (
                  <div
                    key={course._id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-brand-500/50 transition-colors flex gap-4"
                  >
                    <img
                      src={course.thumbnailUrl || 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=200'}
                      alt={course.title}
                      className="h-20 w-24 rounded-xl object-cover"
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-brand-600 dark:text-brand-400">{course.category}</span>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">{course.title}</h4>
                      </div>

                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                          <span>{course.progressPercentage}% Completed</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${course.progressPercentage}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>{course.durationHours} Hours</span>
                        <Link
                          to={`/student/courses/${course._id}`}
                          className="font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                        >
                          Resume <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                <BookOpen className="h-10 w-10 text-slate-400 mx-auto" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">No courses assigned yet</h4>
                <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                  You are ready to start learning! Browse available ScholarLogic courses to begin your curriculum.
                </p>
                <Link
                  to="/student/courses"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-md hover:bg-brand-700 transition-colors"
                >
                  Browse Available Courses <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Upcoming Exams & Placement Updates */}
        <div className="space-y-8">
          {/* Upcoming Exams Panel */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" /> Upcoming Assessments
            </h3>

            {upcomingExams.length > 0 ? (
              <div className="space-y-3">
                {upcomingExams.map((exam: any) => (
                  <div key={exam._id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">{exam.title}</h4>
                      <Badge variant="amber">{exam.durationMinutes} Mins</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 truncate">{exam.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Total: {exam.totalMarks} Marks</span>
                      <Link
                        to={`/student/exams/${exam._id}/instructions`}
                        className="px-3 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-bold hover:bg-brand-700 transition-colors"
                      >
                        Start Exam
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center space-y-1">
                <Calendar className="h-8 w-8 text-slate-400 mx-auto mb-1" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">No upcoming exams</h4>
                <p className="text-[10px] text-slate-500">Scheduled exams will appear here automatically.</p>
              </div>
            )}
          </div>

          {/* Placement Drive Status Box */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-brand-500" /> Placement Drive Status
            </h3>

            {placementDrive ? (
              <div className="p-3.5 rounded-xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-900 dark:text-brand-200">{placementDrive.company}</span>
                  <Badge variant="green">{placementDrive.status}</Badge>
                </div>
                <p className="text-[11px] text-brand-700 dark:text-brand-300">Applied for: {placementDrive.title}</p>
                <div className="flex items-center gap-1 text-[10px] text-brand-600 font-semibold">
                  <Clock className="h-3 w-3" /> Updated: {new Date(placementDrive.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center space-y-2">
                <Briefcase className="h-8 w-8 text-slate-400 mx-auto" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">No active placement applications</h4>
                <p className="text-[10px] text-slate-500">Explore partner companies and submit job applications to track your progress.</p>
                <Link
                  to="/student/jobs"
                  className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold text-[11px]"
                >
                  View Job Postings
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
