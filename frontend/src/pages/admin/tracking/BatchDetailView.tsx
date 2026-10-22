import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../services/api';
import { ArrowLeft, UserPlus, Pencil, CheckCircle2, Circle, PlayCircle, Ban, Flag, Search, ClipboardCheck } from 'lucide-react';
import {
  AllocationStatusModal,
  Card,
  ErrorNote,
  Field,
  Modal,
  ProgressBar,
  ReallocateModal,
  Spinner,
  StatusBadge,
  fmtDate,
  fmtMode,
  inputClass,
  linkBtn,
  primaryBtn,
  secondaryBtn,
  statusTone,
  useToast,
} from './shared';

type Role = 'ADMIN' | 'TRAINER';
const ATTENDANCE = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

const EditBatchModal: React.FC<{ batch: any; onClose: () => void; onDone: (m: string) => void }> = ({ batch, onClose, onDone }) => {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [form, setForm] = useState({
    trainerId: batch.trainer?._id || '',
    timing: batch.timing,
    mode: batch.mode,
    expectedEndDate: String(batch.expectedEndDate).slice(0, 10),
    capacity: String(batch.capacity),
    remarks: batch.remarks || '',
  });
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/tracking/trainers').then((r: any) => setTrainers(r.data?.trainers || [])).catch(() => {});
  }, []);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/tracking/batches/${batch._id}`, { ...form, capacity: Number(form.capacity) });
      onDone('Batch updated');
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <Modal title={`Edit ${batch.batchCode}`} subtitle="Change trainer, timing or extend the end date. Every change is logged in batch history." onClose={onClose}>
      <ErrorNote text={error} />
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Trainer">
          <select className={inputClass} value={form.trainerId} onChange={set('trainerId')}>
            <option value="">Unassigned</option>
            {trainers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Timing">
          <input className={inputClass} value={form.timing} onChange={set('timing')} />
        </Field>
        <Field label="Mode">
          <select className={inputClass} value={form.mode} onChange={set('mode')}>
            <option value="OFFLINE">Offline</option>
            <option value="ONLINE">Online</option>
          </select>
        </Field>
        <Field label="Expected end date">
          <input type="date" className={inputClass} value={form.expectedEndDate} onChange={set('expectedEndDate')} />
        </Field>
        <Field label="Capacity">
          <input type="number" min={1} className={inputClass} value={form.capacity} onChange={set('capacity')} />
        </Field>
        <Field label="Remarks">
          <input className={inputClass} value={form.remarks} onChange={set('remarks')} />
        </Field>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
};

const AddStudentModal: React.FC<{ batch: any; onClose: () => void; onDone: (m: string) => void }> = ({ batch, onClose, onDone }) => {
  const [students, setStudents] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    api.get('/tracking/students').then((r: any) => setStudents(r.data?.students || [])).catch(() => {});
  }, []);
  const candidates = students.filter((s) => {
    if (!s.course || ['ON_HOLD', 'DROPPED'].includes(s.trainingStatus)) return false;
    if (s.currentBatch?._id === batch._id) return false;
    const term = q.trim().toLowerCase();
    return !term || [s.fullName, s.studentId, s.phone].join(' ').toLowerCase().includes(term);
  });
  const add = async (s: any) => {
    setBusy(s._id);
    setError('');
    try {
      await api.post(`/tracking/students/${s._id}/allocate`, { batchId: batch._id });
      onDone(`${s.fullName} added to ${batch.batchCode}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Modal title={`Add student to ${batch.batchCode}`} subtitle={`${batch.subject?.name} • ${batch.timing} • ${batch.availableSeats} seats free`} onClose={onClose}>
      <ErrorNote text={error} />
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Student ID or phone" autoFocus />
      </label>
      <ul className="max-h-80 divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
        {candidates.map((s) => (
          <li key={s._id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">{s.fullName}</p>
              <p className="text-slate-500">
                <span className="font-mono">{s.studentId}</span> • {s.course?.name} • prefers {s.preferredTiming || '—'} • {fmtMode(s.mode)}
                {s.currentBatch && <> • now in {s.currentBatch.batchCode}</>}
              </p>
            </div>
            <button type="button" className={primaryBtn} disabled={busy === s._id || batch.availableSeats <= 0} onClick={() => add(s)}>
              {busy === s._id ? 'Adding…' : 'Add'}
            </button>
          </li>
        ))}
        {candidates.length === 0 && <li className="py-6 text-center text-xs text-slate-500">No eligible students found.</li>}
      </ul>
    </Modal>
  );
};

