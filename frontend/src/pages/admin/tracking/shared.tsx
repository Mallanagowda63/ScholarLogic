import React, { useEffect, useId, useState } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import { api } from '../../../services/api';

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtMode = (m?: string) => (m === 'ONLINE' ? 'Online' : m === 'OFFLINE' ? 'Offline' : '—');

export const humanize = (s?: string | null) =>
  s ? s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : '—';

// ---------------------------------------------------------------------------
// Status colours (Green completed, Blue attending, Grey upcoming, Orange reallocation, Red dropped/missed)
// ---------------------------------------------------------------------------

type Tone = 'green' | 'blue' | 'grey' | 'orange' | 'red' | 'purple' | 'amber';

const toneClasses: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  blue: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:border-brand-900',
  grey: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  orange: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900',
  red: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
  purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-900',
  amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
};

export const toneFill: Record<Tone, string> = {
  green: 'bg-emerald-500',
  blue: 'bg-brand-500',
  grey: 'bg-slate-400',
  orange: 'bg-orange-500',
  red: 'bg-rose-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
};

const STATUS_TONE: Record<string, Tone> = {
  COMPLETED: 'green',
  ATTENDING: 'blue',
  RE_ATTENDING: 'purple',
  BATCH_ALLOCATED: 'blue',
  ALLOCATED: 'blue',
  NOT_STARTED: 'grey',
  UPCOMING: 'grey',
  WAITING: 'amber',
  NOT_ENROLLED: 'grey',
  REALLOCATION_REQUIRED: 'orange',
  MOVED: 'orange',
  MISSED: 'red',
  DROPPED: 'red',
  ON_HOLD: 'amber',
  PAUSED: 'amber',
  ACTIVE: 'green',
  REJOINED: 'purple',
  RUNNING: 'blue',
  DELAYED: 'orange',
  CANCELLED: 'red',
  PRESENT: 'green',
  LATE: 'amber',
  ABSENT: 'red',
  EXCUSED: 'grey',
};

export const statusTone = (status?: string): Tone => STATUS_TONE[status || ''] || 'grey';

const STATUS_LABEL: Record<string, string> = {
  RE_ATTENDING: 'Re-Attending',
  BATCH_ALLOCATED: 'Batch Allocated',
  REALLOCATION_REQUIRED: 'Reallocation Required',
  WAITING: 'Waiting',
  PAUSED: 'Paused',
  NOT_ENROLLED: 'Not Enrolled',
};

export const StatusBadge: React.FC<{ status?: string; className?: string }> = ({ status, className = '' }) => (
  <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClasses[statusTone(status)]} ${className}`}>
    {STATUS_LABEL[status || ''] || humanize(status)}
  </span>
);

export const ProgressBar: React.FC<{ value: number; tone?: Tone; className?: string }> = ({ value, tone = 'blue', className = '' }) => (
  <div className={`h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${className}`}>
    <div className={`h-full rounded-full ${toneFill[tone]} transition-[width] duration-500`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ${className}`}>{children}</div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{title}</h1>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Spinner: React.FC = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
  </div>
);

export const EmptyRow: React.FC<{ colSpan: number; text: string }> = ({ colSpan, text }) => (
  <tr>
    <td colSpan={colSpan} className="p-8 text-center text-xs text-slate-500">
      {text}
    </td>
  </tr>
);

export const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:[color-scheme:dark]';

export const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors';
export const secondaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors';
export const linkBtn = 'text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-40';

export const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string }> = ({ label, required, children, hint }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
  </label>
);

// ---------------------------------------------------------------------------
// Modal + toast
// ---------------------------------------------------------------------------

