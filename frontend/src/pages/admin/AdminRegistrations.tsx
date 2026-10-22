import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Search, Eye, Pencil, CheckCircle2, XCircle, CalendarPlus, RotateCcw, AlertTriangle, FileSpreadsheet, Copy, RefreshCw } from 'lucide-react';
import {
  Card,
  EmptyRow,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  Spinner,
  fmtDate,
  inputClass,
  primaryBtn,
  secondaryBtn,
  useToast,
} from './tracking/shared';

type Tab = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALL' | 'EXISTING' | 'FAILED';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pending Verification', cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900' },
  VERIFIED: { label: 'Verified', cls: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/50 dark:text-brand-300 dark:border-brand-900' },
  ALLOCATED: { label: 'Allocated', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900' },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900' },
};
const Pill: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_STYLE[status] || STATUS_STYLE.PENDING;
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
};
const timeAgo = (d: string) => {
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours} h ago` : new Date(d).toLocaleDateString();
};

const fmtDateTime = (d?: string) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

const squash = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const matchCourse = (courses: any[], answer?: string) => {
  const a = squash(answer).replace(/analyst$/, 'analytics');
  if (!a) return '';
  return courses.find((c) => squash(c.name) === a || squash(c.code) === a || squash(c.name).startsWith(a))?._id || '';
};

const randomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + '@1';
};

// Shared form for Edit and Verify
const RegistrationForm: React.FC<{
  reg: any;
  courses: any[];
  mode: 'edit' | 'verify';
  suggestedStudentId?: string | null;
  onClose: () => void;
  onDone: (msg: string, studentId?: string) => void;
}> = ({ reg, courses, mode, suggestedStudentId, onClose, onDone }) => {
  const [form, setForm] = useState({
    fullName: reg.fullName || '',
    phone: reg.phone || '',
    email: reg.email || '',
    address: reg.address || '',
    // Pre-select the course the student picked on the form if it wasn't linked on import
    courseId: reg.courseId?._id || matchCourse(courses, reg.requestedCourse),
    mode: reg.preferredMode || 'OFFLINE',
    dateOfBirth: reg.dateOfBirth || '',
    tenthPercentage: reg.tenthPercentage || '',
    twelfthPercentage: reg.twelfthPercentage || '',
    degree: reg.degree || '',
    degreeStream: reg.degreeStream || '',
    degreePercentage: reg.degreePercentage || '',
    passOutYear: reg.passOutYear || '',
    college: reg.college || '',
    joiningDate: (reg.joiningDate || new Date().toISOString()).slice(0, 10),
    remarks: reg.comments || '',
    studentId: '',
    password: randomPassword(),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'edit') {
        await api.put(`/tracking/registrations/${reg._id}`, {
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          address: form.address,
          courseId: form.courseId || null,
          preferredMode: form.mode,
          joiningDate: form.joiningDate,
          comments: form.remarks,
          dateOfBirth: form.dateOfBirth,
          tenthPercentage: form.tenthPercentage,
          twelfthPercentage: form.twelfthPercentage,
          degree: form.degree,
          degreeStream: form.degreeStream,
          degreePercentage: form.degreePercentage,
          passOutYear: form.passOutYear,
          college: form.college,
        });
        onDone('Registration updated');
      } else {
        const res: any = await api.post(`/tracking/registrations/${reg._id}/verify`, form);
        onDone(`Verified — Student ID ${res.data.student.studentId}`, res.data.student._id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the password stays visible in the field
    }
  };

  return (
    <Modal
      title={mode === 'verify' ? `Verify ${reg.fullName}` : `Edit ${reg.fullName}`}
      subtitle={
        mode === 'verify'
          ? 'Check the details, assign the course, and create the student account. Batch allocation is the next step.'
          : 'Correct the form answers before verification.'
      }
      onClose={onClose}
    >
      <ErrorNote text={error} />
      {reg.mappingWarnings?.length > 0 && (
        <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300">
          {reg.mappingWarnings.map((w: string) => (
            <p key={w} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name" required>
            <input id="reg-name" className={inputClass} value={form.fullName} onChange={set('fullName')} required />
          </Field>
        </div>
        <Field label="Phone">
          <input id="reg-phone" className={inputClass} value={form.phone} onChange={set('phone')} inputMode="tel" />
        </Field>
        <Field label="Email" hint="Optional">
          <input id="reg-email" className={inputClass} type="email" value={form.email} onChange={set('email')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address">
            <input id="reg-address" className={inputClass} value={form.address} onChange={set('address')} />
          </Field>
        </div>
        <Field label="Course" required={mode === 'verify'} hint={reg.requestedCourse ? `Form answer: "${reg.requestedCourse}"` : undefined}>
          <select id="reg-course" className={inputClass} value={form.courseId} onChange={set('courseId')} required={mode === 'verify'}>
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mode" hint={reg.preferredModeRaw ? `Form answer: "${reg.preferredModeRaw}"` : undefined}>
          <select id="reg-mode" className={inputClass} value={form.mode} onChange={set('mode')}>
            <option value="OFFLINE">Offline</option>
            <option value="ONLINE">Online</option>
          </select>
        </Field>
        <Field label="Joining date">
          <input id="reg-joining" className={inputClass} type="date" value={form.joiningDate} onChange={set('joiningDate')} />
        </Field>
        <Field label="Date of birth">
          <input id="reg-dob" className={inputClass} type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="College & university">
            <input id="reg-college" className={inputClass} value={form.college} onChange={set('college')} />
          </Field>
        </div>
        <Field label="Degree">
          <input id="reg-degree" className={inputClass} value={form.degree} onChange={set('degree')} placeholder="e.g. B.E Or B.Tech" />
        </Field>
        <Field label="Degree stream">
          <input id="reg-stream" className={inputClass} value={form.degreeStream} onChange={set('degreeStream')} placeholder="e.g. CSE" />
        </Field>
        <Field label="Degree percentage / CGPA">
          <input id="reg-degree-pct" className={inputClass} value={form.degreePercentage} onChange={set('degreePercentage')} inputMode="decimal" />
        </Field>
        <Field label="Pass-out year">
          <input id="reg-passout" className={inputClass} value={form.passOutYear} onChange={set('passOutYear')} inputMode="numeric" />
        </Field>
        <Field label="10th percentage">
          <input id="reg-10th" className={inputClass} value={form.tenthPercentage} onChange={set('tenthPercentage')} inputMode="decimal" />
        </Field>
        <Field label="12th percentage">
          <input id="reg-12th" className={inputClass} value={form.twelfthPercentage} onChange={set('twelfthPercentage')} inputMode="decimal" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Comments / remarks">
            <textarea id="reg-remarks" className={inputClass} rows={2} value={form.remarks} onChange={set('remarks')} />
          </Field>
        </div>
        {mode === 'verify' && (
          <>
            <Field
              label="Student ID"
              hint={suggestedStudentId ? `Leave blank to use ${suggestedStudentId} (first name + course + number)` : 'Leave blank to auto-generate: FIRSTNAME-CC-NN, e.g. MOHIT-DA-01'}
            >
              <input id="reg-studentid" className={inputClass} value={form.studentId} onChange={set('studentId')} placeholder={suggestedStudentId || 'e.g. MOHIT-DA-01'} />
            </Field>
            <Field label="Initial password" required hint="Share with the student; they log in with Student ID + password">
              <div className="flex gap-2">
                <input id="reg-password" className={inputClass} value={form.password} onChange={set('password')} required minLength={6} />
                <button type="button" className={secondaryBtn} onClick={copyPassword} title="Copy password">
                  <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </Field>
          </>
        )}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn} disabled={saving}>
            {saving ? 'Saving…' : mode === 'verify' ? 'Verify & create student' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ViewModal: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api.get(`/tracking/registrations/${id}`).then((r: any) => setData(r.data)).catch(() => {});
  }, [id]);
  const reg = data?.registration;
  return (
    <Modal title={reg ? reg.fullName : 'Registration'} subtitle={reg ? `Submitted ${fmtDateTime(reg.submittedAt)} via ${reg.source === 'GOOGLE_FORM' ? 'Google Form' : 'admin'}` : undefined} onClose={onClose} wide>
      {!reg ? (
        <Spinner />
      ) : (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap gap-2">
            <Pill status={reg.status} />
            {reg.studentId && (
              <Link to={`/admin/students/${reg.studentId._id}`} className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">
                Open student {reg.studentId.studentId} →
              </Link>
            )}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              ['Registered by (Google account)', reg.submittedByEmail || 'Not collected by the form'],
              ['Phone', reg.phone || '—'],
              ['Email', reg.email || '—'],
              ['Address', reg.address || '—'],
              ['Course (form answer)', reg.requestedCourse || '—'],
              ['Course (mapped)', reg.courseId?.name || 'Not recognised'],
              ['Date of birth', reg.dateOfBirth ? fmtDate(reg.dateOfBirth) : '—'],
              ['College & university', reg.college || '—'],
              ['Degree', [reg.degree, reg.degreeStream].filter(Boolean).join(' • ') || '—'],
              ['Degree percentage / CGPA', reg.degreePercentage || '—'],
              ['Pass-out year', reg.passOutYear || '—'],
              ['10th / 12th percentage', `${reg.tenthPercentage || '—'} / ${reg.twelfthPercentage || '—'}`],
              [
                'Photo',
                reg.photoUrl ? (
                  <a href={reg.photoUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                    Open photo in Google Drive ↗
                  </a>
                ) : (
                  '—'
                ),
              ],
              ['Joining date', fmtDate(reg.joiningDate)],
              ['Comments', reg.comments || '—'],
              ['Submissions', `${reg.submissionCount} (last ${fmtDateTime(reg.lastSubmittedAt)})`],
            ].map(([l, v]) => (
              <div key={String(l)}>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{l}</dt>
                <dd className="text-slate-900 dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
          {reg.rejectionReason && <p className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">Rejected: {reg.rejectionReason}</p>}
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Raw form answers ({data.submissions.length})</h3>
            <div className="space-y-2">
              {data.submissions.map((s: any) => (
                <details key={s._id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
                    {fmtDateTime(s.submittedAt)} • {s.processingStatus} {s.resultNote ? `— ${s.resultNote}` : ''}
                  </summary>
                  <table className="mt-2 w-full">
                    <tbody>
                      {(s.rawPayload?.answers || []).map((a: any, i: number) => (
                        <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-1 pr-3 text-slate-500">{a.question}</td>
                          <td className="py-1 text-slate-900 dark:text-white">{String(a.answer ?? '') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

const RejectModal: React.FC<{ reg: any; onClose: () => void; onDone: (m: string) => void }> = ({ reg, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    try {
      await api.post(`/tracking/registrations/${reg._id}/reject`, { reason });
      onDone(`${reg.fullName} rejected`);
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <Modal title={`Reject ${reg.fullName}`} subtitle="The registration is kept for reference. If the student submits the form again it returns to Pending." onClose={onClose}>
      <ErrorNote text={error} />
      <Field label="Reason" required>
        <input id="reject-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate enquiry, not interested" />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className={secondaryBtn} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={primaryBtn} disabled={!reason.trim()} onClick={submit}>
          Reject
        </button>
      </div>
    </Modal>
  );
};

// Form responses from people who are already students (linked to their profile, no new registration)
const ExistingStudentResponses: React.FC<{ rows: any[] }> = ({ rows }) => (
  <Card className="overflow-hidden">
    <p className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
      These people filled the form but are <b>already students</b>, so no new registration was created. Their response is linked to their existing profile; batches and progress are unchanged.
    </p>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
          <tr>
            {['Name on form', 'Registered by', 'Phone', 'Email', 'Course', 'College', 'Submitted At', 'Existing student'].map((h) => (
              <th key={h} className="px-3 py-3 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} text="No form responses from existing students." />
          ) : (
            rows.map((r) => (
              <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="font-bold text-slate-900 dark:text-white">{r.formName || '—'}</span>
                  {r.responseCount > 1 && <span className="block text-[10px] text-slate-400">Submitted {r.responseCount}×</span>}
                </td>
                <td className="px-3 py-3 max-w-[200px] truncate">{r.submittedByEmail || <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-3 whitespace-nowrap">{r.phone || '—'}</td>
                <td className="px-3 py-3 max-w-[180px] truncate">{r.email || '—'}</td>
                <td className="px-3 py-3 whitespace-nowrap">{r.course || '—'}</td>
                <td className="px-3 py-3 max-w-[200px] truncate" title={r.college || undefined}>{r.college || '—'}</td>
                <td className="px-3 py-3 whitespace-nowrap">{fmtDateTime(r.submittedAt)}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <Link to={`/admin/students/${r.student._id}`} className={`${secondaryBtn} !px-2.5 !py-1`}>
                    {r.student.studentId}
                    {r.student.fullName ? ` • ${r.student.fullName}` : ''} →
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </Card>
);

const FailedSubmissions: React.FC<{ onChanged: () => void; toast: (m: string) => void }> = ({ onChanged, toast }) => {
  const [rows, setRows] = useState<any[] | null>(null);
  const load = () => api.get('/tracking/registrations/submissions', { params: { status: 'FAILED' } }).then((r: any) => setRows(r.data?.submissions || []));
  useEffect(() => {
    load();
  }, []);
  const retry = async (id: string) => {
    try {
      const res: any = await api.post(`/tracking/registrations/submissions/${id}/retry`);
      toast(res.data.status === 'FAILED' ? `Still failing: ${res.data.error}` : 'Submission processed');
      load();
      onChanged();
    } catch (e: any) {
      toast(e.message);
    }
  };
  if (!rows) return <Spinner />;
  return (
    <Card className="divide-y divide-slate-100 dark:divide-slate-800">
      {rows.length === 0 && <p className="p-8 text-center text-xs text-slate-500">No failed submissions. Every form response was processed.</p>}
      {rows.map((s) => (
        <div key={s._id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-xs">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 dark:text-white">{fmtDateTime(s.submittedAt)}</p>
            <p className="text-rose-600 dark:text-rose-400">{s.errorMessage}</p>
            <p className="mt-1 truncate text-slate-500">
              {(s.rawPayload?.answers || [])
                .filter((a: any) => a.answer)
                .map((a: any) => `${a.question}: ${a.answer}`)
                .join(' • ')}
            </p>
          </div>
          <button type="button" className={secondaryBtn} onClick={() => retry(s._id)}>
            <RotateCcw className="h-3.5 w-3.5" /> Retry processing
          </button>
        </div>
      ))}
    </Card>
  );
};

export const AdminRegistrations: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [regs, setRegs] = useState<any[] | null>(null);
  const [existingResponses, setExistingResponses] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [courses, setCourses] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('PENDING');
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<any>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<any>(null);

  const load = () =>
    api.get('/tracking/registrations').then((r: any) => {
      setRegs(r.data?.registrations || []);
      setExistingResponses(r.data?.existingStudentResponses || []);
      setCounts(r.data?.counts || {});
    });
  const loadSyncStatus = () => api.get('/tracking/registrations/sync-status').then((r: any) => setSyncStatus(r.data)).catch(() => {});

  useEffect(() => {
    load();
    loadSyncStatus();
    api.get('/tracking/courses').then((r: any) => setCourses(r.data?.courses || [])).catch(() => {});
    // Pick up registrations imported by the background auto-sync while this page is open
    const timer = window.setInterval(() => {
      load();
      loadSyncStatus();
    }, 60000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSync = async () => {
    setSyncing(true);
    try {
      const res: any = await api.post('/tracking/registrations/sync');
      const d = res.data;
      const existing: string[] = d.existingStudents || [];
      const parts = [d.created ? `${d.created} new registration${d.created > 1 ? 's' : ''} imported` : 'No new registrations'];
      // Responses from people who are already students are linked to them, not listed here
      if (existing.length) parts.push(`${existing.length} response${existing.length > 1 ? 's are' : ' is'} from existing student${existing.length > 1 ? 's' : ''} ${existing.join(', ')} (see "Already students")`);
      toast.show(parts.join(' • '));
      await load();
    } catch (e: any) {
      toast.show(e.message);
    } finally {
      setSyncing(false);
      loadSyncStatus();
    }
  };

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (regs || []).filter((r) => {
      if (tab === 'VERIFIED' && r.verificationStatus !== 'VERIFIED') return false;
      if ((tab === 'PENDING' || tab === 'REJECTED') && r.verificationStatus !== tab) return false;
      return !term || [r.fullName, r.phone, r.email, r.requestedCourse, r.college, r.submittedByEmail].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [regs, tab, q]);

  const openVerify = async (reg: any) => {
    const res: any = await api.get(`/tracking/registrations/${reg._id}`);
    setDialog({ kind: 'verify', reg, suggestedStudentId: res.data.suggestedStudentId });
  };
  const done = (msg: string, studentId?: string) => {
    setDialog(null);
    toast.show(msg);
    if (studentId) navigate(`/admin/students/${studentId}?action=allocate`);
    else load();
  };

  const tabs: [Tab, string, number | undefined][] = [
    ['PENDING', 'Pending Verification', counts.PENDING || 0],
    ['VERIFIED', 'Verified', counts.VERIFIED || 0],
    ['REJECTED', 'Rejected', counts.REJECTED || 0],
    ['ALL', 'All', regs?.length],
    ['EXISTING', 'Already students', counts.EXISTING_STUDENTS || 0],
    ['FAILED', 'Failed submissions', counts.FAILED_SUBMISSIONS || 0],
  ];

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="New Registrations"
        subtitle="Students who filled the Google Form. Verify each one to create their Student ID, then allocate a batch."
        action={
          <div className="flex flex-col items-end gap-1">
            <button type="button" className={primaryBtn} onClick={runSync} disabled={syncing || syncStatus?.configured === false}>
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Syncing…' : 'Sync from Google Form'}
            </button>
            <span className="text-[11px] text-slate-500">
              {syncStatus?.configured === false ? (
                <span className="text-amber-600">Sync not set up — add GOOGLE_FORM_SYNC_URL to backend .env</span>
              ) : syncStatus?.lastSync ? (
                <span className={syncStatus.lastSync.ok ? '' : 'text-rose-600'}>
                  <FileSpreadsheet className="mr-1 inline h-3 w-3" />
                  Last synced {timeAgo(syncStatus.lastSync.at)}
                  {syncStatus.lastSync.ok ? '' : ' — failed'}
                  {syncStatus.intervalMinutes ? ` • auto every ${syncStatus.intervalMinutes} min` : ''}
                </span>
              ) : syncStatus?.intervalMinutes ? (
                `Auto-sync every ${syncStatus.intervalMinutes} min`
              ) : null}
            </span>
          </div>
        }
      />

      <nav className="flex gap-5 overflow-x-auto border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
        {tabs.map(([key, label, n]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`relative shrink-0 pb-3 ${tab === key ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            {label}
            {n !== undefined && <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${key === 'PENDING' && n > 0 ? 'bg-amber-500 text-white' : key === 'FAILED' && n > 0 ? 'bg-rose-500 text-white' : 'text-slate-400'}`}>{n}</span>}
            <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500 ${tab === key ? 'opacity-100' : 'opacity-0'}`} />
          </button>
        ))}
      </nav>

      {tab === 'FAILED' ? (
        <FailedSubmissions onChanged={load} toast={toast.show} />
      ) : tab === 'EXISTING' ? (
        <ExistingStudentResponses rows={existingResponses} />
      ) : (
        <>
          {tab === 'PENDING' && existingResponses.length > 0 && (
            <button
              type="button"
              onClick={() => setTab('EXISTING')}
              className="flex w-full items-center gap-2 rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50 dark:bg-brand-950/40 px-4 py-3 text-left text-xs text-brand-800 dark:text-brand-200 hover:bg-brand-100 dark:hover:bg-brand-950/70"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <b>{existingResponses.length}</b> form response{existingResponses.length > 1 ? 's are' : ' is'} from {existingResponses.length > 1 ? 'people who are' : 'someone who is'} already a student (
                {existingResponses.slice(0, 3).map((r) => r.student.studentId).join(', ')}
                {existingResponses.length > 3 ? '…' : ''}), so {existingResponses.length > 1 ? 'they are' : 'it is'} not listed here. <u>View them</u>
              </span>
            </button>
          )}
          <label className="relative block max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="reg-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, email, course or college" />
          </label>
          {!regs ? (
            <Spinner />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                      {['Name', 'Registered by', 'Phone', 'Email', 'Course', 'College', 'Degree', 'Pass-out', 'Submitted At', 'Verification', 'Allocation', 'Actions'].map((h) => (
                        <th key={h} className={`px-3 py-3 whitespace-nowrap ${h === 'Actions' ? 'sticky right-0 bg-slate-50 dark:bg-slate-800 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)]' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visible.length === 0 ? (
                      <EmptyRow colSpan={11} text={tab === 'PENDING' ? 'No new registrations waiting. New Google Form responses appear here automatically.' : 'Nothing here.'} />
                    ) : (
                      visible.map((r) => (
                        <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="font-bold text-slate-900 dark:text-white">{r.fullName}</span>
                            {r.verificationStatus === 'PENDING' && Date.now() - new Date(r.lastSubmittedAt).getTime() < 3 * 86400000 && (
                              <span className="ml-1.5 rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">New</span>
                            )}
                            {r.submissionCount > 1 && <span className="block text-[10px] text-slate-400">Submitted {r.submissionCount}×</span>}
                          </td>
                          <td className="px-3 py-3 max-w-[200px] truncate" title={r.submittedByEmail || 'The form did not collect the Google account'}>
                            {r.submittedByEmail || <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">{r.phone || '—'}</td>
                          <td className="px-3 py-3 max-w-[160px] truncate">{r.email || '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {r.courseId?.name || <span className="text-amber-600">{r.requestedCourse || 'Not chosen'}</span>}
                            {r.mappingWarnings?.length > 0 && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" aria-label={r.mappingWarnings.join('; ')} />}
                          </td>
                          <td className="px-3 py-3 max-w-[180px] truncate" title={r.college || undefined}>{r.college || '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{[r.degree, r.degreeStream].filter(Boolean).join(' • ') || '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{r.passOutYear || '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{fmtDateTime(r.lastSubmittedAt)}</td>
                          <td className="px-3 py-3"><Pill status={r.status} /></td>
                          <td className="px-3 py-3 whitespace-nowrap text-[11px]">
                            {r.allocationStatus === 'ALLOCATED' ? <span className="font-semibold text-emerald-600">Allocated</span> : <span className="text-slate-500">Waiting for Allocation</span>}
                          </td>
                          <td className="sticky right-0 bg-white dark:bg-slate-900 px-3 py-3 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.15)]">
                            <div className="flex items-center gap-1">
                              <button type="button" title="View" aria-label={`View ${r.fullName}`} onClick={() => setDialog({ kind: 'view', id: r._id })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800">
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              {r.verificationStatus !== 'VERIFIED' && (
                                <>
                                  <button type="button" title="Edit / Assign course" aria-label={`Edit ${r.fullName}`} onClick={() => setDialog({ kind: 'edit', reg: r })} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button type="button" className={`${primaryBtn} !px-2.5 !py-1`} onClick={() => openVerify(r)}>
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                                  </button>
                                  {r.verificationStatus === 'PENDING' && (
                                    <button type="button" title="Reject" aria-label={`Reject ${r.fullName}`} onClick={() => setDialog({ kind: 'reject', reg: r })} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                                      <XCircle className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                              {r.verificationStatus === 'VERIFIED' && r.studentId && (
                                <Link to={`/admin/students/${r.studentId._id}${r.allocationStatus === 'ALLOCATED' ? '' : '?action=allocate'}`} className={`${secondaryBtn} !px-2.5 !py-1`}>
                                  <CalendarPlus className="h-3.5 w-3.5" /> {r.allocationStatus === 'ALLOCATED' ? r.studentId.studentId : 'Allocate Batch'}
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {dialog?.kind === 'view' && <ViewModal id={dialog.id} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <RegistrationForm reg={dialog.reg} courses={courses} mode="edit" onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'verify' && (
        <RegistrationForm reg={dialog.reg} courses={courses} mode="verify" suggestedStudentId={dialog.suggestedStudentId} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === 'reject' && <RejectModal reg={dialog.reg} onClose={() => setDialog(null)} onDone={done} />}
      {toast.node}
    </div>
  );
};
