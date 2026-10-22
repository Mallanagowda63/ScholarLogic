import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Plus, Search } from 'lucide-react';
import {
  Card,
  EmptyRow,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  ProgressBar,
  Spinner,
  StatusBadge,
  fmtDate,
  fmtMode,
  inputClass,
  primaryBtn,
  secondaryBtn,
  statusTone,
} from './tracking/shared';

const CreateBatchModal: React.FC<{ onClose: () => void; onDone: (id: string) => void }> = ({ onClose, onDone }) => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [form, setForm] = useState({ subjectId: '', trainerId: '', mode: 'OFFLINE', timing: '', startDate: new Date().toISOString().slice(0, 10), expectedEndDate: '', capacity: '25', batchCode: '', remarks: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/tracking/subjects').then((r: any) => setSubjects(r.data?.subjects || [])).catch(() => {});
    api.get('/tracking/trainers').then((r: any) => setTrainers(r.data?.trainers || [])).catch(() => {});
  }, []);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res: any = await api.post('/tracking/batches', { ...form, capacity: Number(form.capacity), expectedEndDate: form.expectedEndDate || undefined });
      onDone(res.data.batch._id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Create batch" subtitle="Batch ID is generated from the subject code (e.g. PY-B03) unless you enter one." onClose={onClose}>
      <ErrorNote text={error} />
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Subject" required>
          <select className={inputClass} value={form.subjectId} onChange={set('subjectId')} required>
            <option value="">Select subject</option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trainer">
          <select className={inputClass} value={form.trainerId} onChange={set('trainerId')}>
            <option value="">Assign later</option>
            {trainers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Timing" required>
          <input className={inputClass} value={form.timing} onChange={set('timing')} placeholder="e.g. 7-8 AM" required />
        </Field>
        <Field label="Mode">
          <select className={inputClass} value={form.mode} onChange={set('mode')}>
            <option value="OFFLINE">Offline</option>
            <option value="ONLINE">Online</option>
          </select>
        </Field>
        <Field label="Start date" required>
          <input type="date" className={inputClass} value={form.startDate} onChange={set('startDate')} required />
        </Field>
        <Field label="Expected end date" hint="Defaults to subject duration">
          <input type="date" className={inputClass} value={form.expectedEndDate} onChange={set('expectedEndDate')} />
        </Field>
        <Field label="Capacity">
          <input type="number" min={1} className={inputClass} value={form.capacity} onChange={set('capacity')} />
        </Field>
        <Field label="Batch ID" hint="Optional">
          <input className={inputClass} value={form.batchCode} onChange={set('batchCode')} placeholder="Auto" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Remarks">
            <input className={inputClass} value={form.remarks} onChange={set('remarks')} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn} disabled={saving}>
            {saving ? 'Creating…' : 'Create batch'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const AdminBatches: React.FC = () => {
  const navigate = useNavigate();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [subject, setSubject] = useState('');

  useEffect(() => {
    api
      .get('/tracking/batches')
      .then((res: any) => setBatches(res.data?.batches || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const subjects = useMemo(() => [...new Set(batches.map((b) => b.subject?.name).filter(Boolean))].sort(), [batches]);
  const visible = batches.filter((b) => {
    const term = q.trim().toLowerCase();
    if (term && ![b.batchCode, b.subject?.name, b.trainer?.fullName, b.timing].filter(Boolean).join(' ').toLowerCase().includes(term)) return false;
    if (status && b.status !== status) return false;
    if (subject && b.subject?.name !== subject) return false;
    return true;
  });
  const counts = ['RUNNING', 'UPCOMING', 'DELAYED', 'COMPLETED'].map((s) => [s, batches.filter((b) => b.status === s).length] as const);

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Batches"
        subtitle="Every batch with its trainer, timing, seats and topic progress."
        action={
          <button type="button" className={primaryBtn} onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> Create Batch
          </button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setStatus('')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${!status ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
          All {batches.length}
        </button>
        {counts.map(([s, n]) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {s.charAt(0) + s.slice(1).toLowerCase()} {n}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search batch ID, subject, trainer or timing" />
        </label>
        <select className={`${inputClass} sm:w-48`} value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  {['Batch ID', 'Subject', 'Trainer', 'Mode', 'Timing', 'Start', 'Expected End', 'Seats', 'Progress', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.length === 0 ? (
                  <EmptyRow colSpan={10} text={batches.length ? 'No batches match.' : 'No batches yet. Create the first one.'} />
                ) : (
                  visible.map((b) => (
                    <tr key={b._id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40" onClick={() => navigate(`/admin/batches/${b._id}`)}>
                      <td className="px-3 py-3 font-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                        <Link to={`/admin/batches/${b._id}`} onClick={(e) => e.stopPropagation()}>
                          {b.batchCode}
                        </Link>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200">{b.subject?.name}</td>
                      <td className="px-3 py-3">{b.trainer?.fullName || <span className="text-amber-600">Unassigned</span>}</td>
                      <td className="px-3 py-3">{fmtMode(b.mode)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{b.timing}</td>
                      <td className="px-3 py-3 whitespace-nowrap">{fmtDate(b.startDate)}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {fmtDate(b.expectedEndDate)}
                        {b.estimateBasis === 'PACE' && <span className="block text-[10px] text-slate-400">At current pace: {fmtDate(b.estimatedCompletion)}</span>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <b>{b.studentCount}</b> / {b.capacity}
                        <span className="block text-[10px] text-slate-400">{b.availableSeats} free</span>
                      </td>
                      <td className="px-3 py-3 w-36">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          {b.progress.completed}/{b.progress.total} • {b.progress.percentage}%
                        </span>
                        <ProgressBar value={b.progress.percentage} tone={statusTone(b.status)} className="mt-1" />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showNew && <CreateBatchModal onClose={() => setShowNew(false)} onDone={(id) => navigate(`/admin/batches/${id}`)} />}
    </div>
  );
};