// After-class update: topics ticked + attendance, replaces the paper register
const DailyUpdateForm: React.FC<{ batchId: string; topics: any[]; students: any[]; onDone: (m: string) => void }> = ({ batchId, topics, students, onDone }) => {
  const pending = topics.filter((t) => !t.completed);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    classConducted: true,
    topicTaught: '',
    topicCompleted: true,
    additionalTopic: '',
    nextTopic: pending[1]?.title || '',
    remarks: '',
  });
  const [ticked, setTicked] = useState<string[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [String(s.studentMongoId), 'PRESENT'])));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => setTicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/tracking/batches/${batchId}/updates`, {
        ...form,
        completedTopicIds: form.classConducted ? ticked : [],
        attendance: form.classConducted ? Object.entries(attendance).map(([studentId, status]) => ({ studentId, status })) : [],
      });
      setTicked([]);
      onDone('Class update saved');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <ClipboardCheck className="h-4 w-4 text-brand-500" /> Submit class update
      </h3>
      <p className="mb-4 text-xs text-slate-500">Fill after each class. Ticked topics update batch and student progress automatically.</p>
      <ErrorNote text={error} />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Date">
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Class conducted?">
            <select className={inputClass} value={form.classConducted ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, classConducted: e.target.value === 'yes' })}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Topic completed?">
            <select className={inputClass} value={form.topicCompleted ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, topicCompleted: e.target.value === 'yes' })} disabled={!form.classConducted}>
              <option value="yes">Yes</option>
              <option value="no">No (continues next class)</option>
            </select>
          </Field>
        </div>
        {form.classConducted && (
          <>
            <Field label="Topic taught">
              <input className={inputClass} value={form.topicTaught} onChange={(e) => setForm({ ...form, topicTaught: e.target.value })} placeholder={pending[0]?.title || 'Topic'} />
            </Field>
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Tick topics completed in this class</span>
              {pending.length === 0 ? (
                <p className="text-xs text-emerald-600">All syllabus topics are completed.</p>
              ) : (
                <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-2 sm:grid-cols-2">
                  {pending.map((t) => (
                    <label key={t._id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                      <input type="checkbox" checked={ticked.includes(t._id)} onChange={() => toggle(t._id)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                      {t.order}. {t.title}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Additional topic">
                <input className={inputClass} value={form.additionalTopic} onChange={(e) => setForm({ ...form, additionalTopic: e.target.value })} />
              </Field>
              <Field label="Next topic">
                <input className={inputClass} value={form.nextTopic} onChange={(e) => setForm({ ...form, nextTopic: e.target.value })} />
              </Field>
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Attendance ({students.length})</span>
              {students.length === 0 ? (
                <p className="text-xs text-slate-500">No students in this batch.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  {students.map((s) => {
                    const id = String(s.studentMongoId);
                    return (
                      <li key={id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                        <span>
                          <b className="text-slate-900 dark:text-white">{s.fullName}</b> <span className="font-mono text-slate-400">{s.studentId}</span>
                        </span>
                        <div className="flex gap-1">
                          {ATTENDANCE.map((a) => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => setAttendance((x) => ({ ...x, [id]: a }))}
                              aria-pressed={attendance[id] === a}
                              className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-colors ${
                                attendance[id] === a
                                  ? a === 'PRESENT'
                                    ? 'bg-emerald-600 text-white'
                                    : a === 'ABSENT'
                                      ? 'bg-rose-600 text-white'
                                      : a === 'LATE'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-slate-500 text-white'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                              }`}
                            >
                              {a.charAt(0) + a.slice(1).toLowerCase()}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
        <Field label="Remarks">
          <input className={inputClass} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder={form.classConducted ? '' : 'Why was the class not conducted?'} />
        </Field>
        <div className="flex justify-end">
          <button type="submit" className={primaryBtn} disabled={saving}>
            {saving ? 'Saving…' : 'Save class update'}
          </button>
        </div>
      </form>
    </Card>
  );
};

