import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../../services/api';
import { Card, EmptyRow, ErrorNote, PageHeader, Spinner, inputClass, useToast } from '../admin/tracking/shared';

// Students the trainers pushed to the placement team, in a separate list per course

type Status = 'NEW' | 'IN_PROGRESS' | 'PLACED' | 'CLOSED';
interface Referral {
  _id: string;
  status: Status;
  note: string;
  placementNote: string;
  courseName: string;
  pushedAt: string;
  pushedBy: string;
  handledBy: string;
  student: { _id: string; studentId: string; fullName: string; email: string; phone: string; college: string; degree: string; batches: string[] } | null;
}

const STATUS: Record<Status, { text: string; cls: string }> = {
  NEW: { text: 'New', cls: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' },
  IN_PROGRESS: { text: 'In progress', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  PLACED: { text: 'Placed', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  CLOSED: { text: 'Closed', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

export const PlacementReadyStudents: React.FC = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const course = params.get('course') || '';
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | Status | 'OPEN'>('OPEN');

  const load = () =>
    api
      .get('/placement-referrals')
      .then((res: any) => setRows(res.data.referrals))
      .catch((e: any) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  // One tab per course, with how many students are still open in each
  const tabs = useMemo(() => {
    const m = new Map<string, { total: number; open: number }>();
    (rows || []).forEach((r) => {
      const t = m.get(r.courseName) || { total: 0, open: 0 };
      t.total += 1;
      if (r.status === 'NEW' || r.status === 'IN_PROGRESS') t.open += 1;
      m.set(r.courseName, t);
    });
    return [...m.entries()].sort(([a], [b]) => (a === 'No course' ? 1 : b === 'No course' ? -1 : a.localeCompare(b)));
  }, [rows]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (course && r.courseName !== course) return false;
      if (status === 'OPEN' && !(r.status === 'NEW' || r.status === 'IN_PROGRESS')) return false;
      if (status && status !== 'OPEN' && r.status !== status) return false;
      return !term || [r.student?.fullName, r.student?.studentId, r.student?.phone, r.pushedBy, r.note].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [rows, course, status, q]);

  const update = async (r: Referral, patch: { status?: Status; placementNote?: string }) => {
    try {
      await api.put(`/placement-referrals/${r._id}`, patch);
      setRows((all) => (all || []).map((x) => (x._id === r._id ? { ...x, ...patch } : x)));
      if (patch.status) toast.show(`${r.student?.fullName || 'Student'}: ${STATUS[patch.status].text}`);
    } catch (e: any) {
      toast.show(e.message);
    }
  };

  const pickCourse = (c: string) => {
    const next = new URLSearchParams(params);
    if (c) next.set('course', c);
    else next.delete('course');
    setParams(next);
  };
  const openTotal = (rows || []).filter((r) => r.status === 'NEW' || r.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-5 pb-12">
      <PageHeader title="Students from Trainers" subtitle="Students the trainers marked as ready for placement, by course. You get a notification each time a trainer pushes a student." />
      <ErrorNote text={error} />

      {!rows ? (
        <Spinner />
      ) : (
        <>
          <nav className="flex gap-5 overflow-x-auto border-b border-slate-200 dark:border-slate-800 text-sm font-semibold" aria-label="Courses">
            {[['', { total: rows.length, open: openTotal }] as [string, { total: number; open: number }], ...tabs].map(([c, n]) => (
              <button
                key={c || 'all'}
                type="button"
                onClick={() => pickCourse(c)}
                className={`relative shrink-0 pb-3 ${course === c ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                {c || 'All courses'}
                <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${n.open > 0 ? 'bg-brand-600 text-white' : 'text-slate-400'}`} title={`${n.open} open of ${n.total}`}>
                  {n.open}
                </span>
                <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500 ${course === c ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            ))}
          </nav>

          <Card className="p-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input id="ready-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Student ID, phone, trainer or note" />
              </label>
              <select id="ready-status" className={`${inputClass} text-xs`} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="OPEN">Open (new + in progress)</option>
                <option value="">All</option>
                <option value="NEW">New</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="PLACED">Placed</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    {['Pushed', 'Student', 'Course / batch', 'Contact', "Trainer's note", 'Status', 'Placement note'].map((h) => (
                      <th key={h} className="px-3 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visible.length === 0 ? (
                    <EmptyRow colSpan={7} text={rows.length ? 'Nobody here with these filters.' : 'No students pushed yet. Trainers push students from their Students page.'} />
                  ) : (
                    visible.map((r) => (
                      <tr key={r._id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-3 whitespace-nowrap">
                          {new Date(r.pushedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          <span className="block text-[10px] text-slate-400">by {r.pushedBy || 'trainer'}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white">{r.student?.fullName || 'Removed student'}</span>
                          <span className="block font-mono text-[10px] text-slate-400">{r.student?.studentId}</span>
                          {r.student?.degree && <span className="block text-[10px] text-slate-400">{r.student.degree}</span>}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {r.courseName}
                          {r.student?.batches.length ? <span className="block font-mono text-[10px] text-slate-400">{r.student.batches.join(', ')}</span> : null}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {r.student?.phone || '—'}
                          {r.student?.email && <span className="block max-w-[180px] truncate text-[10px] text-slate-400">{r.student.email}</span>}
                        </td>
                        <td className="px-3 py-3 max-w-[260px] text-slate-600 dark:text-slate-300">{r.note || <span className="text-slate-400">—</span>}</td>
                        <td className="px-3 py-3">
                          <select
                            id={`ref-status-${r._id}`}
                            aria-label={`Status for ${r.student?.fullName || 'student'}`}
                            className={`${inputClass} !w-36 !py-1 text-xs`}
                            value={r.status}
                            onChange={(e) => update(r, { status: e.target.value as Status })}
                          >
                            {(Object.keys(STATUS) as Status[]).map((s) => (
                              <option key={s} value={s}>
                                {STATUS[s].text}
                              </option>
                            ))}
                          </select>
                          {r.handledBy && <span className="mt-1 block text-[10px] text-slate-400">by {r.handledBy}</span>}
                        </td>
                        <td className="px-3 py-3">
                          <input
                            id={`ref-note-${r._id}`}
                            className={`${inputClass} !w-56 !py-1 text-xs`}
                            defaultValue={r.placementNote}
                            placeholder="e.g. Sent to TCS drive"
                            onBlur={(e) => e.target.value !== r.placementNote && update(r, { placementNote: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-xs text-slate-500">
              Showing {visible.length} of {rows.length}
            </p>
          </Card>
        </>
      )}
      {toast.node}
    </div>
  );
};
