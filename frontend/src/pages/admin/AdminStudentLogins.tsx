import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, Eye, EyeOff, KeyRound, ScanLine, Search, XCircle } from 'lucide-react';
import { api, assetUrl } from '../../services/api';
import { Card, EmptyRow, Modal, PageHeader, Spinner, inputClass, primaryBtn, secondaryBtn, useToast } from './tracking/shared';

// Admin → Student Login & ID Card: check the ID on a student's card and give them their login.
// Separate from eSSL verification: every student is here, machine code linked or not.

interface StudentLogin {
  _id: string;
  fullName: string;
  studentId: string;
  loginId: string;
  machineCode: string;
  email: string;
  phone: string;
  course: string;
  mode: string;
  status: string;
  joined?: string;
  loginActive: boolean;
  photoUrl: string;
  password: string | null;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const AdminStudentLogins: React.FC = () => {
  const toast = useToast();
  const [students, setStudents] = useState<StudentLogin[] | null>(null);
  const [code, setCode] = useState('');
  const [checked, setChecked] = useState<{ ok: true; student: StudentLogin } | { ok: false; message: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [q, setQ] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const [confirmNew, setConfirmNew] = useState<StudentLogin | null>(null);
  const [created, setCreated] = useState<{ student: StudentLogin; loginId: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api
      .get('/admin/student-logins')
      .then((res: any) => setStudents(res.data.students))
      .catch((e: any) => toast.show(e.message));
  useEffect(() => {
    load();
    codeRef.current?.focus();
  }, []);

  // A barcode / QR scanner types the ID and presses Enter, so this works for scanning too
  const check = async (e?: React.FormEvent, value = code) => {
    e?.preventDefault();
    const id = value.trim();
    if (!id) return;
    setChecking(true);
    try {
      const res: any = await api.get(`/admin/student-logins/check/${encodeURIComponent(id)}`);
      setChecked({ ok: true, student: res.data.student });
    } catch (err: any) {
      setChecked({ ok: false, message: err.message });
    } finally {
      setChecking(false);
      setCode('');
      codeRef.current?.focus();
    }
  };

  const generate = async (s: StudentLogin) => {
    setBusy(true);
    try {
      const res: any = await api.post(`/admin/student-logins/${s._id}/generate-password`, {});
      const { loginId, password } = res.data;
      setConfirmNew(null);
      setCreated({ student: s, loginId, password });
      setStudents((list) => (list || []).map((x) => (x._id === s._id ? { ...x, password } : x)));
      setChecked((c) => (c && c.ok && c.student._id === s._id ? { ok: true, student: { ...c.student, password } } : c));
    } catch (err: any) {
      toast.show(err.message);
    } finally {
      setBusy(false);
    }
  };
  // No password on record: create straight away. Replacing a known password asks first.
  const askGenerate = (s: StudentLogin) => (s.password ? setConfirmNew(s) : generate(s));

  const copy = (s: { fullName: string }, loginId: string, password: string) =>
    navigator.clipboard
      .writeText(`ScholarLogic login for ${s.fullName}\nWebsite: https://scholarlogiclms.in/login\nLogin ID: ${loginId}\nPassword: ${password}`)
      .then(() => toast.show('Login copied'))
      .catch(() => toast.show('Could not copy'));

  const toggle = (id: string) =>
    setShown((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (students || []).filter((s) => {
      if (onlyMissing && s.password) return false;
      if (!term) return true;
      return [s.fullName, s.studentId, s.machineCode, s.phone, s.course].join(' ').toLowerCase().includes(term);
    });
  }, [students, q, onlyMissing]);
  const missing = (students || []).filter((s) => !s.password).length;

  const PasswordCell: React.FC<{ s: StudentLogin }> = ({ s }) =>
    s.password ? (
      <span className="inline-flex items-center gap-1">
        <span className="font-mono">{shown.has(s._id) ? s.password : '••••••••'}</span>
        <button type="button" title={shown.has(s._id) ? 'Hide' : 'Show'} onClick={() => toggle(s._id)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          {shown.has(s._id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button type="button" title="Copy login ID and password" onClick={() => copy(s, s.loginId, s.password!)} className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </span>
    ) : (
      <span className="text-amber-600">Not on record</span>
    );

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Student Login & ID Card"
        subtitle="Type or scan the ID printed on a student's card to check it, and give them their login. This is separate from eSSL verification."
      />

      <Card className="p-5 space-y-4">
        <form onSubmit={check} className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block flex-1">
            <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={codeRef}
              id="card-code"
              className={`${inputClass} pl-9 font-mono text-base`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ID on the card, e.g. SCLR248"
              autoComplete="off"
            />
          </label>
          <button type="submit" className={primaryBtn} disabled={checking || !code.trim()}>
            <CheckCircle2 className="h-4 w-4" /> {checking ? 'Checking…' : 'Check ID card'}
          </button>
        </form>

        {checked && !checked.ok && (
          <p className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <XCircle className="h-5 w-5 shrink-0" /> {checked.message}
          </p>
        )}

        {checked && checked.ok && (
          <div className="space-y-3">
            <p
              className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${
                checked.student.status === 'DROPPED' || !checked.student.loginActive
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Valid card: {checked.student.fullName} ({checked.student.studentId})
              {checked.student.status !== 'ACTIVE' && ` • status ${checked.student.status.replace('_', ' ').toLowerCase()}`}
              {!checked.student.loginActive && ' • login switched off'}
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Looks like the ID card, so it's easy to compare */}
              <div className="flex gap-4 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 dark:border-brand-900 dark:from-brand-950/40 dark:to-slate-900">
                {checked.student.photoUrl ? (
                  <img src={assetUrl(checked.student.photoUrl)} alt={checked.student.fullName} className="h-24 w-20 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-24 w-20 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-2xl font-black text-white">{initials(checked.student.fullName)}</span>
                )}
                <dl className="min-w-0 space-y-0.5 text-xs">
                  <dd className="truncate text-base font-extrabold text-slate-900 dark:text-white">{checked.student.fullName}</dd>
                  <dd className="font-mono font-bold text-brand-700 dark:text-brand-300">{checked.student.studentId}</dd>
                  {checked.student.machineCode && checked.student.machineCode !== checked.student.studentId && (
                    <dd className="text-slate-500">Machine code: {checked.student.machineCode}</dd>
                  )}
                  <dd className="text-slate-600 dark:text-slate-300">
                    {checked.student.course || 'No course yet'}
                    {checked.student.mode && ` • ${checked.student.mode === 'ONLINE' ? 'Online' : 'Offline'}`}
                  </dd>
                  {checked.student.phone && <dd className="text-slate-500">📞 {checked.student.phone}</dd>}
                  {checked.student.joined && <dd className="text-slate-500">Joined {new Date(checked.student.joined).toLocaleDateString()}</dd>}
                </dl>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <KeyRound className="h-4 w-4 text-brand-600" /> Login
                </p>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <span className="text-slate-500">Login ID</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{checked.student.loginId}</span>
                  <span className="text-slate-500">Password</span>
                  <PasswordCell s={checked.student} />
                </div>
                <button type="button" className={checked.student.password ? secondaryBtn : primaryBtn} disabled={busy} onClick={() => askGenerate(checked.student)}>
                  <KeyRound className="h-4 w-4" /> {checked.student.password ? 'Create a new password' : 'Generate automatic password'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="login-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Student ID, phone or course" />
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> Only students without a password on record ({missing})
          </label>
        </div>

        {!students ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/60">
                <tr>
                  {['Student', 'Student ID', 'Course', 'Login ID', 'Password', ''].map((h) => (
                    <th key={h} className="px-3 py-3 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.length === 0 ? (
                  <EmptyRow colSpan={6} text="No students match." />
                ) : (
                  visible.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-white">{s.fullName}</td>
                      <td className="px-3 py-2.5 font-mono">{s.studentId}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{s.course || '—'}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold">{s.loginId}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <PasswordCell s={s} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => check(undefined, s.studentId)}>
                          <ScanLine className="h-3.5 w-3.5" /> Check card
                        </button>{' '}
                        {!s.password && (
                          <button type="button" className={`${primaryBtn} !px-2.5 !py-1 text-xs`} disabled={busy} onClick={() => generate(s)}>
                            <KeyRound className="h-3.5 w-3.5" /> Generate password
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {confirmNew && (
        <Modal title={`New password for ${confirmNew.fullName}?`} subtitle="The old password stops working." onClose={() => !busy && setConfirmNew(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">Use this when the student forgot their password. Give them the new one straight away.</p>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" className={secondaryBtn} disabled={busy} onClick={() => setConfirmNew(null)}>
              Cancel
            </button>
            <button type="button" className={primaryBtn} disabled={busy} onClick={() => generate(confirmNew)}>
              <KeyRound className="h-4 w-4" /> {busy ? 'Creating…' : 'Create new password'}
            </button>
          </div>
        </Modal>
      )}

      {created && (
        <Modal title="Password created" subtitle={`${created.student.fullName} • give this to the student`} onClose={() => setCreated(null)}>
          <div className="space-y-1 rounded-xl bg-slate-50 p-4 font-mono text-sm dark:bg-slate-800/60">
            <p>
              Login ID: <b>{created.loginId}</b>
            </p>
            <p>
              Password: <b>{created.password}</b>
            </p>
          </div>
          <p className="pt-2 text-xs text-slate-500">They sign in at scholarlogiclms.in/login. You can see this password again on this page any time.</p>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" className={secondaryBtn} onClick={() => copy(created.student, created.loginId, created.password)}>
              <Copy className="h-4 w-4" /> Copy
            </button>
            <button type="button" className={primaryBtn} onClick={() => setCreated(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
};
