import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import {
  AllocateModal,
  Card,
  EmptyRow,
  PageHeader,
  ProgressBar,
  ReallocateModal,
  Spinner,
  StatusBadge,
  fmtDate,
  fmtMode,
  inputClass,
  primaryBtn,
  useToast,
} from './tracking/shared';

const REASON_LABEL: Record<string, { label: string; tone: string }> = {
  REALLOCATION_REQUIRED: { label: 'Needs reallocation', tone: 'REALLOCATION_REQUIRED' },
  SUBJECT_COMPLETED: { label: 'Subject completed', tone: 'COMPLETED' },
  NEARLY_COMPLETED: { label: 'Nearly completed', tone: 'ATTENDING' },
  NOT_STARTED: { label: 'Not started', tone: 'UPCOMING' },
};

export const AdminNextAllocations: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [reason, setReason] = useState('');
  const [dialog, setDialog] = useState<any>(null);

  const load = () => api.get('/tracking/next-allocations').then((r: any) => setRows(r.data?.rows || [])).catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);

  const visible = (rows || []).filter((r) => !reason || r.reason === reason);
  const done = (m: string) => {
    setDialog(null);
    toast.show(m);
    load();
  };

  return (
    <div className="space-y-5 pb-12">
      <PageHeader title="Next Allocations" subtitle="Students who finished, are finishing, or missed their current subject. Final allocation is always manual." />
      <div className="flex flex-wrap gap-2">
        {[['', 'All'], ...Object.entries(REASON_LABEL).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setReason(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${reason === k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
          >
            {label} {(rows || []).filter((r) => !k || r.reason === k).length}
          </button>
        ))}
      </div>
      {!rows ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  {['Student', 'Course', 'Current Subject', 'Progress', 'Expected Finish', 'Next Subject', 'Preferred Timing', 'Mode', 'Recommended Month', 'Allocation Status', 'Action'].map((h) => (
                    <th key={h} className="px-3 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.length === 0 ? (
                  <EmptyRow colSpan={11} text="Nobody is waiting for an allocation right now." />
                ) : (
                  visible.map((r) => {
                    const meta = REASON_LABEL[r.reason];
                    const isRealloc = r.reason === 'REALLOCATION_REQUIRED';
                    return (
                      <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-3 whitespace-nowrap">
                          <Link to={`/admin/students/${r._id}`} className="font-bold text-slate-900 dark:text-white hover:underline">{r.fullName}</Link>
                          <span className="block font-mono text-[10px] text-slate-400">{r.studentId}</span>
                        </td>
                        <td className="px-3 py-3">{r.course?.name}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{r.currentSubject?.name || '—'}</td>
                        <td className="px-3 py-3 w-28">
                          {r.currentProgress ? (
                            <>
                              <span className="font-bold">{r.currentProgress.percentage}%</span>
                              <ProgressBar value={r.currentProgress.percentage} className="mt-1" />
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">{fmtDate(r.currentExpectedEnd)}</td>
                        <td className="px-3 py-3 whitespace-nowrap font-semibold">
                          {r.targetSubject?.name || '—'}
                          <span className="ml-1.5"><StatusBadge status={meta?.tone} className="!font-semibold" /></span>
                          <span className="block text-[10px] font-normal text-slate-400">{meta?.label}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">{r.preferredTiming || '—'}</td>
                        <td className="px-3 py-3">{fmtMode(r.mode)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {new Date(`${r.recommendedMonth}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-3"><StatusBadge status={r.allocationStatus} /></td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className={primaryBtn}
                            onClick={() => setDialog(isRealloc ? { kind: 'realloc', r } : { kind: 'allocate', r })}
                          >
                            Allocate Batch
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {dialog?.kind === 'allocate' && (
        <AllocateModal
          student={{ _id: dialog.r._id, fullName: dialog.r.fullName, studentId: dialog.r.studentId }}
          subjects={dialog.r.targetSubject ? [{ subjectId: dialog.r.targetSubject.subjectId, name: dialog.r.targetSubject.name }] : []}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === 'realloc' && (
        <ReallocateModal
          allocationId={dialog.r.targetSubject.latestAllocationId}
          subjectId={dialog.r.targetSubject.subjectId}
          studentName={dialog.r.fullName}
          mode="REALLOCATE"
          alreadyClosed
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {toast.node}
    </div>
  );
};

// Web replacement for the per-month Excel sheets: batches running in a month grouped by subject
export const AdminMonthlyPlanning: React.FC = () => {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [batches, setBatches] = useState<any[] | null>(null);
  const [f, setF] = useState({ subject: '', trainer: '', mode: '', timing: '', status: '' });

  useEffect(() => {
    setBatches(null);
    api.get('/tracking/planning', { params: { month } }).then((r: any) => setBatches(r.data?.batches || [])).catch(() => setBatches([]));
  }, [month]);

  const opts = useMemo(() => {
    const u = (xs: any[]) => [...new Set(xs.filter(Boolean))].sort() as string[];
    return {
      subject: u((batches || []).map((b) => b.subject?.name)),
      trainer: u((batches || []).map((b) => b.trainer?.fullName)),
      timing: u((batches || []).map((b) => b.timing)),
      status: u((batches || []).map((b) => b.status)),
    };
  }, [batches]);

  const visible = (batches || []).filter(
    (b) =>
      (!f.subject || b.subject?.name === f.subject) &&
      (!f.trainer || b.trainer?.fullName === f.trainer) &&
      (!f.mode || b.mode === f.mode) &&
      (!f.timing || b.timing === f.timing) &&
      (!f.status || b.status === f.status)
  );
  const grouped = visible.reduce<Record<string, any[]>>((acc, b) => {
    const k = b.subject?.name || 'Other';
    (acc[k] ||= []).push(b);
    return acc;
  }, {});
  const sel = (k: keyof typeof f, label: string, options: string[], fmt?: (s: string) => string) => (
    <select className={`${inputClass} !py-1.5 text-xs`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} aria-label={label}>
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {fmt ? fmt(o) : o}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Monthly Planning"
        subtitle="Which subjects run at which timings in a month — replaces the monthly Excel sheets."
        action={<input type="month" className={`${inputClass} w-44`} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" />}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {sel('subject', 'All subjects', opts.subject)}
        {sel('trainer', 'All trainers', opts.trainer)}
        {sel('mode', 'Any mode', ['ONLINE', 'OFFLINE'], fmtMode)}
        {sel('timing', 'Any timing', opts.timing)}
        {sel('status', 'Any status', opts.status)}
      </div>
      {!batches ? (
        <Spinner />
      ) : Object.keys(grouped).length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">No batches planned for {new Date(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(grouped).map(([subject, list]) => (
            <Card key={subject} className="p-5">
              <h3 className="mb-3 text-base font-bold text-slate-900 dark:text-white">{subject}</h3>
              <ul className="space-y-2">
                {list
                  .sort((a, b) => a.timing.localeCompare(b.timing))
                  .map((b) => (
                    <li key={b._id}>
                      <Link to={`/admin/batches/${b._id}`} className="block rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:border-brand-300 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">⏰ {b.timing}</span>
                          <StatusBadge status={b.status} />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{b.batchCode}</span> • {b.trainer?.fullName || 'No trainer'} • {fmtMode(b.mode)} • {b.studentCount}/{b.capacity} seats
                        </p>
                        <p className="text-[11px] text-slate-400">{fmtDate(b.startDate)} → {fmtDate(b.estimatedCompletion)}</p>
                        <ProgressBar value={b.progress.percentage} className="mt-2" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
