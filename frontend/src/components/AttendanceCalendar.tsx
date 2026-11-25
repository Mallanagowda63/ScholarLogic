import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X, Minus, LogIn, Fingerprint, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

type DayStatus = 'PRESENT' | 'INCOMPLETE' | 'ABSENT' | 'EXCUSED' | 'WEEK_OFF';

interface DayEntry {
  status: DayStatus;
  source: 'BIOMETRIC' | 'MANUAL' | 'AUTO';
  inTime?: string;
  outTime?: string;
}

interface AttendanceTab {
  key: string;
  label: string;
  days: Record<string, DayEntry>;
  summary: { present: number; incomplete: number; absent: number; total: number; percentage: number | null };
}

interface AttendanceData {
  from: string;
  to: string;
  today: string;
  mode: 'ONLINE' | 'OFFLINE';
  shift: { start: string; end: string };
  lastPunchAt: string | null;
  tabs: AttendanceTab[];
}

// New punches show up without a page reload
const POLL_MS = 60_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NUMBERS = Array.from({ length: 31 }, (_, i) => i + 1);

const hhmm = (t?: string) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const monthsBetween = (from: string, to: string) => {
  const out: { year: number; month: number }[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7)) - 1;
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7)) - 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month: m });
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return out;
};

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const describe = (date: string, d: DayEntry) => {
  const label = { PRESENT: 'Present', INCOMPLETE: 'Incomplete (no OUT punch)', ABSENT: 'Absent', EXCUSED: 'Excused', WEEK_OFF: 'Week off' }[d.status];
  const times = [d.inTime && `IN ${hhmm(d.inTime)}`, d.outTime && `OUT ${hhmm(d.outTime)}`].filter(Boolean).join(' · ');
  const source = d.source === 'MANUAL' ? 'Marked by trainer' : d.source === 'BIOMETRIC' ? 'Biometric' : '';
  return [date, label, times, source].filter(Boolean).join(' — ');
};

const DayMark: React.FC<{ entry?: DayEntry }> = ({ entry }) => {
  if (!entry) return null;
  switch (entry.status) {
    case 'PRESENT':
      return <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />;
    case 'INCOMPLETE':
      return <LogIn className="h-3.5 w-3.5 text-amber-500" strokeWidth={2.5} />;
    case 'ABSENT':
      return <X className="h-3.5 w-3.5 text-rose-500" strokeWidth={3} />;
    case 'EXCUSED':
      return <span className="text-[10px] font-black text-sky-500">E</span>;
    case 'WEEK_OFF':
      return <Minus className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />;
  }
};

export const AttendanceCalendar: React.FC = () => {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [activeTab, setActiveTab] = useState('overall');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      const params: Record<string, string> = {};
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      api
        .get('/attendance/me', { params })
        .then((res: any) => {
          if (res.success) {
            setData(res.data);
            setError('');
          }
        })
        .catch((e: any) => !silent && setError(e.message || 'Could not load attendance'))
        .finally(() => !silent && setLoading(false));
    },
    [range.from, range.to]
  );

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const tab = data?.tabs.find((t) => t.key === activeTab) || data?.tabs[0];
  const months = useMemo(() => (data ? monthsBetween(data.from, data.to) : []), [data]);
  const showYear = months.length > 0 && months[0].year !== months[months.length - 1].year;
  const todayEntry = data?.tabs[0]?.days[data.today];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header: title, today's punch state, date range */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">Attendance</h3>
          {data && todayEntry?.source === 'BIOMETRIC' && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                todayEntry.status === 'PRESENT'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
              }`}
            >
              <Fingerprint className="h-3.5 w-3.5" />
              Today: IN {hhmm(todayEntry.inTime)}
              {todayEntry.outTime ? ` · OUT ${hhmm(todayEntry.outTime)}` : ' · punch OUT pending'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs">
            <input
              type="date"
              aria-label="Start date"
              value={range.from}
              max={range.to || data?.today}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
              className="bg-transparent text-slate-700 dark:text-slate-200 outline-none"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              aria-label="End date"
              value={range.to}
              min={range.from || undefined}
              max={data?.today}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
              className="bg-transparent text-slate-700 dark:text-slate-200 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => load()}
            title="Refresh"
            className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-500 hover:text-brand-600 hover:border-brand-400 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Subject tabs */}
      {data && data.tabs.length > 1 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-1.5 w-fit max-w-full">
          {data.tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                t.key === tab?.key
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      {loading && !data ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        data &&
        tab && (
          <>
            {/* Summary + legend */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <p className="flex items-baseline gap-1.5">
                  <span
                    className={`text-3xl font-black ${
                      tab.summary.percentage === null
                        ? 'text-slate-400'
                        : tab.summary.percentage >= 75
                          ? 'text-emerald-600'
                          : tab.summary.percentage >= 50
                            ? 'text-amber-500'
                            : 'text-rose-600'
                    }`}
                  >
                    {tab.summary.percentage === null ? '—' : `${tab.summary.percentage}%`}
                  </span>
                  <span className="text-xs text-slate-500">attended</span>
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <b className="text-slate-900 dark:text-white">{tab.summary.present}</b> of{' '}
                  <b className="text-slate-900 dark:text-white">{tab.summary.total}</b> classes attended · {tab.summary.absent} missed
                  {tab.summary.incomplete > 0 && ` · ${tab.summary.incomplete} incomplete`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-600" strokeWidth={3} /> Present</span>
                <span className="flex items-center gap-1"><LogIn className="h-3 w-3 text-amber-500" /> IN only</span>
                <span className="flex items-center gap-1"><X className="h-3 w-3 text-rose-500" strokeWidth={3} /> Absent</span>
                <span className="flex items-center gap-1"><Minus className="h-3 w-3 text-slate-400" /> Week off</span>
              </div>
            </div>

            {/* Month × day grid */}
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-center">
                <thead>
                  <tr>
                    <th className="w-14" />
                    {DAY_NUMBERS.map((n) => (
                      <th key={n} className="pb-2 text-[10px] font-medium text-slate-400">{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {months.map(({ year, month }) => {
                    const lastDay = daysInMonth(year, month);
                    return (
                      <tr key={`${year}-${month}`}>
                        <th className="py-1.5 pr-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {MONTHS[month]}
                          {showYear && <span className="ml-1 text-[10px] font-medium text-slate-400">{String(year).slice(2)}</span>}
                        </th>
                        {DAY_NUMBERS.map((n) => {
                          if (n > lastDay) return <td key={n} />;
                          const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
                          const entry = tab.days[date];
                          const isToday = date === data.today;
                          return (
                            <td key={n} className="py-1">
                              <span
                                title={entry ? describe(date, entry) : date}
                                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md ${
                                  isToday ? 'ring-2 ring-brand-400/60' : ''
                                } ${entry && entry.status !== 'WEEK_OFF' ? 'hover:bg-slate-100 dark:hover:bg-slate-800' : ''}`}
                              >
                                <DayMark entry={entry} />
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-slate-400">
              {data.mode === 'OFFLINE'
                ? `Campus attendance comes from the biometric machine: punch IN and OUT between ${hhmm(data.shift.start + ':00')} and ${hhmm(
                    data.shift.end + ':00'
                  )}. A day with only an IN punch stays incomplete until you punch OUT.`
                : 'Online classes: attendance is marked by your trainer.'}
            </p>
          </>
        )
      )}
    </div>
  );
};
