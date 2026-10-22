import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, GraduationCap } from 'lucide-react';
import { api } from '../../services/api';

// Opened on the student's phone after scanning the QR code on their dashboard.
// No login needed here: the signed, short-lived link in the QR code identifies the student.

interface Info {
  student: { studentId: string; fullName: string; course: string; batches: { code: string; timing: string }[]; mode: string };
  date: string;
  alreadyMarked: { checkedInAt: string; topic: string } | null;
}

const input =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';

export const OnlineCheckIn: React.FC = () => {
  const [params] = useSearchParams();
  const t = params.get('t') || '';
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ checkedInAt?: string; already: boolean } | null>(null);

  useEffect(() => {
    if (!t) return setError('Scan the QR code on your ScholarLogic dashboard to open this page.');
    api
      .get('/online-attendance/check-in', { params: { t } })
      .then((res: any) => setInfo(res.data))
      .catch((e: any) => setError(e.message));
  }, [t]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res: any = await api.post('/online-attendance/check-in', { t, topic, note, confirm });
      setDone({ checkedInAt: res.data.checkedInAt, already: res.data.alreadyMarked });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const day = info ? new Date(`${info.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="flex min-h-[80vh] items-start justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-1 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-lg">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Online class attendance</h1>
          {day && <p className="text-sm text-slate-500">{day}</p>}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {info && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xl space-y-4">
            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-2 text-sm">
              <dt className="text-slate-500">Name</dt>
              <dd className="font-bold text-slate-900 dark:text-white">{info.student.fullName}</dd>
              <dt className="text-slate-500">Student ID</dt>
              <dd className="font-mono font-bold text-brand-700 dark:text-brand-300">{info.student.studentId}</dd>
              <dt className="text-slate-500">Course</dt>
              <dd className="text-slate-900 dark:text-white">{info.student.course || '—'}</dd>
              <dt className="text-slate-500">Batch</dt>
              <dd className="text-slate-900 dark:text-white">{info.student.batches.map((b) => `${b.code} (${b.timing})`).join(', ') || '—'}</dd>
              <dt className="text-slate-500">Time now</dt>
              <dd className="text-slate-900 dark:text-white">{new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</dd>
            </dl>

            {done || info.alreadyMarked ? (
              <div className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-5 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                <p className="text-lg font-extrabold text-emerald-800 dark:text-emerald-200">
                  {done && !done.already ? 'Attendance marked' : 'Already marked today'}
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">You can close this page. Your dashboard shows you as present.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Class / topic you attended today <span className="text-rose-500">*</span>
                  </span>
                  <input id="ci-topic" className={input} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Python – loops and functions" required minLength={3} maxLength={200} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Note for your trainer (optional)</span>
                  <input id="ci-note" className={input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. joined 10 minutes late" />
                </label>
                <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input id="ci-confirm" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-5 w-5 accent-brand-600" />
                  I confirm I am {info.student.fullName} and I attended today's online class.
                </label>
                <button
                  type="submit"
                  disabled={saving || !confirm || topic.trim().length < 3}
                  className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Mark my attendance'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
