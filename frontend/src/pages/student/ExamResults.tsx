import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ClipboardList,
  Target,
  TrendingUp,
  Trophy,
  ArrowRight,
  CalendarDays,
} from 'lucide-react';

type Filter = 'all' | 'passed' | 'failed';

const formatDuration = (seconds: number) => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
};

const ScoreRing: React.FC<{ value: number; passed: boolean }> = ({ value, passed }) => {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke={passed ? '#10b981' : '#f43f5e'}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-900 dark:text-white">
        {pct}%
      </span>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: string; sub: string; icon: React.ElementType; tone: string }> = ({
  label,
  value,
  sub,
  icon: Icon,
  tone,
}) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">{value}</p>
        <p className="mt-0.5 text-xs text-slate-500">{sub}</p>
      </div>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </span>
    </div>
  </div>
);

export const ExamResults: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    api.get('/exams/results/me')
      .then((res: any) => {
        if (res.success) setResults(res.data?.results || []);
      })
      .catch((err: any) => setError(err?.message || 'Could not load your results.'))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const taken = results.length;
    const passed = results.filter((r) => r.passed).length;
    const average = taken ? results.reduce((sum, r) => sum + (r.percentage || 0), 0) / taken : 0;
    const best = results.reduce<any>((top, r) => (!top || (r.percentage || 0) > (top.percentage || 0) ? r : top), null);
    return { taken, passed, average, best };
  }, [results]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return results.filter((r) => {
      if (filter === 'passed' && !r.passed) return false;
      if (filter === 'failed' && r.passed) return false;
      if (q && !(r.examId?.title || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [results, filter, query]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Exam Results</h1>
          <p className="text-xs text-slate-500">Every exam you've submitted, with scores and detailed reports.</p>
        </div>
        <Link
          to="/student/exams"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 transition-colors"
        >
          Take an exam <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/50 p-4 text-xs font-semibold text-red-700 dark:text-red-300">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Exams taken"
          value={String(stats.taken)}
          sub={stats.taken === 1 ? '1 submission' : `${stats.taken} submissions`}
          icon={ClipboardList}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400"
        />
        <StatTile
          label="Average score"
          value={`${Math.round(stats.average)}%`}
          sub="Across all attempts"
          icon={TrendingUp}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"
        />
        <StatTile
          label="Pass rate"
          value={stats.taken ? `${Math.round((stats.passed / stats.taken) * 100)}%` : '0%'}
          sub={`${stats.passed} passed • ${stats.taken - stats.passed} failed`}
          icon={Target}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
        />
        <StatTile
          label="Best score"
          value={stats.best ? `${Math.round(stats.best.percentage)}%` : '—'}
          sub={stats.best?.examId?.title || 'No exams yet'}
          icon={Trophy}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
            {([
              ['all', `All (${results.length})`],
              ['passed', `Passed (${stats.passed})`],
              ['failed', `Failed (${stats.taken - stats.passed})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3.5 py-1.5 transition-colors ${
                  filter === key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative block sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exams"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
        </div>

        {results.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center">
            <Award className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">No results yet</p>
            <p className="mt-0.5 text-xs text-slate-500">Submit your first exam and your score report will appear here.</p>
            <Link
              to="/student/exams"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700"
            >
              Browse exams <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">No results match your filters.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((r) => {
              const total = (r.correctCount || 0) + (r.wrongCount || 0) + (r.unansweredCount || 0);
              const share = (n: number) => (total ? `${(n / total) * 100}%` : '0%');
              return (
                <li key={r._id}>
                  <Link
                    to={`/student/results/${r._id}`}
                    className="group flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700 transition-all sm:flex-row sm:items-center"
                  >
                    <ScoreRing value={r.percentage || 0} passed={r.passed} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {r.examId?.title || 'Assessment'}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            r.passed
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          {r.passed ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {r.passed ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {r.score} / {r.totalMarks} marks
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(r.evaluatedAt || r.createdAt).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDuration(r.timeSpentSeconds)}
                        </span>
                      </div>

                      {total > 0 && (
                        <div className="mt-3 max-w-md">
                          <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <span className="bg-emerald-500" style={{ width: share(r.correctCount || 0) }} />
                            <span className="bg-rose-500" style={{ width: share(r.wrongCount || 0) }} />
                            <span className="bg-slate-300 dark:bg-slate-600" style={{ width: share(r.unansweredCount || 0) }} />
                          </div>
                          <div className="mt-1.5 flex gap-4 text-[10px] font-semibold">
                            <span className="text-emerald-600 dark:text-emerald-400">{r.correctCount || 0} correct</span>
                            <span className="text-rose-600 dark:text-rose-400">{r.wrongCount || 0} wrong</span>
                            <span className="text-slate-500">{r.unansweredCount || 0} skipped</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1 self-start text-xs font-bold text-brand-600 dark:text-brand-400 sm:self-center">
                      View report <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
