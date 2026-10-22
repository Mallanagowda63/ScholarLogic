import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Search, UserPlus, Eye, Pencil, CalendarPlus, ArrowRightLeft, RotateCcw, History, X } from 'lucide-react';
import {
  Card,
  EmptyRow,
  PageHeader,
  ProgressBar,
  Spinner,
  StatusBadge,
  StudentFormModal,
  fmtDate,
  fmtMode,
  inputClass,
  primaryBtn,
  statusTone,
  useToast,
} from './tracking/shared';

const ALLOCATION_OPTIONS = ['ALLOCATED', 'WAITING', 'REALLOCATION_REQUIRED', 'PAUSED', 'COMPLETED', 'NOT_ENROLLED'];
const STATUS_OPTIONS = ['ACTIVE', 'ON_HOLD', 'DROPPED', 'REJOINED'];
// Tab value for students with no course / no current subject yet
const NONE = '__NONE__';

export const AdminStudents: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [pendingRegistrations, setPendingRegistrations] = useState(0);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ course: '', subject: '', batch: '', trainer: '', mode: '', status: '', month: '', allocation: '' });

  const load = () => {
    setLoading(true);
    api
      .get('/tracking/students')
      .then((res: any) => setStudents(res.data?.students || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => {
    api.get('/tracking/registrations').then((r: any) => setPendingRegistrations(r.data?.counts?.PENDING || 0)).catch(() => {});
  }, []);

  const options = useMemo(() => {
    const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter(Boolean) as string[])].sort();
    return {
      course: uniq(students.map((s) => s.course?.name)),
      subject: uniq(students.map((s) => s.currentSubject?.name)),
      batch: uniq(students.map((s) => s.currentBatch?.batchCode)),
      trainer: uniq(students.map((s) => s.currentBatch?.trainer?.fullName)),
    };
  }, [students]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return students.filter((s) => {
      if (term) {
        const hay = [s.fullName, s.studentId, s.phone, s.currentBatch?.batchCode].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (f.course && (f.course === NONE ? !!s.course?.name : s.course?.name !== f.course)) return false;
      if (f.subject && (f.subject === NONE ? !!s.currentSubject?.name : s.currentSubject?.name !== f.subject)) return false;
      if (f.batch && s.currentBatch?.batchCode !== f.batch) return false;
      if (f.trainer && s.currentBatch?.trainer?.fullName !== f.trainer) return false;
      if (f.mode && s.mode !== f.mode) return false;
      if (f.status && s.trainingStatus !== f.status) return false;
      if (f.allocation && s.allocationStatus !== f.allocation) return false;
      if (f.month && !(s.joiningDate || '').startsWith(f.month)) return false;
      return true;
    });
  }, [students, q, f]);

  // Separate list per course (tabs) and per subject inside it (chips), with live counts
  const courseTabs = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach((s) => counts.set(s.course?.name || NONE, (counts.get(s.course?.name || NONE) || 0) + 1));
    return [...counts.entries()].sort(([a], [b]) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b)));
  }, [students]);
  const subjectChips = useMemo(() => {
    const inCourse = students.filter((s) => !f.course || (f.course === NONE ? !s.course?.name : s.course?.name === f.course));
    const counts = new Map<string, number>();
    inCourse.forEach((s) => counts.set(s.currentSubject?.name || NONE, (counts.get(s.currentSubject?.name || NONE) || 0) + 1));
    return { total: inCourse.length, list: [...counts.entries()].sort(([a], [b]) => (a === NONE ? 1 : b === NONE ? -1 : a.localeCompare(b))) };
  }, [students, f.course]);
  const pickCourse = (course: string) => setF((x) => ({ ...x, course, subject: '', batch: '' }));
  const pickSubject = (subject: string) => setF((x) => ({ ...x, subject, batch: '' }));
  const tabCls = (active: boolean) =>
    `relative shrink-0 pb-3 ${active ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`;
  const chipCls = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
      active
        ? 'border-brand-600 bg-brand-600 text-white'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-brand-300'
    }`;

  const activeFilters = Object.values(f).filter(Boolean).length;
  const setFilter = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const go = (s: any, action?: string) => navigate(`/admin/students/${s._id}${action ? `?action=${action}` : ''}`);

  const select = (key: keyof typeof f, label: string, opts: string[], labels?: (o: string) => string) => (
    <select className={`${inputClass} !py-1.5 text-xs`} value={f[key]} onChange={setFilter(key)} aria-label={label}>
      <option value="">{label}</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {labels ? labels(o) : o}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Students"
        subtitle="Where every student is right now — course, subject, batch, trainer and progress."
        action={
          <button type="button" className={primaryBtn} onClick={() => setShowNew(true)}>
            <UserPlus className="h-4 w-4" /> New Student
          </button>
        }
      />

      {pendingRegistrations > 0 && (
        <Link
          to="/admin/registrations"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 hover:border-amber-300"
        >
          <span>
            <b>{pendingRegistrations} new Google Form registration{pendingRegistrations > 1 ? 's' : ''}</b> pending verification
          </span>
          <span className="text-xs font-bold">Review →</span>
        </Link>
      )}

      <Card className="p-4 space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, Student ID, phone or batch ID" />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {select('course', 'All courses', [...options.course, ...(courseTabs.some(([c]) => c === NONE) ? [NONE] : [])], (o) => (o === NONE ? 'No course yet' : o))}
          {select('subject', 'All subjects', [...options.subject, ...(subjectChips.list.some(([c]) => c === NONE) ? [NONE] : [])], (o) => (o === NONE ? 'No subject yet' : o))}
          {select('batch', 'All batches', options.batch)}
          {select('trainer', 'All trainers', options.trainer)}
          {select('mode', 'Any mode', ['ONLINE', 'OFFLINE'], fmtMode)}
          {select('status', 'Any status', STATUS_OPTIONS, (o) => o.replace('_', ' '))}
          <input type="month" className={`${inputClass} !py-1.5 text-xs`} value={f.month} onChange={setFilter('month')} aria-label="Joining month" title="Joining month" />
          {select('allocation', 'Allocation', ALLOCATION_OPTIONS, (o) => o.replace(/_/g, ' '))}
        </div>
        {activeFilters > 0 && (
          <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" onClick={() => setF({ course: '', subject: '', batch: '', trainer: '', mode: '', status: '', month: '', allocation: '' })}>
            <X className="h-3.5 w-3.5" /> Clear {activeFilters} filter{activeFilters > 1 ? 's' : ''}
          </button>
        )}
      </Card>

      {!loading && students.length > 0 && (
        <div className="space-y-3">
          <nav className="flex gap-5 overflow-x-auto border-b border-slate-200 dark:border-slate-800 text-sm font-semibold" aria-label="Courses">
            {[['', students.length] as [string, number], ...courseTabs].map(([course, n]) => (
              <button key={course || 'all'} type="button" onClick={() => pickCourse(course)} className={tabCls(f.course === course)}>
                {course === '' ? 'All courses' : course === NONE ? 'No course yet' : course}
                <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${f.course === course ? 'bg-brand-600 text-white' : 'text-slate-400'}`}>{n}</span>
                <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500 ${f.course === course ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            ))}
          </nav>
          {subjectChips.list.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Subjects">
              <button type="button" onClick={() => pickSubject('')} className={chipCls(f.subject === '')}>
                All subjects • {subjectChips.total}
              </button>
              {subjectChips.list.map(([subject, n]) => (
                <button key={subject} type="button" onClick={() => pickSubject(subject)} className={chipCls(f.subject === subject)}>
                  {subject === NONE ? 'No subject yet' : subject} • {n}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  {['Student ID', 'Name', 'Course', 'Mode', 'Current Subject', 'Current Batch', 'Trainer', 'Progress', 'Next Subject', 'Allocation', 'Joined', 'Expected Completion', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.length === 0 ? (
                  <EmptyRow colSpan={14} text={students.length ? 'No students match your filters.' : 'No students yet. Add your first student.'} />
                ) : (
                  visible.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-3 font-mono font-bold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                        <Link to={`/admin/students/${s._id}`}>{s.studentId}</Link>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link to={`/admin/students/${s._id}`} className="font-bold text-slate-900 dark:text-white hover:underline">
                          {s.fullName}
                        </Link>
                        <span className="block text-[10px] text-slate-400">
                          {s.phone || '—'}
                          {s.registrationSource === 'GOOGLE_FORM' && <span className="ml-1.5 rounded bg-emerald-50 px-1 font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Google Form</span>}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">{s.course?.name || '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{fmtMode(s.mode)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {s.currentSubject ? (
                          <>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{s.currentSubject.name}</span>
                            <StatusBadge status={s.currentSubject.status} className="ml-1.5" />
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {s.currentBatch ? (
                          <Link to={`/admin/batches/${s.currentBatch._id}`} className="font-mono font-bold text-slate-800 dark:text-slate-200 hover:text-brand-600">
                            {s.currentBatch.batchCode}
                            <span className="block font-sans text-[10px] font-normal text-slate-400">{s.currentBatch.timing}</span>
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{s.currentBatch?.trainer?.fullName || '—'}</td>
                      <td className="px-3 py-3 w-32">
                        {s.currentSubject ? (
                          <>
                            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                              {s.currentSubject.progress.percentage}%{' '}
                              <span className="font-normal text-slate-400">
                                ({s.currentSubject.progress.completed}/{s.currentSubject.progress.total})
                              </span>
                            </span>
                            <ProgressBar value={s.currentSubject.progress.percentage} tone={statusTone(s.currentSubject.status)} className="mt-1" />
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{s.nextSubject?.name || '—'}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={s.allocationStatus} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{fmtDate(s.joiningDate)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{s.course ? fmtDate(s.expectedCompletion) : '—'}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={s.trainingStatus} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-0.5">
                          {[
                            { icon: Eye, label: 'View', action: undefined },
                            { icon: Pencil, label: 'Edit', action: 'edit' },
                            { icon: CalendarPlus, label: 'Allocate', action: 'allocate' },
                            { icon: ArrowRightLeft, label: 'Move', action: 'move' },
                            { icon: RotateCcw, label: 'Reallocate', action: 'reallocate' },
                            { icon: History, label: 'History', action: 'history' },
                          ].map(({ icon: Icon, label, action }) => (
                            <button
                              key={label}
                              type="button"
                              title={label}
                              aria-label={`${label} ${s.fullName}`}
                              onClick={() => go(s, action)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2.5 text-[11px] text-slate-500">
            Showing {visible.length} of {students.length} students
          </div>
        </Card>
      )}

      {showNew && (
        <StudentFormModal
          onClose={() => setShowNew(false)}
          onDone={(msg, id) => {
            setShowNew(false);
            toast.show(msg);
            if (id) navigate(`/admin/students/${id}?action=allocate`);
            else load();
          }}
        />
      )}
      {toast.node}
    </div>
  );
};
