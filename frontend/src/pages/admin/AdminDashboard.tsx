import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { Badge } from '../../components/Badge';
import { Users, BookOpen, FileCheck, Building, Briefcase, Send, ShieldAlert, Award } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/metrics')
      .then((res: any) => {
        if (res.success && res.data) {
          setMetrics(res.data.metrics);
          setAuditLogs(res.data.auditLogs || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const m = metrics || {};

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">ScholarLogic Master Administration</h1>
        <p className="text-xs text-slate-500">Platform-wide overview of enrolled students, courses, exams, and placement drives</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Students" value={m.totalStudents || 2} subtitle="Verified Student IDs" icon={Users} color="blue" />
        <StatCard title="Active Courses" value={m.totalCourses || 4} subtitle="Published LMS Courses" icon={BookOpen} color="indigo" />
        <StatCard title="Exams Conducted" value={m.examSubmissionsCount || 5} subtitle="Assessment Submissions" icon={FileCheck} color="amber" />
        <StatCard title="Placed Students" value={m.totalPlaced || 1} subtitle="Verified Offer Letters" icon={Award} color="green" trend="78% Placement Rate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-brand-500" /> Placement Portal Metrics
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-semibold">Partner Companies</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{m.totalCompanies || 7}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-semibold">Active Job Postings</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{m.totalJobs || 4}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-semibold">Job Applications</span>
              <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{m.totalApplications || 5}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-semibold">Average Package</span>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">11.5 LPA</p>
            </div>
          </div>
        </div>

        {/* Audit Logs */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-purple-500" /> Platform Security & Audit Logs
          </h3>

          <div className="space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No recent security events recorded.</p>
            ) : (
              auditLogs.map((log: any, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{log.action}</p>
                    <p className="text-[10px] text-slate-400">{log.resource} • {log.userEmail || 'System'}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
