import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Mail, MailX, X } from 'lucide-react';

export interface EmailResultRow {
  _id: string;
  fullName: string;
  status: 'SENT' | 'SKIPPED' | 'FAILED';
  reason?: string;
}

// Result of "Email login to selected": big icon, three counts, and the students that need attention
export const EmailResultPopup: React.FC<{ results: EmailResultRow[]; onClose: () => void }> = ({ results, onClose }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const sent = results.filter((r) => r.status === 'SENT').length;
  const skipped = results.filter((r) => r.status === 'SKIPPED');
  const failed = results.filter((r) => r.status === 'FAILED');
  const issues = [...failed, ...skipped];
  const mood = sent && !issues.length ? 'good' : sent ? 'mixed' : 'bad';

  const look = {
    good: {
      icon: <CheckCircle2 className="h-10 w-10 text-white" strokeWidth={2.5} />,
      circle: 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/40',
      ring: 'bg-emerald-400/30',
      title: sent === 1 ? 'Email sent!' : `${sent} emails sent!`,
      text: `${sent === 1 ? 'The student' : `All ${sent} students`} will get their Login ID and password in their inbox in a minute or two.`,
    },
    mixed: {
      icon: <AlertTriangle className="h-10 w-10 text-white" strokeWidth={2.5} />,
      circle: 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/40',
      ring: 'bg-amber-400/30',
      title: `${sent} sent, ${issues.length} need${issues.length === 1 ? 's' : ''} attention`,
      text: 'Most emails went out. The students below did not get one.',
    },
    bad: {
      icon: <MailX className="h-10 w-10 text-white" strokeWidth={2.5} />,
      circle: 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/40',
      ring: 'bg-rose-400/30',
      title: 'No emails were sent',
      text: 'None of the selected students could get an email. See why below.',
    },
  }[mood];

  const tiles = [
    { label: 'Sent', n: sent, cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
    { label: 'Skipped', n: skipped.length, cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
    { label: 'Failed', n: failed.length, cls: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/40' },
  ];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-300 ${shown ? 'bg-slate-950/60 backdrop-blur-sm' : 'bg-transparent'}`}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-result-title"
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl transition-all duration-300 ease-out dark:bg-slate-900 ${
          shown ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'
        }`}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-500 via-indigo-500 to-brand-600" />
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
          <X className="h-5 w-5" />
        </button>

        <div className="px-7 pb-7 pt-8 text-center">
          <div className="relative mx-auto mb-5 h-20 w-20">
            <span className={`absolute inset-0 animate-ping rounded-full ${look.ring}`} style={{ animationIterationCount: 2 }} />
            <span className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg ${look.circle}`}>{look.icon}</span>
          </div>

          <h2 id="email-result-title" className="text-xl font-extrabold text-slate-900 dark:text-white">
            {look.title}
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">{look.text}</p>

          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {tiles.map((t) => (
              <div key={t.label} className={`rounded-2xl px-2 py-3 ${t.bg}`}>
                <p className={`text-2xl font-black leading-none ${t.cls}`}>{t.n}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.label}</p>
              </div>
            ))}
          </div>

          {issues.length > 0 && (
            <div className="mt-5 max-h-48 overflow-y-auto rounded-2xl border border-slate-100 text-left dark:border-slate-800">
              {issues.map((r) => (
                <div key={r._id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0 dark:border-slate-800">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{r.fullName}</span>
                    <span className="block truncate text-xs text-slate-500">{r.reason}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      r.status === 'FAILED' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {r.status === 'FAILED' ? 'Failed' : 'Skipped'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {failed.length > 0 && <p className="mt-3 text-xs text-slate-500">The failed students are still selected, so you can press “Email login” again.</p>}

          {sent > 0 && (
            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
              <Mail className="h-3.5 w-3.5" /> Sent from noreply@scholarlogiclms.in · replies go to tech@scholarlogic.net
            </p>
          )}

          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:opacity-95 active:scale-[0.99]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
