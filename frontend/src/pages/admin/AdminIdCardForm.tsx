import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, Mail, RefreshCw, Search, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Card, EmptyRow, Modal, PageHeader, Spinner, inputClass, primaryBtn, secondaryBtn, useToast } from './tracking/shared';

// Admin → ID Card Form: answers to the "Student info - ScholarLogic" Google Form. When the ID on the card and
// the student's name or phone agree, the login is emailed automatically; the rest wait here for a quick check.

type Status = 'SENT' | 'NEEDS_REVIEW' | 'EMAIL_FAILED' | 'DUPLICATE' | 'IGNORED';

interface Answer {
  _id: string;
  submittedAt: string;
  name: string;
  phone: string;
  email: string;
  course: string;
  education: string;
  idCardRaw: string;
  idCardCode: string;
  idCardPicUrl: string;
  status: Status;
  note: string;
  loginId: string;
  emailedTo: string;
  emailedAt: string | null;
  student: { _id: string; studentId: string; fullName: string; phone: string } | null;
}

interface StudentOption {
  _id: string;
  fullName: string;
  studentId: string;
  loginId: string;
  phone: string;
  email: string;
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  SENT: { label: 'Login emailed', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  NEEDS_REVIEW: { label: 'Needs review', cls: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' },
  EMAIL_FAILED: { label: 'Email failed', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  DUPLICATE: { label: 'Already sent', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  IGNORED: { label: 'Dismissed', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

const when = (d?: string | null) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export const AdminIdCardForm: React.FC = () => {
  const toast = useToast();
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [connected, setConnected] = useState(true);
  const [lastSync, setLastSync] = useState<{ at: string; ok: boolean; message: string } | null>(null);
  const [tab, setTab] = useState<Status | 'TODO' | 'ALL'>('TODO');
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [review, setReview] = useState<Answer | null>(null);
  const [students, setStudents] = useState<StudentOption[] | null>(null);
  const [pickQ, setPickQ] = useState('');
  const [pickId, setPickId] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get('/admin/id-card-form')
      .then((res: any) => {
        setAnswers(res.data.submissions);
        setConnected(res.data.connected);
        setLastSync(res.data.lastSync);
      })
      .catch((e: any) => toast.show(e.message));
  useEffect(() => {
    load();
  }, []);

  const sync = async () => {
    setSyncing(true);
    try {
      const res: any = await api.post('/admin/id-card-form/sync', {});
      toast.show(res.message || 'Form checked');
      await load();
    } catch (e: any) {
      toast.show(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const openReview = (a: Answer) => {
    setReview(a);
    setPickId(a.student?._id || '');
    setPickQ(a.idCardCode || a.name);
    setEmail(a.email);
    if (!students) {
      api
        .get('/admin/student-logins')
        .then((res: any) => setStudents(res.data.students))
        .catch((e: any) => toast.show(e.message));
    }
  };

  const send = async () => {
    if (!review) return;
    setBusy(true);
    try {
      const res: any = await api.post(`/admin/id-card-form/${review._id}/send`, { studentId: pickId, email: email.trim() });
      toast.show(res.message);
      setReview(null);
      await load();
    } catch (e: any) {
      toast.show(e.message);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async (a: Answer) => {
    setBusy(true);
    try {
      await api.post(`/admin/id-card-form/${a._id}/ignore`, {});
      setReview(null);
      await load();
    } catch (e: any) {
      toast.show(e.message);
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: 0, TODO: 0, SENT: 0, NEEDS_REVIEW: 0, EMAIL_FAILED: 0, DUPLICATE: 0, IGNORED: 0 };
    (answers || []).forEach((a) => {
      c.ALL += 1;
      c[a.status] += 1;
      if (a.status === 'NEEDS_REVIEW' || a.status === 'EMAIL_FAILED') c.TODO += 1;
    });
    return c;
  }, [answers]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (answers || []).filter((a) => {
      if (tab === 'TODO' && a.status !== 'NEEDS_REVIEW' && a.status !== 'EMAIL_FAILED') return false;
      if (tab !== 'TODO' && tab !== 'ALL' && a.status !== tab) return false;
      if (!term) return true;
      return [a.name, a.email, a.phone, a.idCardRaw, a.idCardCode, a.loginId, a.student?.fullName, a.course].join(' ').toLowerCase().includes(term);
    });
  }, [answers, tab, q]);

  const options = useMemo(() => {
    const term = pickQ.trim().toLowerCase();
    const list = students || [];
    if (!term) return list.slice(0, 30);
    return list.filter((s) => [s.fullName, s.studentId, s.loginId, s.phone, s.email].join(' ').toLowerCase().includes(term)).slice(0, 30);
  }, [students, pickQ]);
  const picked = (students || []).find((s) => s._id === pickId) || (review?.student && review.student._id === pickId ? { ...review.student, loginId: review.loginId, email: '' } : null);

  const tabs: { k: typeof tab; label: string }[] = [
    { k: 'TODO', label: 'To check' },
    { k: 'SENT', label: 'Login emailed' },
    { k: 'DUPLICATE', label: 'Already sent' },
    { k: 'IGNORED', label: 'Dismissed' },
    { k: 'ALL', label: 'All' },
  ];

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="ID Card Form"
        subtitle="Answers to the “Student info - ScholarLogic” Google Form. When the ID card number and the student's name or phone agree, their login is emailed automatically."
        action={
          <button type="button" className={primaryBtn} onClick={sync} disabled={syncing || !connected}>
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Checking…' : 'Check form now'}
          </button>
        }
      />

      {!connected && (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> The form is not connected yet. Add the Apps Script to the response sheet and put its web app link in the server settings.
        </p>
      )}
      {lastSync && (
        <p className={`text-xs ${lastSync.ok ? 'text-slate-500' : 'text-rose-600'}`}>
          Last check {when(lastSync.at)}: {lastSync.message}. The form is checked by itself every 5 minutes.
        </p>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-bold ${tab === t.k ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300' : 'border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300'}`}
            >
              {t.label} ({counts[t.k]})
            </button>
          ))}
          <label className="relative ml-auto block w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="idform-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ID, email or phone" />
          </label>
        </div>

        {!answers ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/60">
                <tr>
                  {['Submitted', 'On the form', 'ID card', 'Student & Login ID', 'Status', ''].map((h) => (
                    <th key={h} className="px-3 py-3 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.length === 0 ? (
                  <EmptyRow colSpan={6} text={tab === 'TODO' ? 'Nothing to check. Every answer was handled.' : 'No answers here.'} />
                ) : (
                  visible.map((a) => (
                    <tr key={a._id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{when(a.submittedAt)}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-slate-900 dark:text-white">{a.name || '—'}</p>
                        <p className="text-slate-500">{a.email || 'no email'}</p>
                        <p className="text-slate-500">
                          {a.phone}
                          {a.course && ` • ${a.course}`}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-mono font-bold">{a.idCardCode || <span className="text-amber-600">none</span>}</p>
                        {a.idCardRaw && a.idCardRaw.toUpperCase() !== a.idCardCode && <p className="text-[10px] text-slate-400">typed “{a.idCardRaw}”</p>}
                        {a.idCardPicUrl && (
                          <a href={a.idCardPicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:underline">
                            Card photo <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {a.student ? (
                          <>
                            <p className="font-semibold text-slate-900 dark:text-white">{a.student.fullName}</p>
                            <p className="font-mono font-bold text-brand-700 dark:text-brand-300">Login ID: {a.loginId || a.student.studentId}</p>
                          </>
                        ) : (
                          <span className="text-slate-400">Not matched</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 max-w-[260px]">
                        <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {a.status === 'SENT' ? `To ${a.emailedTo}, ${when(a.emailedAt)}` : a.note}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        {a.status === 'SENT' || a.status === 'DUPLICATE' ? (
                          <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => openReview(a)}>
                            <Mail className="h-3.5 w-3.5" /> Send again
                          </button>
                        ) : (
                          <button type="button" className={`${primaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => openReview(a)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Check & send
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

      {review && (
        <Modal title="Check and send the login" subtitle={`Form answer from ${review.name || 'unknown'} • ${when(review.submittedAt)}`} onClose={() => !busy && setReview(null)} wide>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 rounded-xl border border-slate-200 p-3 text-xs dark:border-slate-800">
              <p className="text-[10px] font-bold uppercase text-slate-500">On the form</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{review.name || '—'}</p>
              <p>Phone: {review.phone || '—'}</p>
              <p>ID card: <b className="font-mono">{review.idCardRaw || '—'}</b></p>
              <p>Course: {review.course || '—'}</p>
              {review.idCardPicUrl && (
                <a href={review.idCardPicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
                  Open the card photo <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {review.note && review.status !== 'SENT' && <p className="pt-1 text-amber-700 dark:text-amber-300">{review.note}</p>}
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-slate-500">Which student is this?</p>
              <input id="idform-pick" className={inputClass} value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder="Search name, Student ID, phone" />
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                {!students ? (
                  <Spinner />
                ) : options.length === 0 ? (
                  <p className="p-3 text-xs text-slate-500">No student matches.</p>
                ) : (
                  options.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => setPickId(s._id)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs ${pickId === s._id ? 'bg-brand-50 dark:bg-brand-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'}`}
                    >
                      <span>
                        <b className="text-slate-900 dark:text-white">{s.fullName}</b>
                        <span className="block text-slate-500">{s.phone || 'no phone'}</span>
                      </span>
                      <span className="font-mono font-bold text-brand-700 dark:text-brand-300">{s.loginId}</span>
                    </button>
                  ))
                )}
              </div>
              {picked && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> {picked.fullName} • Login ID {picked.loginId}
                </p>
              )}
              <label className="block text-[10px] font-bold uppercase text-slate-500" htmlFor="idform-email">
                Send to email
              </label>
              <input id="idform-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <p className="pt-3 text-xs text-slate-500">The student gets their own Login ID and password. If their profile has no email yet, this one is saved to it.</p>
          <div className="flex flex-wrap justify-end gap-2 pt-4">
            {review.status !== 'SENT' && review.status !== 'IGNORED' && (
              <button type="button" className={`${secondaryBtn} mr-auto`} disabled={busy} onClick={() => dismiss(review)}>
                <XCircle className="h-4 w-4" /> Dismiss
              </button>
            )}
            <button type="button" className={secondaryBtn} disabled={busy} onClick={() => setReview(null)}>
              Cancel
            </button>
            <button type="button" className={primaryBtn} disabled={busy || !pickId || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.trim())} onClick={send}>
              <Mail className="h-4 w-4" /> {busy ? 'Sending…' : 'Send login by email'}
            </button>
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
};