export const Modal: React.FC<{ title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({
  title,
  subtitle,
  onClose,
  children,
  wide,
}) => {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`my-10 w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-5">
          <div>
            <h2 id={titleId} className="text-base font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

export const ErrorNote: React.FC<{ text?: string }> = ({ text }) =>
  text ? (
    <div className="mb-3 flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {text}
    </div>
  ) : null;

export const useToast = () => {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);
  const node = toast ? (
    <div role="status" className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl">
      <Check className="h-4 w-4" /> {toast}
    </div>
  ) : null;
  return { show: setToast, node };
};

// ---------------------------------------------------------------------------
// Action dialogs
// ---------------------------------------------------------------------------

interface StudentRef {
  _id: string;
  fullName: string;
  studentId: string;
}

// Shows every batch for the subject with seats so admin can pick one
const BatchPicker: React.FC<{ subjectId?: string; excludeBatchId?: string; value: string; onChange: (id: string) => void }> = ({
  subjectId,
  excludeBatchId,
  value,
  onChange,
}) => {
  const [batches, setBatches] = useState<any[] | null>(null);
  useEffect(() => {
    api
      .get('/tracking/batches', { params: subjectId ? { subjectId } : {} })
      .then((res: any) => setBatches(res.data?.batches || []))
      .catch(() => setBatches([]));
  }, [subjectId]);

  if (!batches) return <p className="py-6 text-center text-xs text-slate-500">Loading batches…</p>;
  const open = batches.filter((b) => !['COMPLETED', 'CANCELLED'].includes(b.status) && b._id !== excludeBatchId);
  if (open.length === 0) return <p className="py-6 text-center text-xs text-slate-500">No open batches for this subject. Create one on the Batches page.</p>;

  return (
    <div className="max-h-80 space-y-2 overflow-y-auto">
      {open.map((b) => {
        const full = b.availableSeats <= 0;
        const selected = value === b._id;
        return (
          <button
            type="button"
            key={b._id}
            disabled={full}
            onClick={() => onChange(b._id)}
            className={`w-full rounded-xl border p-3 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              selected ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{b.batchCode}</span>
              <StatusBadge status={b.status} />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300 sm:grid-cols-3">
              <span>⏰ {b.timing}</span>
              <span>👤 {b.trainer?.fullName || 'No trainer'}</span>
              <span>{fmtMode(b.mode)}</span>
              <span>
                Seats: <b>{b.availableSeats}</b> / {b.capacity} ({b.studentCount} students)
              </span>
              <span>Start {fmtDate(b.startDate)}</span>
              <span>End {fmtDate(b.expectedEndDate)}</span>
            </div>
            {full && <span className="mt-1 block font-semibold text-rose-500">Batch is full</span>}
          </button>
        );
      })}
    </div>
  );
};

