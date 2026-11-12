import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, Download, Eye, EyeOff, KeyRound, Loader2, Mail, MessageCircle, ScanLine, Search, Send, XCircle } from 'lucide-react';
import { api, assetUrl } from '../../services/api';
import { EmailResultPopup } from '../../components/EmailResultPopup';
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
  lastLoginAt: string | null;
  loginCount: number;
  hasLoggedIn: boolean;
  loginSharedAt: string | null;
}

type LoginFilter = 'ALL' | 'NEVER' | 'LOGGED' | 'NOPASS' | 'EMAIL' | 'NOEMAIL';

interface EmailResult {
  _id: string;
  fullName: string;
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  reason?: string;
  loginSharedAt?: string;
}

const SITE = 'https://scholarlogiclms.in/login';

// Indian mobile numbers for WhatsApp: 10 digits get 91 in front; returns '' when it is not a usable number
const waNumber = (phone: string) => {
  const d = (phone || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10) return `91${d}`;
  if (d.length === 12 && d.startsWith('91')) return d;
  return '';
};

const loginMessage = (name: string, loginId: string, password: string) =>
  `Hello ${name},\nYour ScholarLogic login:\nWebsite: ${SITE}\nLogin ID: ${loginId}\nPassword: ${password}\nPlease log in and keep this password private.\n- ScholarLogic`;

const shortDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

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
  const [filter, setFilter] = useState<LoginFilter>('ALL');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState<{ done: number; total: number } | null>(null);
  const [emailResults, setEmailResults] = useState<EmailResult[] | null>(null);
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
      .writeText(loginMessage(s.fullName, loginId, password))
      .then(() => toast.show('Login copied'))
      .catch(() => toast.show('Could not copy'));

  // Opens WhatsApp (app or web) with the message typed; the admin presses Send there
  const sendWhatsApp = (s: StudentLogin, password = s.password) => {
    const num = waNumber(s.phone);
    if (!num || !password) return;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(loginMessage(s.fullName, s.loginId, password))}`, '_blank', 'noopener');
    api
      .post(`/admin/student-logins/${s._id}/shared`, { via: 'WHATSAPP' })
      .then((res: any) => setStudents((list) => (list || []).map((x) => (x._id === s._id ? { ...x, loginSharedAt: res.data.loginSharedAt } : x))))
      .catch(() => undefined);
  };

  const WhatsAppBtn: React.FC<{ s: StudentLogin; password?: string | null; big?: boolean }> = ({ s, password = s.password, big }) => {
    const num = waNumber(s.phone);
    const why = !password ? 'Generate a password first' : !num ? 'No valid mobile number for this student' : 'Send login on WhatsApp';
    return (
      <button
        type="button"
        title={why}
        disabled={!password || !num}
        onClick={() => sendWhatsApp(s, password)}
        className={`inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 ${big ? 'px-4 py-2 text-sm' : 'px-2.5 py-1 text-xs'}`}
      >
        <MessageCircle className={big ? 'h-4 w-4' : 'h-3.5 w-3.5'} /> WhatsApp
      </button>
    );
  };

  // Spreadsheet of the students in the current list (opens in Excel), e.g. to print login slips
  const downloadList = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Name', 'Student ID', 'Login ID', 'Password', 'Phone', 'Course', 'Logged in', 'Last login', 'Login sent'],
      ...visible.map((s) => [s.fullName, s.studentId, s.loginId, s.password || '', s.phone, s.course, s.hasLoggedIn ? 'Yes' : 'No', shortDate(s.lastLoginAt), shortDate(s.loginSharedAt)]),
    ];
    const blob = new Blob(['﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ScholarLogic-student-logins-${filter.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pick = (id: string) =>
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Sends in groups of 20 so the page can show progress; each student gets only their own login
  const sendEmails = async () => {
    const chosen = (students || []).filter((s) => selected.has(s._id));
    const ready = chosen.filter((s) => s.email && s.password);
    setConfirmEmail(false);
    setEmailResults(null);
    setEmailProgress({ done: 0, total: ready.length });
    const all: EmailResult[] = chosen
      .filter((s) => !s.email || !s.password)
      .map((s) => ({ _id: s._id, fullName: s.fullName, status: 'SKIPPED' as const, reason: !s.email ? 'No email address' : 'No password on record' }));
    for (let i = 0; i < ready.length; i += 5) {
      const group = ready.slice(i, i + 5);
      try {
        const res: any = await api.post('/admin/student-logins/send-email', { ids: group.map((s) => s._id) });
        const results: EmailResult[] = res.data.results;
        all.push(...results);
        const sentAt = new Map(results.filter((r) => r.status === 'SENT').map((r) => [r._id, r.loginSharedAt || new Date().toISOString()]));
        setStudents((list) => (list || []).map((x) => (sentAt.has(x._id) ? { ...x, loginSharedAt: sentAt.get(x._id)! } : x)));
      } catch (err: any) {
        all.push(...group.map((s) => ({ _id: s._id, fullName: s.fullName, status: 'FAILED' as const, reason: err.message })));
      }
      setEmailProgress({ done: Math.min(i + group.length, ready.length), total: ready.length });
    }
    setEmailProgress(null);
    setEmailResults(all);
    setSelected(new Set(all.filter((r) => r.status === 'FAILED').map((r) => r._id)));
  };

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
      if (filter === 'NEVER' && s.hasLoggedIn) return false;
      if (filter === 'LOGGED' && !s.hasLoggedIn) return false;
      if (filter === 'NOPASS' && s.password) return false;
      if (filter === 'EMAIL' && !s.email) return false;
      if (filter === 'NOEMAIL' && s.email) return false;
      if (!term) return true;
      return [s.fullName, s.studentId, s.machineCode, s.phone, s.email, s.course].join(' ').toLowerCase().includes(term);
    });
  }, [students, q, filter]);
  const missing = (students || []).filter((s) => !s.password).length;
  const never = (students || []).filter((s) => !s.hasLoggedIn).length;
  const logged = (students || []).length - never;
  const emailCount = (students || []).filter((s) => s.email).length;
  const noEmailCount = (students || []).length - emailCount;
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s._id));
  const selectVisible = (on: boolean) =>
    setSelected((set) => {
      const next = new Set(set);
      visible.forEach((s) => (on ? next.add(s._id) : next.delete(s._id)));
      return next;
    });
  const chosen = (students || []).filter((s) => selected.has(s._id));
  const chosenReady = chosen.filter((s) => s.email && s.password).length;
  const withEmail = (students || []).filter((s) => s.email).length;

  const LoginStatus: React.FC<{ s: StudentLogin }> = ({ s }) =>
    s.hasLoggedIn ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3" /> {s.lastLoginAt ? `Last ${shortDate(s.lastLoginAt)}${s.loginCount > 1 ? ` • ${s.loginCount}×` : ''}` : 'Logged in before'}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
        <XCircle className="h-3 w-3" /> Never logged in
      </span>
    );

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
                  <span className="text-slate-500">Status</span>
                  <span className="text-xs">
                    <LoginStatus s={checked.student} />
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={checked.student.password ? secondaryBtn : primaryBtn} disabled={busy} onClick={() => askGenerate(checked.student)}>
                    <KeyRound className="h-4 w-4" /> {checked.student.password ? 'Create a new password' : 'Generate automatic password'}
                  </button>
                  <WhatsAppBtn s={checked.student} big />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="login-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Student ID, phone, email or course" />
          </label>
          <select id="login-filter" className={`${inputClass} sm:w-60`} value={filter} onChange={(e) => setFilter(e.target.value as LoginFilter)}>
            <option value="ALL">All students ({(students || []).length})</option>
            <option value="NEVER">Never logged in ({never})</option>
            <option value="LOGGED">Logged in ({logged})</option>
            <option value="NOPASS">No password on record ({missing})</option>
            <option value="EMAIL">With email ({emailCount})</option>
            <option value="NOEMAIL">Without email ({noEmailCount})</option>
          </select>
          <button type="button" className={secondaryBtn} onClick={downloadList} disabled={!visible.length} title="Download this list with login IDs and passwords (opens in Excel)">
            <Download className="h-4 w-4" /> Download list
          </button>
        </div>
        {students && (
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3 lg:grid-cols-5">
            {[
              { k: 'LOGGED' as const, label: 'Logged in', n: logged, cls: 'text-emerald-600' },
              { k: 'NEVER' as const, label: 'Never logged in', n: never, cls: 'text-rose-600' },
              { k: 'NOPASS' as const, label: 'No password yet', n: missing, cls: 'text-amber-600' },
              { k: 'EMAIL' as const, label: 'With email', n: emailCount, cls: 'text-sky-600' },
              { k: 'NOEMAIL' as const, label: 'Without email', n: noEmailCount, cls: 'text-slate-500' },
            ].map((t) => (
              <button key={t.k} type="button" onClick={() => setFilter(filter === t.k ? 'ALL' : t.k)} title={filter === t.k ? 'Show all students' : `Show only: ${t.label}`} className={`rounded-xl border p-2 ${filter === t.k ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-slate-200 dark:border-slate-800'}`}>
                <p className={`text-xl font-black ${t.cls}`}>{t.n}</p>
                <p className="text-[11px] font-semibold text-slate-500">{t.label}</p>
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-500">Login times are recorded from 12 Nov 2026. Students who logged in before that and are still signed in show "Logged in before".</p>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs dark:bg-slate-800/60">
          <label className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={allVisibleSelected} onChange={(e) => selectVisible(e.target.checked)} /> Select all in this list ({visible.length})
          </label>
          <span className="text-slate-500">
            • {selected.size} selected{selected.size > 0 && `, ${chosenReady} with an email address`} • {withEmail} of {(students || []).length} students have an email
          </span>
          <span className="flex-1" />
          {selected.size > 0 && !emailProgress && (
            <button type="button" className={secondaryBtn} onClick={() => setSelected(new Set())}>
              Clear
            </button>
          )}
          {emailProgress ? (
            <span className="relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-brand-500/30">
              <span className="sl-shimmer pointer-events-none absolute inset-0" />
              <Loader2 className="relative h-4 w-4 animate-spin" />
              <span className="relative">
                Sending {emailProgress.done}/{emailProgress.total}
              </span>
            </span>
          ) : (
            <button type="button" className={primaryBtn} disabled={!chosenReady} onClick={() => setConfirmEmail(true)}>
              <Mail className="h-4 w-4" /> Email login to selected ({chosenReady})
            </button>
          )}
        </div>

        {emailProgress && (
          <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-indigo-50 p-4 dark:border-brand-900/60 dark:from-brand-950/40 dark:to-indigo-950/30" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/30" />
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-md">
                  <Send className="sl-fly h-4 w-4" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Sending login emails…</p>
                  <p className="text-sm font-black text-brand-700 dark:text-brand-300">{emailProgress.total ? Math.round((emailProgress.done / emailProgress.total) * 100) : 0}%</p>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/80 dark:bg-slate-800">
                  <div
                    className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-brand-600 transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.max(4, emailProgress.total ? (emailProgress.done / emailProgress.total) * 100 : 0)}%` }}
                  >
                    <span className="sl-shimmer absolute inset-0" />
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {emailProgress.done} of {emailProgress.total} sent • about {Math.max(1, Math.ceil(((emailProgress.total - emailProgress.done) * 0.9) / 60))} min left • keep this page open
                </p>
              </div>
            </div>
          </div>
        )}
        <style>{`
          @keyframes sl-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          .sl-shimmer { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent); animation: sl-shimmer 1.6s ease-in-out infinite; }
          @keyframes sl-fly { 0%, 100% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(2px, -2px) rotate(-8deg); } }
          .sl-fly { animation: sl-fly 1.2s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) { .sl-shimmer, .sl-fly { animation: none; } }
        `}</style>

        {!students ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1060px] text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/60">
                <tr>
                  {['', 'Student', 'Student ID', 'Course', 'Login ID', 'Password', 'Login status', ''].map((h) => (
                    <th key={h} className="px-3 py-3 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.length === 0 ? (
                  <EmptyRow colSpan={8} text="No students match." />
                ) : (
                  visible.map((s) => (
                    <tr key={s._id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${selected.has(s._id) ? 'bg-brand-50/60 dark:bg-brand-950/20' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" aria-label={`Select ${s.fullName}`} checked={selected.has(s._id)} onChange={() => pick(s._id)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-slate-900 dark:text-white">{s.fullName}</p>
                        <p className={`text-[10px] ${s.email ? 'text-slate-500' : 'text-amber-600'}`}>{s.email || 'No email'}</p>
                      </td>
                      <td className="px-3 py-2.5 font-mono">{s.studentId}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{s.course || '—'}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold">{s.loginId}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <PasswordCell s={s} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <LoginStatus s={s} />
                        {s.loginSharedAt && <span className="ml-1 text-[10px] text-slate-400">sent {shortDate(s.loginSharedAt)}</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        <WhatsAppBtn s={s} />{' '}
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
            <WhatsAppBtn s={created.student} password={created.password} big />
            <button type="button" className={primaryBtn} onClick={() => setCreated(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
      {confirmEmail && (
        <Modal title={`Email login details to ${chosenReady} student${chosenReady === 1 ? '' : 's'}?`} subtitle="Each student gets only their own Login ID and password." onClose={() => setConfirmEmail(false)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Sent from noreply@scholarlogiclms.in with the website link, their Login ID and their password.
            {chosen.length > chosenReady && ` ${chosen.length - chosenReady} selected student(s) have no email address or password and will be skipped.`}
          </p>
          <p className="pt-2 text-xs text-slate-500">About 2 emails per second: {Math.max(1, Math.ceil(chosenReady / 100))} minute(s) or less. Keep this page open until it finishes.</p>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" className={secondaryBtn} onClick={() => setConfirmEmail(false)}>
              Cancel
            </button>
            <button type="button" className={primaryBtn} onClick={sendEmails}>
              <Mail className="h-4 w-4" /> Send {chosenReady} email{chosenReady === 1 ? '' : 's'}
            </button>
          </div>
        </Modal>
      )}

      {emailResults && <EmailResultPopup results={emailResults} onClose={() => setEmailResults(null)} />}
      {toast.node}
    </div>
  );
};
