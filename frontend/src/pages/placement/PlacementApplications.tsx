import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, Download, Globe, Search, Send, X, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Card, EmptyRow, ErrorNote, PageHeader, Spinner, inputClass, secondaryBtn, useToast } from '../admin/tracking/shared';

// Placement team: who applied to which job, including students who applied on the company's own website

interface Row {
  _id: string;
  applicationId: string;
  student: { _id: string; studentId: string; fullName: string; email: string; phone: string; college: string } | null;
  job: { _id: string; title: string; location: string; salaryPackage: string } | null;
  company: { _id: string; name: string } | null;
  appliedVia: 'PORTAL' | 'COMPANY_SITE';
  linkClicks: number;
  completion: 'PENDING' | 'COMPLETED' | 'NOT_COMPLETED';
  status: string;
  appliedAt: string;
}

const STATUSES = ['APPLIED', 'SHORTLISTED', 'ASSESSMENT', 'TECH_INTERVIEW', 'HR_INTERVIEW', 'SELECTED', 'OFFERED', 'JOINED', 'REJECTED', 'WITHDRAWN'];
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const th = 'px-3 py-3 whitespace-nowrap text-left';

// ---- Date-wise helpers (India time) ----
type RangeKey = 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
const RANGES: [RangeKey, string][] = [
  ['ALL', 'All dates'],
  ['TODAY', 'Today'],
  ['YESTERDAY', 'Yesterday'],
  ['WEEK', 'Last 7 days'],
  ['MONTH', 'This month'],
];
const IST = 5.5 * 3600000;
const dayOf = (d: string | Date) => new Date(new Date(d).getTime() + IST).toISOString().slice(0, 10);
const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
function rangeDays(k: RangeKey): [string, string] {
  const today = dayOf(new Date());
  if (k === 'TODAY') return [today, today];
  if (k === 'YESTERDAY') return [shiftDay(today, -1), shiftDay(today, -1)];
  if (k === 'WEEK') return [shiftDay(today, -6), today];
  if (k === 'MONTH') return [`${today.slice(0, 8)}01`, today];
  return ['', ''];
}
const dayLabel = (day: string) => {
  const today = dayOf(new Date());
  const name = new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return day === today ? `Today • ${name}` : day === shiftDay(today, -1) ? `Yesterday • ${name}` : name;
};