export const AllocateModal: React.FC<{
  student: StudentRef;
  subjects: { subjectId: string; name: string }[];
  defaultSubjectId?: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ student, subjects, defaultSubjectId, onClose, onDone }) => {
  const [subjectId, setSubjectId] = useState(defaultSubjectId || subjects[0]?.subjectId || '');
  const [batchId, setBatchId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/tracking/students/${student._id}/allocate`, { batchId, remarks });
      onDone(`${student.fullName} allocated`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Allocate batch" subtitle={`${student.fullName} • ${student.studentId}`} onClose={onClose}>
      <ErrorNote text={error} />
      {subjects.length === 0 ? (
        <p className="text-xs text-slate-500">This student has no course subjects. Assign a course first (Edit).</p>
      ) : (
        <div className="space-y-4">
          <Field label="Subject">
            <select className={inputClass} value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setBatchId(''); }}>
              {subjects.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Available batches</span>
            <BatchPicker subjectId={subjectId} value={batchId} onChange={setBatchId} />
          </div>
          <Field label="Remarks">
            <input className={inputClass} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
          </Field>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={primaryBtn} disabled={!batchId || saving} onClick={submit}>
              {saving ? 'Allocating…' : 'Allocate Student'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export const ReallocateModal: React.FC<{
  allocationId: string;
  subjectId: string;
  currentBatchCode?: string;
  currentBatchId?: string;
  studentName: string;
  mode: 'MOVE' | 'REALLOCATE';
  alreadyClosed?: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ allocationId, subjectId, currentBatchCode, currentBatchId, studentName, mode, alreadyClosed, onClose, onDone }) => {
  const [batchId, setBatchId] = useState('');
  const [oldStatus, setOldStatus] = useState(mode === 'MOVE' ? 'MOVED' : 'MISSED');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/tracking/allocations/${allocationId}/reallocate`, { newBatchId: batchId, oldStatus, reason, remarks });
      onDone(`${studentName} ${mode === 'MOVE' ? 'moved' : 'reallocated'}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={mode === 'MOVE' ? 'Move to another batch' : 'Reallocate batch'}
      subtitle={`${studentName} • from ${currentBatchCode || 'previous batch'}. The old allocation is kept in history.`}
      onClose={onClose}
    >
      <ErrorNote text={error} />
      <div className="space-y-4">
        {!alreadyClosed && (
          <Field label={`Mark ${currentBatchCode || 'old batch'} as`}>
            <select className={inputClass} value={oldStatus} onChange={(e) => setOldStatus(e.target.value)}>
              <option value="MOVED">Moved (timing / preference change)</option>
              <option value="MISSED">Missed (student could not attend)</option>
              <option value="REALLOCATION_REQUIRED">Reallocation required</option>
            </select>
          </Field>
        )}
        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">New batch</span>
          <BatchPicker subjectId={subjectId} excludeBatchId={currentBatchId} value={batchId} onChange={setBatchId} />
        </div>
        <Field label="Reason" required>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Student unavailable at 7 AM" />
        </Field>
        <Field label="Remarks">
          <input className={inputClass} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryBtn} disabled={!batchId || !reason.trim() || saving} onClick={submit}>
            {saving ? 'Saving…' : mode === 'MOVE' ? 'Move Student' : 'Reallocate Student'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const AllocationStatusModal: React.FC<{
  allocationId: string;
  batchCode?: string;
  studentName: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ allocationId, batchCode, studentName, onClose, onDone }) => {
  const [status, setStatus] = useState('MISSED');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/tracking/allocations/${allocationId}/status`, { status, reason });
      onDone(`${batchCode} marked ${humanize(status).toLowerCase()}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Update ${batchCode} allocation`} subtitle={studentName} onClose={onClose}>
      <ErrorNote text={error} />
      <div className="space-y-4">
        <Field label="Status">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="MISSED">Missed</option>
            <option value="REALLOCATION_REQUIRED">Reallocation required</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </Field>
        <Field label="Reason">
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryBtn} disabled={saving} onClick={submit}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const TrainingStatusModal: React.FC<{
  student: StudentRef;
  current: string;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ student, current, onClose, onDone }) => {
  const paused = current === 'ON_HOLD' || current === 'DROPPED';
  const [status, setStatus] = useState(paused ? 'REJOINED' : 'ON_HOLD');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/tracking/students/${student._id}/status`, { status, reason, remarks });
      onDone(`Status updated to ${humanize(status)}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title="Change student status" subtitle={`${student.fullName} • currently ${humanize(current)}`} onClose={onClose}>
      <ErrorNote text={error} />
      <div className="space-y-4">
        <Field label="New status">
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            {paused ? (
              <option value="REJOINED">Rejoin (restore previous progress)</option>
            ) : (
              <>
                <option value="ON_HOLD">On Hold</option>
                <option value="DROPPED">Dropped</option>
              </>
            )}
            <option value="ACTIVE">Active</option>
          </select>
        </Field>
        {!paused && status !== 'ACTIVE' && (
          <p className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-[11px] text-amber-800 dark:text-amber-300">
            The student's current batch seat will be released. Completed subjects and topic progress are kept, and the student can rejoin later.
          </p>
        )}
        <Field label="Reason" required>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Remarks">
          <input className={inputClass} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryBtn} disabled={!reason.trim() || saving} onClick={submit}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const ModeChangeModal: React.FC<{ student: StudentRef; current: string; onClose: () => void; onDone: (msg: string) => void }> = ({
  student,
  current,
  onClose,
  onDone,
}) => {
  const next = current === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/tracking/students/${student._id}/mode`, { mode: next, reason });
      onDone(`Mode changed to ${fmtMode(next)}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal title={`Change mode: ${fmtMode(current)} → ${fmtMode(next)}`} subtitle={`${student.fullName}. Previous mode period is kept in history.`} onClose={onClose}>
      <ErrorNote text={error} />
      <Field label="Reason">
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Relocated to another city" />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={secondaryBtn} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={primaryBtn} disabled={saving} onClick={submit}>
          Change to {fmtMode(next)}
        </button>
      </div>
    </Modal>
  );
};

