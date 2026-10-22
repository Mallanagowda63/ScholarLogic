import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, CheckCircle2, Eye, Search, Send } from 'lucide-react';
import { api } from '../../services/api';
import { Card, EmptyRow, ErrorNote, Field, Modal, PageHeader, Spinner, inputClass, primaryBtn, secondaryBtn, useToast } from '../admin/tracking/shared';

// Trainer's student list with "Push to placement": the placement team is notified and sees the student under their course

interface Row {
  _id: string;
  studentId: string;
  fullName: string;
  phone: string;
  course: string;
  batches: string[];
  inMyBatch: boolean;
  referral: { _id: string; status: 'NEW' | 'IN_PROGRESS' | 'PLACED' | 'CLOSED'; pushedAt: string; pushedBy: string; note: string } | null;
}

const REFERRAL_LABEL: Record<string, { text: string; cls: string }> = {
  NEW: { text: 'With placement team', cls: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300' },
  IN_PROGRESS: { text: 'Placement in progress', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  PLACED: { text: 'Placed', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  CLOSED: { text: 'Closed by placement', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};
const isOpen = (r: Row) => r.referral?.status === 'NEW' || r.referral?.status === 'IN_PROGRESS';

export const TrainerStudents: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'MINE' | 'ALL' | 'PUSHED'>('MINE');
  const [course, setCourse] = useState('');
  const [pushing, setPushing] = useState<Row | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get('/placement-referrals/students')
      .then((res: any) => {
        const list: Row[] = res.data.students;
        setRows(list);
        // Trainers without batch students yet start on the full list
        if (!list.some((r) => r.inMyBatch)) setScope((s) => (s === 'MINE' ? 'ALL' : s));
      })
      .catch((e: any) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const courses = useMemo(() => [...new Set((rows || []).map((r) => r.course).filter(Boolean))].sort(), [rows]);
  const mine = (rows || []).filter((r) => r.inMyBatch).length;
  const pushedCount = (rows || []).filter((r) => r.referral).length;

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (rows || []).filter((r) => {
      if (scope === 'MINE' && !r.inMyBatch) return false;
      if (scope === 'PUSHED' && !r.referral) return false;
      if (course && (course === '__NONE__' ? r.course : r.course !== course)) return false;
      return !term || [r.fullName, r.studentId, r.phone, ...r.batches].join(' ').toLowerCase().includes(term);
    });
  }, [rows, q, scope, course]);

  const push = async () => {
    if (!pushing) return;
    setBusy(true);
    try {
      const res: any = await api.post('/placement-referrals', { studentId: pushing._id, note });
      toast.show(res.message);
      setPushing(null);
      setNote('');
      load();
    } catch (e: any) {
      toast.show(e.message);
    } finally {
      setBusy(false);
    }
  };

  const tab = (key: typeof scope, text: string, n: number) => (
    <button
      type="button"
      onClick={() => setScope(key)}
      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${scope === key ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
    >
      {text} ({n})
    </button>
  );

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Students"
        subtitle="Push students who are ready for jobs to the placement team. They are notified and see the student under the student's course."
      />
      <ErrorNote text={error} />

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
            {tab('MINE', 'My batches', mine)}
            {tab('ALL', 'All students', rows?.length || 0)}
            {tab('PUSHED', 'Pushed to placement', pushedCount)}
          </div>
          <select id="trainer-course" className={`${inputClass} !w-48 !py-1.5 text-xs`} value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__NONE__">No course yet</option>
          </select>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="trainer-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Student ID, phone or batch" />
        </label>
      </Card>

      {!rows ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  {['Student ID', 'Name', 'Course', 'Batch', 'Phone', 'Placement', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.length === 0 ? (
                  <EmptyRow colSpan={7} text={scope === 'MINE' ? 'No students in your batches yet. Switch to "All students".' : 'No students match.'} />
                ) : (
                  visible.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-3 font-mono font-bold text-brand-600 dark:text-brand-400 whitespace-nowrap">{r.studentId}</td>
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">{r.fullName || '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{r.course || <span className="text-slate-400">No course yet</span>}</td>
                      <td className="px-3 py-3 font-mono whitespace-nowrap">{r.batches.join(', ') || <span className="font-sans text-slate-400">—</span>}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{r.phone || '—'}</td>
                      <td className="px-3 py-3">
                        {r.referral ? (
                          <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${REFERRAL_LABEL[r.referral.status].cls}`}>
                            {REFERRAL_LABEL[r.referral.status].text}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {r.referral && (
                          <span className="block text-[10px] text-slate-400">
                            {new Date(r.referral.pushedAt).toLocaleDateString()}
                            {r.referral.pushedBy ? ` by ${r.referral.pushedBy}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {isOpen(r) ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Pushed
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={`${primaryBtn} !px-2.5 !py-1`}
                              onClick={() => {
                                setPushing(r);
                                setNote('');
                              }}
                            >
                              <Send className="h-3.5 w-3.5" /> {r.referral ? 'Push again' : 'Push to placement'}
                            </button>
                          )}
                          <Link to={`/trainer/students/${r._id}`} className={`${secondaryBtn} !px-2.5 !py-1`}>
                            <Eye className="h-3.5 w-3.5" /> Profile
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-xs text-slate-500">
            Showing {visible.length} of {rows.length} students
          </p>
        </Card>
      )}

      {pushing && (
        <Modal title={`Push ${pushing.fullName || pushing.studentId} to placement`} subtitle="The placement team gets a notification and sees this student under their course." onClose={() => setPushing(null)}>
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">
                {pushing.fullName} <span className="font-mono text-brand-600">{pushing.studentId}</span>
              </p>
              <p className="text-slate-500">
                {pushing.course || 'No course yet'}
                {pushing.batches.length ? ` • ${pushing.batches.join(', ')}` : ''}
              </p>
            </div>
            <Field label="Note for the placement team" hint="Optional: strengths, skills, preferred roles">
              <textarea id="push-note" className={inputClass} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Strong in SQL and Power BI, good communication. Ready for data analyst roles." />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryBtn} onClick={() => setPushing(null)}>
                Cancel
              </button>
              <button type="button" className={primaryBtn} disabled={busy} onClick={push}>
                <Briefcase className="h-3.5 w-3.5" /> {busy ? 'Pushing…' : 'Push to placement'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
};
