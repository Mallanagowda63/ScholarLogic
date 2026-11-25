import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { Award, Briefcase, Building, CheckCircle2, PlusCircle, Send, XCircle } from 'lucide-react';
import { PageHeader, Spinner, primaryBtn } from '../admin/tracking/shared';

// Placement team home: real numbers only
export const PlacementDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/placements/overview')
      .then((res: any) => setData(res.data))
      .catch((e: any) => setError(e.message));
  }, []);

  if (error) return <p className="p-6 text-sm text-rose-600">{error}</p>;
  if (!data) return <Spinner />;
  const m = data.metrics;
  const p = data.pipeline;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Placement Overview"
        subtitle="Companies, open jobs and how students are applying."
        action={
          <Link to="/placement/jobs" className={primaryBtn}>
            <PlusCircle className="h-4 w-4" /> Post a job
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Companies" value={m.partnerCompanyCount} subtitle="In the list" icon={Building} color="indigo" />
        <StatCard title="Open jobs" value={m.openPositionsCount} subtitle="Students can apply" icon={Briefcase} color="blue" />
        <StatCard title="Completed applications" value={m.totalApplicationsCount} subtitle="Confirmed by students" icon={CheckCircle2} color="green" />
        <StatCard title="Not completed" value={m.notCompletedCount ?? 0} subtitle="Opened the link, not finished" icon={XCircle} color="amber" />
        <StatCard title="Offers" value={m.offersCount} subtitle="Offered or joined" icon={Award} color="purple" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Send className="h-5 w-5 text-brand-500" /> Where students are
          </h3>
          <Link to="/placement/applications" className="text-xs font-bold text-brand-600 hover:underline">
            See all applications →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
          {[
            ['Applied', p.applied, 'text-slate-900 dark:text-white'],
            ['Shortlisted', p.shortlisted, 'text-brand-600'],
            ['Interview', (p.assessment || 0) + (p.techInterview || 0) + (p.hrInterview || 0), 'text-purple-600'],
            ['Offered', p.offered, 'text-emerald-600'],
            ['Joined', p.joined, 'text-emerald-700'],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
              <span className="block text-[10px] font-bold uppercase text-slate-400">{label}</span>
              <span className={`text-xl font-black ${tone}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
