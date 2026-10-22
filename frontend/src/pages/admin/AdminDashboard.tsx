import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { ProgressBar, StatusBadge, fmtDate, statusTone } from './tracking/shared';
import { StatCard } from '../../components/StatCard';
import { Badge } from '../../components/Badge';
import { Users, BookOpen, FileCheck, Building, Briefcase, Send, ShieldAlert, Award } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState<any>(null);

  useEffect(() => {
    api.get('/tracking/overview').then((res: any) => setTracking(res.data)).catch(() => {});
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

      {tracking && <TrackingOverview data={tracking} />}

      <h2 className="pt-2 text-sm font-bold uppercase tracking-wider text-slate-400">Platform</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Students" value={m.totalStudents ?? 0} subtitle="Verified Student IDs" icon={Users} color="blue" />
        <StatCard title="Active Courses" value={m.totalCourses ?? 0} subtitle="Published LMS Courses" icon={BookOpen} color="indigo" />
        <StatCard title="Exams Conducted" value={m.examSubmissionsCount ?? 0} subtitle="Assessment Submissions" icon={FileCheck} color="amber" />
        <StatCard title="Placed Students" value={m.totalPlaced ?? 0} subtitle="Verified Offer Letters" icon={Award} color="green" />
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

const TILE_TONE: Record<string, string> = {
  blue: 'text-brand-600 dark:text-brand-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  orange: 'text-orange-600 dark:text-orange-400',
  red: 'text-rose-600 dark:text-rose-400',
  purple: 'text-purple-600 dark:text-purple-400',
  slate: 'text-slate-900 dark:text-white',
};

const Section: React.FC<{ title: string; to?: string; children: React.ReactNode }> = ({ title, to, children }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      {to && (
        <Link to={to} className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline">
          View all →
        </Link>
      )}
    </div>
    {children}
  </div>
);

// Student + batch tracking summary: counts link to the detailed lists, never replace them
const TrackingOverview: React.FC<{ data: any }> = ({ data }) => {
  const m = data.metrics || {};
  const tiles: [string, number, string, string][] = [
    ['Total Students', m.totalStudents, 'slate', '/admin/students'],
    ['No Course Yet', m.noCourse, 'amber', '/admin/students'],
    ['Active', m.activeStudents, 'green', '/admin/students'],
    ['Online', m.onlineStudents, 'blue', '/admin/students'],
    ['Offline', m.offlineStudents, 'slate', '/admin/students'],
    ['Dropped / On Hold', m.droppedOrOnHold, 'red', '/admin/students'],
    ['Rejoining', m.rejoining, 'purple', '/admin/students'],
    ['Running Batches', m.runningBatches, 'blue', '/admin/batches'],
    ['Upcoming Batches', m.upcomingBatches, 'slate', '/admin/batches'],
    ['Delayed Batches', m.delayedBatches, 'orange', '/admin/batches'],
    ['Completed Batches', m.completedBatches, 'green', '/admin/batches'],
    ['Waiting for Allocation', m.waitingForAllocation, 'amber', '/admin/next-allocations'],
    ['Need Reallocation', m.requiringReallocation, 'orange', '/admin/next-allocations'],
    ['Completing Subject Soon', m.completingSoon, 'blue', '/admin/next-allocations'],
    ['New Registrations', m.pendingRegistrations, 'amber', '/admin/registrations'],
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, value, tone, to]) => (
          <Link key={label} to={to} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:border-brand-300 transition-colors">
            <p className={`text-2xl font-extrabold ${TILE_TONE[tone]}`}>{value ?? 0}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{label}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Students needing attention" to="/admin/next-allocations">
          {data.attention.length === 0 ? (
            <p className="text-xs text-slate-500">Everyone is allocated.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.attention.map((s: any) => (
                <li key={s._id} className="flex items-center justify-between gap-2 py-2 text-xs">
                  <Link to={`/admin/students/${s._id}`} className="hover:underline">
                    <span className="font-semibold text-slate-900 dark:text-white">{s.fullName}</span> <span className="font-mono text-slate-400">{s.studentId}</span>
                    <span className="block text-[11px] text-slate-500">
                      {s.course?.name} • {s.attentionReason}
                    </span>
                  </Link>
                  <StatusBadge status={s.attentionTone} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Upcoming batch allocations" to="/admin/planning">
          {data.upcomingBatches.length === 0 ? (
            <p className="text-xs text-slate-500">No batches starting in the next 45 days.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.upcomingBatches.map((b: any) => (
                <li key={b._id} className="flex items-center justify-between py-2 text-xs">
                  <Link to={`/admin/batches/${b._id}`} className="hover:underline">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{b.batchCode}</span>{' '}
                    <span className="text-slate-500">
                      {b.subject?.name} • {b.timing}
                    </span>
                  </Link>
                  <span className="text-right text-slate-500">
                    Starts {fmtDate(b.startDate)} • {b.availableSeats} seats
                    <span className="block font-semibold text-amber-600 dark:text-amber-400">{b.waitingStudents} students waiting</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Delayed batches" to="/admin/batches">
          {data.delayedBatches.length === 0 ? (
            <p className="text-xs text-slate-500">No delayed batches.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.delayedBatches.map((b: any) => (
                <li key={b._id} className="py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <Link to={`/admin/batches/${b._id}`} className="font-mono font-bold hover:underline">
                      {b.batchCode}
                    </Link>
                    <span className="text-orange-600">
                      Planned end {fmtDate(b.expectedEndDate)} • now {fmtDate(b.estimatedCompletion)}
                    </span>
                  </div>
                  <ProgressBar value={b.progress.percentage} tone="orange" className="mt-1" />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Trainer progress" to="/admin/trainers">
          {data.trainerProgress.length === 0 ? (
            <p className="text-xs text-slate-500">No running batches with trainers.</p>
          ) : (
            <ul className="space-y-3">
              {data.trainerProgress.map((t: any) => (
                <li key={t.trainer._id} className="text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white">{t.trainer.fullName}</p>
                  {t.batches.map((b: any) => (
                    <div key={b._id} className="mt-1 flex items-center gap-3">
                      <Link to={`/admin/batches/${b._id}`} className="w-20 font-mono text-slate-600 dark:text-slate-300 hover:underline">
                        {b.batchCode}
                      </Link>
                      <ProgressBar value={b.progress.percentage} tone={statusTone(b.status)} className="flex-1" />
                      <span className="w-24 text-right text-slate-500">
                        {b.progress.completed}/{b.progress.total} • {b.progress.percentage}%
                      </span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Recent student activity" to="/admin/history">
        {data.recentActivity.length === 0 ? (
          <p className="text-xs text-slate-500">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.recentActivity.map((e: any) => (
              <li key={e._id} className="flex flex-wrap items-center gap-3 py-2 text-xs">
                <span className="w-24 text-slate-400">{fmtDate(e.date)}</span>
                <span className="flex-1 font-semibold text-slate-800 dark:text-slate-200">{e.title}</span>
                {e.studentId && (
                  <Link to={`/admin/students/${e.studentId._id}`} className="text-brand-600 dark:text-brand-400 hover:underline">
                    {e.studentId.userId?.fullName} ({e.studentId.studentId})
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
};
