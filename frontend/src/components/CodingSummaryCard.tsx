import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Code2, XCircle } from 'lucide-react';
import { api } from '../services/api';

// Student profile: how much technical practice the student has done (solved questions and latest submissions)
export const CodingSummaryCard: React.FC = () => {
  const [s, setS] = useState<any | null>(null);
  useEffect(() => {
    api.get('/coding/student/summary').then((r: any) => setS(r.data)).catch(() => setS(null));
  }, []);
  if (!s) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Code2 className="h-4 w-4 text-emerald-500" /> Technical Practice
        </p>
        <Link to="/student/coding" className="text-xs font-semibold text-brand-600 hover:underline">
          Practice →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          [s.solved, 'Solved', 'text-emerald-600'],
          [s.tried, 'Tried', 'text-sky-600'],
          [s.submissions, 'Submissions', 'text-slate-900 dark:text-white'],
        ].map(([v, l, c]) => (
          <div key={String(l)} className="rounded-xl bg-slate-50 py-2 dark:bg-slate-800/60">
            <p className={`text-xl font-black ${c}`}>{v}</p>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{l}</p>
          </div>
        ))}
      </div>
      {s.recent.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {s.recent.slice(0, 5).map((r: any) => (
            <li key={r._id} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                {r.status === 'PASSED' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                <span className="truncate text-slate-700 dark:text-slate-300">{r.title}</span>
              </span>
              <span className="shrink-0 text-slate-400">
                {r.passed}/{r.total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
