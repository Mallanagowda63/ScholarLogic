import React from 'react';
import { ClipboardList } from 'lucide-react';

// The office's class sheet (course, batch month, subject status), shown as written there.
// Admin, trainer and the student themselves see the same card.

export interface ClassRecord {
  course: string;
  batchMonth?: string;
  note?: string;
  subjects: { name: string; status: string }[];
}

const tone = (status: string) => {
  const s = status.toLowerCase();
  if (/placed/.test(s)) return 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900';
  if (/drop|not attend|no response/.test(s)) return 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900';
  if (/compl|done/.test(s)) return 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900';
  if (/attend/.test(s)) return 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900';
  return 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900';
};

export const ClassRecordCard: React.FC<{ records?: ClassRecord[]; className?: string }> = ({ records, className = '' }) => {
  if (!records?.length) return null;
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 ${className}`}>
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <ClipboardList className="h-4 w-4 text-brand-500" /> Class record
      </h3>
      {records.map((r, i) => (
        <div key={i} className="space-y-2">
          <p className="text-xs text-slate-500">
            <b className="text-slate-800 dark:text-slate-200">{r.course}</b>
            {r.batchMonth ? ` • Batch ${r.batchMonth}` : ''}
            {r.note ? ` • ${r.note}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {r.subjects.map((s) => (
              <span key={s.name} className={`rounded-lg px-2.5 py-1 text-xs ring-1 ${tone(s.status)}`}>
                <b>{s.name}</b>: {s.status}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