// Admission form (Google-Form style). Email optional; login is Student ID + password.
export const StudentFormModal: React.FC<{ initial?: any; onClose: () => void; onDone: (msg: string, id?: string) => void }> = ({ initial, onClose, onDone }) => {
  const editing = !!initial;
  const [courses, setCourses] = useState<any[]>([]);
  const [form, setForm] = useState({
    fullName: initial?.fullName || '',
    phone: initial?.phone || '',
    email: initial?.email || '',
    courseId: initial?.enrollment?.courseId || '',
    mode: initial?.enrollment?.mode || 'OFFLINE',
    preferredTiming: initial?.enrollment?.preferredTiming || '',
    joiningDate: (initial?.enrollment?.joiningDate || new Date().toISOString()).slice(0, 10),
    remarks: initial?.enrollment?.remarks || '',
    studentId: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/tracking/courses').then((res: any) => setCourses(res.data?.courses || [])).catch(() => {});
  }, []);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const { studentId: _s, password: _p, mode: _m, ...rest } = form;
        await api.put(`/tracking/students/${initial._id}`, rest);
        onDone('Student updated', initial._id);
      } else {
        const res: any = await api.post('/tracking/students', form);
        onDone(`Student ${res.data.student.studentId} created`, res.data.student._id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit student' : 'New student admission'} subtitle={editing ? initial.studentId : 'Preferred timing is only a preference — admin confirms the final batch.'} onClose={onClose}>
      <ErrorNote text={error} />
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name" required>
            <input className={inputClass} value={form.fullName} onChange={set('fullName')} required />
          </Field>
        </div>
        <Field label="Phone" required>
          <input className={inputClass} value={form.phone} onChange={set('phone')} required inputMode="tel" />
        </Field>
        <Field label="Email" hint="Optional">
          <input className={inputClass} type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Course">
          <select className={inputClass} value={form.courseId} onChange={set('courseId')}>
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {!editing && (
          <Field label="Mode">
            <select className={inputClass} value={form.mode} onChange={set('mode')}>
              <option value="OFFLINE">Offline</option>
              <option value="ONLINE">Online</option>
            </select>
          </Field>
        )}
        <Field label="Preferred timing">
          <input className={inputClass} value={form.preferredTiming} onChange={set('preferredTiming')} placeholder="e.g. 7-8 AM" />
        </Field>
        <Field label="Joining date">
          <input className={inputClass} type="date" value={form.joiningDate} onChange={set('joiningDate')} />
        </Field>
        {!editing && (
          <>
            <Field label="Student ID" hint="Leave blank to auto-generate (e.g. MOHIT-DA-01)">
              <input className={inputClass} value={form.studentId} onChange={set('studentId')} placeholder="e.g. MOHIT-DA-01" />
            </Field>
            <Field label="Initial password" required hint="Student logs in with Student ID + this password">
              <input className={inputClass} type="text" value={form.password} onChange={set('password')} required minLength={6} />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Field label="Remarks">
            <textarea className={inputClass} rows={2} value={form.remarks} onChange={set('remarks')} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create student'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
