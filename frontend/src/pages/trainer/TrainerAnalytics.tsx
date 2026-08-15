import React from 'react';
import { StatCard } from '../../components/StatCard';
import { BarChart3, TrendingUp, Users, Award, BookOpen, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const TrainerAnalytics: React.FC = () => {
  const distributionData = [
    { range: '90-100%', count: 18 },
    { range: '80-89%', count: 16 },
    { range: '70-79%', count: 8 },
    { range: '< 70%', count: 3 },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Assigned Course Performance Analytics</h1>
          <p className="text-xs text-slate-500">Comprehensive student score distribution, video completion velocity, and assignment completion statistics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Assigned Students" value={45} subtitle="Enrolled Candidates" icon={Users} color="indigo" />
        <StatCard title="Average Course Progress" value="76%" subtitle="LMS Video & Lesson Velocity" icon={BookOpen} color="blue" />
        <StatCard title="Classroom Test Average" value="84%" subtitle="Exam & Quiz Scores" icon={TrendingUp} color="green" />
        <StatCard title="Assignment Completion" value="91%" subtitle="Submitted Homework" icon={CheckCircle2} color="purple" />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-500" /> Student Score Distribution Spectrum
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
  );
};
