import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Globe, Search, Send, X } from 'lucide-react';
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
  status: string;
  appliedAt: string;
}

const STATUSES = ['APPLIED', 'SHORTLISTED', 'ASSESSMENT', 'TECH_INTERVIEW', 'HR_INTERVIEW', 'SELECTED', 'OFFERED', 'JOINED', 'REJECTED', 'WITHDRAWN'];
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const th = 'px-3 py-3 whitespace-nowrap text-left';

export const PlacementApplications: React.FC = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const jobFilter = params.get('jobId') || '';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [via, setVia] = useState<'' | 'PORTAL' | 'COMPANY_SITE'>('');
  const [statusFilter, setStatusFilter] = useState('');

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
      if (jobFilter && r.job?._id !== jobFilter) return false;
      if (via && r.appliedVia !== via) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (!term) return true;
      return [r.student?.fullName, r.student?.studentId, r.student?.phone, r.job?.title, r.company?.name].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [rows, q, via, statusFilter, jobFilter]);

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

  const companySite = (rows || []).filter((r) => r.appliedVia === 'COMPANY_SITE').length;

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Applications"
        subtitle="Every student who applied to a job. Applications made on a company's own website are recorded when the student clicks Apply."
        action={
          <button type="button" className={secondaryBtn} onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        }
      />
      <ErrorNote text={error} />

      {rows && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Total applications', rows.length],
            ['Via company website', companySite],
            ['Via ScholarLogic form', rows.length - companySite],
            ['Selected / offered / joined', rows.filter((r) => ['SELECTED', 'OFFERED', 'JOINED'].includes(r.status)).length],
          ].map(([l, v]) => (
            <Card key={String(l)} className="p-4">
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{v}</p>
              <p className="text-[11px] font-semibold text-slate-500">{l}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="app-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student name, Student ID, phone, job or company" />
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
          <select id="app-status" className={`${inputClass} !py-1.5 text-xs`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </div>
        {(jobFilter || via || statusFilter || q) && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            onClick={() => {
              setQ('');
              setVia('');
              setStatusFilter('');
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
                  {['Applied', 'Student', 'Contact', 'Job', 'Company', 'Applied via', 'Status'].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.length === 0 ? (
                  <EmptyRow colSpan={7} text={rows.length ? 'No applications match these filters.' : 'No applications yet. They appear here as soon as a student clicks Apply.'} />
                ) : (
                  visible.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
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
