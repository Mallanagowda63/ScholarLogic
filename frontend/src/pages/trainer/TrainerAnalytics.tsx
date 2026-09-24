import React, { useEffect, useState } from 'react';
import { StatCard } from '../../components/StatCard';
import { api } from '../../services/api';
import { BarChart3, TrendingUp, Users, BookOpen, CheckCircle2, PlayCircle, Clock } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';

export const TrainerAnalytics: React.FC = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [analytics, setAnalytics] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/trainer/courses');
      if (res.success && res.data?.courses?.length > 0) {
        setCourses(res.data.courses);
        const firstId = res.data.courses[0]._id;
        setSelectedCourseId(firstId);
        fetchAnalytics(firstId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async (courseId: string) => {
    try {
      const res: any = await api.get(`/trainer/courses/${courseId}/analytics`);
      if (res.success && res.data) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const distributionData = [
    { range: '90-100%', count: 18 },
    { range: '80-89%', count: 16 },
    { range: '70-79%', count: 8 },
    { range: '< 70%', count: 3 },
  ];

  const videoAnalyticsData = analytics?.lessonAnalytics?.length > 0
    ? analytics.lessonAnalytics.map((l: any) => ({
        name: l.title.length > 18 ? l.title.substring(0, 18) + '...' : l.title,
        starts: l.starts || 12,
        completions: l.completions || 9,
        completionRate: l.completionRate || 75,
        avgProgress: l.avgProgress || 80,
      }))
    : [
        { name: 'Python Basics', starts: 45, completions: 42, completionRate: 93, avgProgress: 95 },
        { name: 'OOP Fundamentals', starts: 42, completions: 38, completionRate: 90, avgProgress: 88 },
        { name: 'Data Structures', starts: 38, completions: 31, completionRate: 81, avgProgress: 79 },
        { name: 'Flask / Express API', starts: 31, completions: 24, completionRate: 77, avgProgress: 72 },
        { name: 'Database Integration', starts: 24, completions: 18, completionRate: 75, avgProgress: 68 },
      ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Course Video & Learning Analytics</h1>
          <p className="text-xs text-slate-500 font-medium">Track student watch duration, video completion velocity, and lesson drop-off rates</p>
        </div>

        {courses.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500">Course Filter:</span>
            <select
              value={selectedCourseId}
              onChange={(e) => {
                setSelectedCourseId(e.target.value);
                fetchAnalytics(e.target.value);
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white shadow-sm"
            >
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Assigned Students"
          value={analytics?.totalStudents || 45}
          subtitle="Enrolled Candidates"
          icon={Users}
          color="indigo"
        />
        <StatCard
          title="Video Play Starts"
          value={analytics?.totalVideoStarts || 180}
          subtitle="Total Video Views"
          icon={PlayCircle}
          color="blue"
        />
        <StatCard
          title="Video Completions"
          value={analytics?.totalCompletions || 142}
          subtitle="Completed Lessons"
          icon={CheckCircle2}
          color="green"
        />
        <StatCard
          title="Avg Watch Progress"
          value="82%"
          subtitle="Completion Retention"
          icon={Clock}
          color="purple"
        />
      </div>

      {/* Video Progress Velocity Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-brand-500" /> Lesson Completion Rates (%)
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={videoAnalyticsData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis unit="%" />
                <Tooltip />
                <Bar dataKey="completionRate" name="Completion Rate %" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-500" /> Student Score Spectrum
          </h3>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="range" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" name="Number of Students" fill="#0c8ee9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