export const BatchDetailView: React.FC<{ batchId: string; role: Role }> = ({ batchId, role }) => {
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<any>(null);
  const [tab, setTab] = useState<'students' | 'updates' | 'attendance' | 'history'>('students');
  const isAdmin = role === 'ADMIN';
  const base = isAdmin ? '/admin' : '/trainer';

  const load = () =>
    api
      .get(`/tracking/batches/${batchId}`)
      .then((r: any) => setData(r.data))
      .catch((e: any) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const done = (m: string) => {
    setDialog(null);
    toast.show(m);
    load();
  };

  const setStatus = async (status: string, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    try {
      await api.put(`/tracking/batches/${batchId}`, { status });
      done(`Batch marked ${status.toLowerCase()}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Attendance register: dates × students
  const register = useMemo(() => {
    if (!data) return { dates: [] as any[], rows: [] as any[] };
    const sessions = [...data.attendance].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const people = [...data.students, ...data.pastStudents].filter((s, i, arr) => arr.findIndex((x) => String(x.studentMongoId) === String(s.studentMongoId)) === i);
    return {
      dates: sessions,
      rows: people.map((p) => ({
        person: p,
        marks: sessions.map((s: any) => s.records.find((r: any) => String(r.studentId) === String(p.studentMongoId))?.status || null),
      })),
    };
  }, [data]);

  if (error && !data) return <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">{error}</div>;
  if (!data) return <Spinner />;
  const b = data.batch;
  const closed = ['COMPLETED', 'CANCELLED'].includes(b.storedStatus);

  return (
    <div className="space-y-6 pb-12">
      <Link to={`${base}/batches`} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-3.5 w-3.5" /> {isAdmin ? 'All batches' : 'My batches'}
      </Link>
      <ErrorNote text={error} />

      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white">{b.batchCode}</h1>
              <StatusBadge status={b.status} />
            </div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {b.subject?.name} • {b.timing} • {fmtMode(b.mode)} • {b.trainer?.fullName || 'No trainer'}
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {!closed && (
                <button type="button" className={primaryBtn} onClick={() => setDialog({ kind: 'add' })} disabled={b.availableSeats <= 0}>
                  <UserPlus className="h-3.5 w-3.5" /> Add Student
                </button>
              )}
              <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'edit' })}>
                <Pencil className="h-3.5 w-3.5" /> Trainer / Timing / End date
              </button>
              {b.storedStatus === 'UPCOMING' && (
                <button type="button" className={secondaryBtn} onClick={() => setStatus('RUNNING', `Start ${b.batchCode} now?`)}>
                  <PlayCircle className="h-3.5 w-3.5" /> Start
                </button>
              )}
              {!closed && (
                <>
                  <button type="button" className={secondaryBtn} onClick={() => setStatus('COMPLETED', `Complete ${b.batchCode}? All ${b.studentCount} current students will be marked as having completed ${b.subject?.name}.`)}>
                    <Flag className="h-3.5 w-3.5" /> Complete Batch
                  </button>
                  <button type="button" className={secondaryBtn} onClick={() => setStatus('CANCELLED', `Cancel ${b.batchCode}? Current students will be flagged for reallocation.`)}>
                    <Ban className="h-3.5 w-3.5" /> Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800 pt-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Start date', fmtDate(b.startDate)],
            ['Planned end', fmtDate(b.expectedEndDate)],
            ['Expected completion', `${fmtDate(b.estimatedCompletion)}${b.estimateBasis === 'PACE' ? ' (pace)' : ''}`],
            ['Classes conducted', b.classesConducted],
            ['Capacity', `${b.studentCount} / ${b.capacity}`],
            ['Available seats', b.availableSeats],
          ].map(([l, v]) => (
            <div key={l as string}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{l}</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Syllabus progress</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {b.progress.completed} / {b.progress.total} topics • {b.progress.percentage}%
              {b.avgTopicsPerClass > 0 && <span className="font-normal text-slate-400"> • {b.avgTopicsPerClass} topics/class</span>}
            </span>
          </div>
          <ProgressBar value={b.progress.percentage} tone={statusTone(b.status)} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!isAdmin && !closed && <DailyUpdateForm key={data.updates.length} batchId={batchId} topics={data.topics} students={data.students} onDone={done} />}

          <nav className="flex gap-5 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
            {([
              ['students', `Students (${data.students.length})`],
              ['updates', `Class updates (${data.updates.length})`],
              ['attendance', 'Attendance'],
              ['history', 'Batch history'],
            ] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={`relative pb-3 ${tab === k ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                {label}
                <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500 ${tab === k ? 'opacity-100' : 'opacity-0'}`} />
              </button>
            ))}
          </nav>

          {tab === 'students' && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      {['Student', 'Student ID', 'Attendance', 'Progress', 'Status', 'Mode', 'Remarks', ...(isAdmin ? ['Actions'] : [])].map((h) => (
                        <th key={h} className="px-3 py-3">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.students.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-500">
                          No students in this batch yet.
                        </td>
                      </tr>
                    )}
                    {data.students.map((s: any) => (
                      <tr key={s.allocationId}>
                        <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                          {isAdmin ? <Link to={`/admin/students/${s.studentMongoId}`} className="hover:underline">{s.fullName}</Link> : s.fullName}
                        </td>
                        <td className="px-3 py-3 font-mono">{s.studentId}</td>
                        <td className="px-3 py-3">{s.attendance.total ? `${s.attendance.attended}/${s.attendance.total} (${s.attendance.percentage}%)` : '—'}</td>
                        <td className="px-3 py-3 w-32">
                          <span className="text-[11px] font-bold">{s.progress.percentage}%</span>
                          <ProgressBar value={s.progress.percentage} className="mt-1" />
                        </td>
                        <td className="px-3 py-3"><StatusBadge status={s.status} /></td>
                        <td className="px-3 py-3">{fmtMode(s.mode)}</td>
                        <td className="px-3 py-3 max-w-[160px] truncate text-slate-500">{s.remarks || s.reason || '—'}</td>
                        {isAdmin && (
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className={linkBtn} onClick={() => setDialog({ kind: 'realloc', mode: 'MOVE', s })}>Move</button>
                              <button type="button" className={linkBtn} onClick={() => setDialog({ kind: 'realloc', mode: 'REALLOCATE', s })}>Reallocate</button>
                              <button type="button" className={linkBtn} onClick={() => setDialog({ kind: 'status', s })}>Remove / Missed</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.pastStudents.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-4">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Previously in this batch</p>
                  <ul className="space-y-1.5 text-xs">
                    {data.pastStudents.map((s: any) => (
                      <li key={s.allocationId} className="flex flex-wrap items-center gap-2">
                        {isAdmin ? <Link to={`/admin/students/${s.studentMongoId}`} className="font-semibold hover:underline">{s.fullName}</Link> : <span className="font-semibold">{s.fullName}</span>}
                        <span className="font-mono text-slate-400">{s.studentId}</span>
                        <StatusBadge status={s.status} />
                        <span className="text-slate-500">{fmtDate(s.allocationDate)} → {fmtDate(s.endDate)}{s.reason ? ` • ${s.reason}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {tab === 'updates' && (
            <Card className="p-5">
              {data.updates.length === 0 ? (
                <p className="text-xs text-slate-500">No class updates yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.updates.map((u: any) => (
                    <li key={u._id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{fmtDate(u.date)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${u.classConducted ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'}`}>
                          {u.classConducted ? 'Class conducted' : 'No class'}
                        </span>
                      </div>
                      {u.topicTaught && <p className="mt-1"><b>Taught:</b> {u.topicTaught} {u.topicCompleted ? '✓ completed' : '(continues)'}</p>}
                      {u.completedTopicIds?.length > 0 && <p><b>Topics ticked:</b> {u.completedTopicIds.length}</p>}
                      {u.additionalTopic && <p><b>Additional:</b> {u.additionalTopic}</p>}
                      {u.nextTopic && <p><b>Next:</b> {u.nextTopic}</p>}
                      {u.remarks && <p className="text-slate-500">{u.remarks}</p>}
                      <p className="mt-1 text-[10px] text-slate-400">by {u.trainerId?.fullName || 'Trainer'}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === 'attendance' && (
            <Card className="overflow-hidden">
              {register.dates.length === 0 ? (
                <p className="p-5 text-xs text-slate-500">No attendance marked yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                      <tr>
                        <th className="sticky left-0 bg-slate-50 dark:bg-slate-800 px-3 py-3">Student</th>
                        {register.dates.map((d: any) => (
                          <th key={d._id} className="px-2 py-3 text-center whitespace-nowrap">{new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {register.rows.map(({ person, marks }) => (
                        <tr key={String(person.studentMongoId)}>
                          <td className="sticky left-0 bg-white dark:bg-slate-900 px-3 py-2 font-semibold whitespace-nowrap">{person.fullName}</td>
                          {marks.map((m: string | null, i: number) => (
                            <td key={i} className="px-2 py-2 text-center">
                              {m ? <StatusBadge status={m} /> : <span className="text-slate-300">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {tab === 'history' && (
            <Card className="p-5">
              <ul className="space-y-2 text-xs">
                {data.history.map((h: any, i: number) => (
                  <li key={i} className="flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="w-24 shrink-0 text-slate-400">{fmtDate(h.at)}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{h.action.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="text-slate-500">{h.details}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card className="h-fit p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">{b.subject?.name} syllabus</h3>
          <ol className="max-h-[32rem] space-y-1 overflow-y-auto">
            {data.topics.map((t: any) => (
              <li key={t._id} className="flex items-center gap-2 text-xs">
                {t.completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />}
                <span className={t.completed ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'}>
                  {t.order}. {t.title}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {dialog?.kind === 'edit' && <EditBatchModal batch={b} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'add' && <AddStudentModal batch={b} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'realloc' && (
        <ReallocateModal
          allocationId={dialog.s.allocationId}
          subjectId={b.subject?._id}
          currentBatchCode={b.batchCode}
          currentBatchId={b._id}
          studentName={dialog.s.fullName}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === 'status' && (
        <AllocationStatusModal allocationId={dialog.s.allocationId} batchCode={b.batchCode} studentName={dialog.s.fullName} onClose={() => setDialog(null)} onDone={done} />
      )}
      {toast.node}
    </div>
  );
};