export const PlacementApplications: React.FC = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const jobFilter = params.get('jobId') || '';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [via, setVia] = useState<'' | 'PORTAL' | 'COMPANY_SITE'>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [doneFilter, setDoneFilter] = useState<'' | 'COMPLETED' | 'NOT_COMPLETED'>('');
  // Date-wise: a quick range or a custom From–To (by the day the student applied, India time)
  const [range, setRange] = useState<RangeKey>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fromDay, toDay] = range === 'CUSTOM' ? [from, to] : rangeDays(range);
  const inRange = (r: Row) => {
    const d = dayOf(r.appliedAt);
    return (!fromDay || d >= fromDay) && (!toDay || d <= toDay);
  };

  const load = () =>
    api
      .get('/placements/applications/all')
      .then((res: any) => setRows(res.data.applications))
      .catch((e: any) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const jobs = useMemo(() => {
    const m = new Map<string, string>();
    (rows || []).forEach((r) => r.job && m.set(r.job._id, `${r.job.title} • ${r.company?.name || ''}`));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (!inRange(r)) return false;
      if (jobFilter && r.job?._id !== jobFilter) return false;
      if (via && r.appliedVia !== via) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (doneFilter === 'COMPLETED' && r.completion !== 'COMPLETED') return false;
      if (doneFilter === 'NOT_COMPLETED' && r.completion === 'COMPLETED') return false;
      if (!term) return true;
      return [r.student?.fullName, r.student?.studentId, r.student?.phone, r.job?.title, r.company?.name].filter(Boolean).join(' ').toLowerCase().includes(term);
    })
      // Newest first, so the list groups by day
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }, [rows, q, via, statusFilter, doneFilter, jobFilter, fromDay, toDay]);

  const setStatus = async (r: Row, status: string) => {
    try {
      await api.put(`/placements/applications/${r._id}/status`, { status });
      setRows((all) => (all || []).map((x) => (x._id === r._id ? { ...x, status } : x)));
      toast.show(`${r.student?.fullName || 'Applicant'}: ${label(status)}`);
    } catch (e: any) {
      toast.show(e.message);
    }
  };

  const exportCsv = async () => {
    try {
      const res: any = await api.get('/placements/applications/export', { responseType: 'text' as any });
      const blob = new Blob([typeof res === 'string' ? res : String(res)], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast.show(e.message);
    }
  };

  // Company-site / Google Form links: a click is not an application until the student says they finished
  // The tiles count the chosen dates only
  const all = (rows || []).filter(inRange);
  const site = all.filter((r) => r.appliedVia === 'COMPANY_SITE');
  const completed = all.filter((r) => r.completion === 'COMPLETED');

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Applications"
        subtitle="For company-website and Google Form links, every click is counted. It becomes an application only when the student comes back and confirms they finished; otherwise it shows as Not completed."
        action={
          <button type="button" className={secondaryBtn} onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />
      <ErrorNote text={error} />

      {rows && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Completed applications', completed.length, 'text-emerald-600'],
            ['Opened company link', site.length, 'text-sky-600'],
            ['Total link clicks', site.reduce((n, r) => n + (r.linkClicks || 0), 0), 'text-slate-900 dark:text-white'],
            ['Not completed', site.length - site.filter((r) => r.completion === 'COMPLETED').length, 'text-amber-600'],
            ['Selected / offered / joined', completed.filter((r) => ['SELECTED', 'OFFERED', 'JOINED'].includes(r.status)).length, 'text-brand-600'],
          ].map(([l, v, tone]) => (
            <Card key={String(l)} className="p-4">
              <p className={`text-2xl font-extrabold ${tone}`}>{v}</p>
              <p className="text-[11px] font-semibold text-slate-500">{l}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          {RANGES.map(([k, text]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRange(k)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold ${range === k ? 'bg-brand-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
            >
              {text}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            From
            <input
              type="date"
              aria-label="From date"
              className={`${inputClass} !w-auto !py-1 text-xs`}
              value={range === 'CUSTOM' ? from : fromDay}
              max={toDay || undefined}
              onChange={(e) => {
                setRange('CUSTOM');
                setFrom(e.target.value);
                if (range !== 'CUSTOM') setTo(toDay);
              }}
            />
            to
            <input
              type="date"
              aria-label="To date"
              className={`${inputClass} !w-auto !py-1 text-xs`}
              value={range === 'CUSTOM' ? to : toDay}
              min={fromDay || undefined}
              onChange={(e) => {
                setRange('CUSTOM');
                setTo(e.target.value);
                if (range !== 'CUSTOM') setFrom(fromDay);
              }}
            />
          </span>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="app-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student name, Student ID, phone, job or company" />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select
            id="app-job"
            className={`${inputClass} !py-1.5 text-xs`}
            value={jobFilter}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('jobId', e.target.value);
              else next.delete('jobId');
              setParams(next);
            }}
          >
            <option value="">All jobs</option>
            {jobs.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select id="app-via" className={`${inputClass} !py-1.5 text-xs`} value={via} onChange={(e) => setVia(e.target.value as any)}>
            <option value="">Applied anywhere</option>
            <option value="COMPANY_SITE">On company website</option>
            <option value="PORTAL">Through ScholarLogic form</option>
          </select>
          <select id="app-done" className={`${inputClass} !py-1.5 text-xs`} value={doneFilter} onChange={(e) => setDoneFilter(e.target.value as any)}>
            <option value="">Completed or not</option>
            <option value="COMPLETED">Completed only</option>
            <option value="NOT_COMPLETED">Not completed only</option>
          </select>
          <select id="app-status" className={`${inputClass} !py-1.5 text-xs`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        {(jobFilter || via || statusFilter || doneFilter || q || range !== 'ALL') && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            onClick={() => {
              setQ('');
              setVia('');
              setStatusFilter('');
              setDoneFilter('');
              setRange('ALL');
              setFrom('');
              setTo('');
              setParams(new URLSearchParams());
            }}
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </Card>

      {!rows ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  {['Applied', 'Student', 'Contact', 'Job', 'Company', 'Applied via', 'Completed?', 'Status'].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.length === 0 ? (
                  <EmptyRow colSpan={8} text={rows.length ? 'No applications match these filters.' : 'No applications yet. They appear here as soon as a student clicks Apply.'} />
                ) : (
                  visible.map((r, i) => (
                    <React.Fragment key={r._id}>
                    {(i === 0 || dayOf(visible[i - 1].appliedAt) !== dayOf(r.appliedAt)) && (
                      <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                        <td colSpan={8} className="px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          {dayLabel(dayOf(r.appliedAt))}
                          <span className="ml-2 font-normal text-slate-400">{visible.filter((x) => dayOf(x.appliedAt) === dayOf(r.appliedAt)).length} application(s)</span>
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {new Date(r.appliedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-white">{r.student?.fullName || 'Removed student'}</span>
                        {r.student?.studentId && <span className="block font-mono text-[10px] text-slate-400">{r.student.studentId}</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        {r.student?.phone || '—'}
                        {r.student?.email && <span className="block max-w-[180px] truncate text-[10px] text-slate-400">{r.student.email}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-semibold text-slate-900 dark:text-white">{r.job?.title || '—'}</span>
                        {r.job?.salaryPackage && <span className="block text-[10px] text-slate-400">{r.job.salaryPackage}</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{r.company?.name || '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {r.appliedVia === 'COMPANY_SITE' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            <Globe className="h-3 w-3" /> Company website
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-950/50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                            <Send className="h-3 w-3" /> ScholarLogic form
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {r.completion === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Completed
                          </span>
                        ) : (
                          <span
                            title={r.completion === 'PENDING' ? "Opened the link but hasn't confirmed yet" : 'Student said they did not finish'}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                          >
                            {r.completion === 'PENDING' ? <Clock className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} Not completed
                          </span>
                        )}
                        {r.appliedVia === 'COMPANY_SITE' && (
                          <span className="block pt-0.5 text-[10px] text-slate-400">
                            {r.linkClicks} {r.linkClicks === 1 ? 'click' : 'clicks'}
                            {r.completion === 'PENDING' ? ' • no answer yet' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          id={`status-${r._id}`}
                          aria-label={`Status for ${r.student?.fullName || 'applicant'}`}
                          className={`${inputClass} !w-40 !py-1 text-xs`}
                          value={r.status}
                          onChange={(e) => setStatus(r, e.target.value)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {label(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-xs text-slate-500">
            Showing {visible.length} of {rows.length} applications
          </p>
        </Card>
      )}
      {toast.node}
    </div>
  );
};
