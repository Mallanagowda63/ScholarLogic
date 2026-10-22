import React, { useEffect, useState } from 'react';
import { ArrowRight, Route } from 'lucide-react';
import { api } from '../services/api';
import { ProgressBar, StatusBadge, fmtDate, fmtMode, statusTone, toneFill } from '../pages/admin/tracking/shared';

// Student dashboard: where am I in my course? Read-only — batch allocation is done by admin.
export const CourseJourneyCard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api.get('/tracking/me').then((r: any) => setData(r.data)).catch(() => setData(null));
  }, []);

  const journey = data?.journey;
  if (!journey?.course) return null;
  const current = journey.current;
  const detail = journey.subjects.find((s: any) => s.subjectId === (selected || current?.subjectId)) || null;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <Route className="h-5 w-5 text-brand-500" /> My Course Journey — {journey.course.name}
          </h3>
          <p className="text-xs text-slate-500">
            Joined {fmtDate(data.joiningDate)} • {fmtMode(data.enrollment?.mode)} • Expected completion {fmtDate(journey.expectedCompletion)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{journey.overallProgress}%</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overall progress</p>
        </div>
      </div>

      {current ? (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-brand-50/60 dark:bg-brand-950/30 p-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Current subject', current.name],
            ['Batch', current.batch?.batchCode],
            ['Trainer', current.batch?.trainer?.fullName || '—'],
            ['Timing', current.batch?.timing],
            ['Started', fmtDate(current.startDate)],
            ['Expected end', fmtDate(current.expectedEndDate)],
          ].map(([l, v]) => (
            <div key={l as string}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{l}</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{v || '—'}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300">
          {journey.allocationStatus === 'COMPLETED'
            ? 'You have completed all subjects in this course. 🎉'
            : 'Your next batch has not been allocated yet. The academy team will assign it and it will appear here.'}
        </p>
      )}

      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {journey.subjects.map((s: any, i: number) => (
          <React.Fragment key={s.subjectId}>
            {i > 0 && <ArrowRight className="h-4 w-4 shrink-0 self-center text-slate-300 dark:text-slate-600" />}
            <button
              type="button"
              onClick={() => setSelected(s.subjectId)}
              className={`relative w-44 shrink-0 overflow-hidden rounded-xl border p-3 text-left transition-colors ${detail?.subjectId === s.subjectId ? 'border-brand-500' : 'border-slate-200 dark:border-slate-800'}`}
            >
              <span className={`absolute inset-x-0 top-0 h-1 ${toneFill[statusTone(s.status)]}`} />
              <p className="text-sm font-bold text-slate-900 dark:text-white">{s.name}</p>
              <StatusBadge status={s.status} className="mt-1" />
              <p className="mt-2 text-[11px] text-slate-500">{s.progress.completed}/{s.progress.total} topics • {s.progress.percentage}%</p>
              <ProgressBar value={s.progress.percentage} tone={statusTone(s.status)} className="mt-1" />
            </button>
          </React.Fragment>
        ))}
      </div>

      {detail && detail.topics.length > 0 && (
        <details className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs">
          <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-200">
            {detail.name} topics — {detail.progress.completed} of {detail.progress.total} completed
            {detail.currentTopic && <span className="font-normal text-slate-500"> • Current: {detail.currentTopic.title}</span>}
          </summary>
          <ol className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {detail.topics.map((t: any) => (
              <li key={t._id} className={t.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>
                {t.completed ? '✓' : '○'} {t.order}. {t.title}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
};
