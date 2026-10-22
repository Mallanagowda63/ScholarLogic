import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Fingerprint, LogIn, LogOut, RefreshCw, Wifi, WifiOff, UserX, Search } from 'lucide-react';
import { api } from '../../services/api';
import { Card, ErrorNote, PageHeader, Spinner, inputClass, primaryBtn, useToast } from './tracking/shared';

type LiveStatus = 'PRESENT' | 'IN_CAMPUS' | 'INCOMPLETE' | 'NOT_PUNCHED' | 'ABSENT' | 'WEEK_OFF';

interface LiveStudent {
  _id: string;
  name: string;
  studentId: string;
  biometricId: string;
  mode: string;
  status: LiveStatus;
  inTime: string | null;
  outTime: string | null;
  punchCount: number;
}

interface LiveData {
  date: string;
  isToday: boolean;
  shift: { start: string; end: string };
  devices: { serialNumber: string; lastSeenAt: string; lastPunchAt: string | null; lastIp: string; totalPunches: number; online: boolean }[];
  summary: { punches: number; present: number; inCampus: number; incomplete: number; notPunched: number; absent: number; unmatched: number };
  students: LiveStudent[];
  directory: { _id: string; name: string; studentId: string; biometricId: string }[];
  feed: { _id: string; time: string; direction: 'IN' | 'OUT' | 'UNKNOWN'; userPin: string; name: string | null; studentId: string | null }[];
  unmatchedPins: { userPin: string; punches: number; lastPunchAt: string }[];
}

// Punches arrive in real time from the machine; refresh often while the page is open
const POLL_MS = 15_000;

const STATUS_STYLE: Record<LiveStatus, { label: string; cls: string }> = {
  PRESENT: { label: 'Present', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
  IN_CAMPUS: { label: 'In campus', cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
  INCOMPLETE: { label: 'No OUT punch', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  NOT_PUNCHED: { label: 'Not punched', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  ABSENT: { label: 'Absent', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
  WEEK_OFF: { label: 'Week off', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
};

const hhmm = (t?: string | null) => {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

const ago = (iso?: string | null) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleString();
};

// Inline editor for the ID a student is enrolled under on the machine
const BiometricIdCell: React.FC<{ student: LiveStudent; onSaved: (msg: string) => void; onError: (msg: string) => void }> = ({
  student,
  onSaved,
  onError,
}) => {
  const [value, setValue] = useState(student.biometricId);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(student.biometricId), [student.biometricId]);
  const dirty = value.trim() !== student.biometricId;

  const save = () => {
    setSaving(true);
    api
      .put(`/attendance/students/${student._id}/biometric-id`, { biometricId: value.trim() })
      .then((res: any) => onSaved(res.message))
      .catch((e: any) => onError(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) save();
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g. 101"
        aria-label={`Biometric ID for ${student.name}`}
        className={`${inputClass} !w-24 !py-1 font-mono text-xs`}
      />
      {dirty && (
        <button type="submit" disabled={saving} className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-40">
          {saving ? '…' : 'Save'}
        </button>
      )}
    </form>
  );
};

export const AdminBiometric: React.FC = () => {
  const [data, setData] = useState<LiveData | null>(null);
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LiveStatus | ''>('');
  const [assign, setAssign] = useState<Record<string, string>>({});
  const toast = useToast();

  const load = useCallback(() => {
    setRefreshing(true);
    api
      .get('/attendance/biometric/live', { params: date ? { date } : {} })
      .then((res: any) => {
        setData(res.data);
        setError('');
      })
      .catch((e: any) => setError(e.message || 'Could not load biometric data'))
      .finally(() => setRefreshing(false));
  }, [date]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const saved = (msg: string) => {
    toast.show(msg);
    load();
  };

  const assignPin = (userPin: string) => {
    const studentMongoId = assign[userPin];
    if (!studentMongoId) return;
    api
      .put(`/attendance/students/${studentMongoId}/biometric-id`, { biometricId: userPin })
      .then((res: any) => saved(res.message))
      .catch((e: any) => setError(e.message));
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.students.filter(
      (s) =>
        (!statusFilter || s.status === statusFilter) &&
        (!q || s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.biometricId.toLowerCase().includes(q))
    );
  }, [data, search, statusFilter]);

  if (!data && !error) return <Spinner />;

  const tiles: { label: string; value: number; tone: string; filter: LiveStatus | '' }[] = data
    ? [
        { label: 'In campus now', value: data.summary.inCampus, tone: 'text-sky-600', filter: 'IN_CAMPUS' },
        { label: 'Present (IN + OUT)', value: data.summary.present, tone: 'text-emerald-600', filter: 'PRESENT' },
        ...(data.isToday && data.summary.notPunched
          ? [{ label: 'Not punched yet', value: data.summary.notPunched, tone: 'text-slate-600 dark:text-slate-300', filter: 'NOT_PUNCHED' as LiveStatus }]
          : []),
        ...(data.summary.incomplete ? [{ label: 'No OUT punch', value: data.summary.incomplete, tone: 'text-amber-500', filter: 'INCOMPLETE' as LiveStatus }] : []),
        ...(data.summary.absent ? [{ label: 'Absent', value: data.summary.absent, tone: 'text-rose-600', filter: 'ABSENT' as LiveStatus }] : []),
        { label: 'Punches', value: data.summary.punches, tone: 'text-slate-900 dark:text-white', filter: '' },
      ]
    : [];

  return (
    <div className="space-y-5 pb-12">
      {toast.node}
      <PageHeader
        title="Biometric Live"
        subtitle={
          data
            ? `eSSL punches as they happen. Shift ${hhmm(data.shift.start + ':00')} – ${hhmm(data.shift.end + ':00')}; IN + OUT = Present. Refreshes every 15 seconds.`
            : undefined
        }
        action={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date || data?.date || ''}
              max={data?.isToday ? data.date : undefined}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
              className={`${inputClass} !w-40`}
            />
            <button type="button" onClick={load} title="Refresh" className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-slate-500 hover:text-brand-600">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      <ErrorNote text={error} />

      {data && (
        <>
          {/* Machine connection */}
          {data.devices.length === 0 ? (
            <Card className="flex items-center gap-3 p-4 text-sm text-slate-600 dark:text-slate-300">
              <WifiOff className="h-5 w-5 text-rose-500" />
              The biometric machine has not connected yet. Set its Cloud Server (ADMS) address to this server.
            </Card>
          ) : (
            data.devices.map((d) => (
              <Card key={d.serialNumber} className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-xs text-slate-500">
                <span className={`flex items-center gap-2 text-sm font-bold ${d.online ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {d.online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  {d.online ? 'Machine online' : 'Machine offline'}
                </span>
                <span>eSSL S990 · SN <b className="font-mono text-slate-700 dark:text-slate-200">{d.serialNumber}</b></span>
                <span>Last contact {ago(d.lastSeenAt)}</span>
                <span>Last punch {ago(d.lastPunchAt)}</span>
                <span>{d.totalPunches} punches stored</span>
              </Card>
            ))
          )}

          {/* Counters (click to filter the table) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {tiles.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setStatusFilter(statusFilter === t.filter ? '' : t.filter)}
                className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 text-left shadow-sm transition-colors ${
                  t.filter && statusFilter === t.filter ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-brand-300'
                }`}
              >
                <p className={`text-2xl font-extrabold ${t.tone}`}>{t.value}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t.label}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Per-student day */}
            <Card className="xl:col-span-2 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Students {statusFilter && <span className="text-slate-400 font-medium">· {STATUS_STYLE[statusFilter].label}</span>}
                </h3>
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or ID" className={`${inputClass} !w-56 !py-1.5 pl-8 text-xs`} />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-[10px] font-bold uppercase text-slate-400">
                    <tr>
                      {['Student', 'Biometric ID', 'IN', 'OUT', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-2.5">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">No students match.</td>
                      </tr>
                    )}
                    {rows.map((s) => (
                      <tr key={s._id}>
                        <td className="px-4 py-2.5">
                          <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                          <p className="font-mono text-[10px] text-slate-400">{s.studentId}{s.mode === 'ONLINE' ? ' · online' : ''}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <BiometricIdCell student={s} onSaved={saved} onError={setError} />
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">{hhmm(s.inTime)}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200">{hhmm(s.outTime)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLE[s.status].cls}`}>{STATUS_STYLE[s.status].label}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="space-y-5">
              {/* Live punch feed */}
              <Card className="overflow-hidden">
                <h3 className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 p-4 text-sm font-bold text-slate-900 dark:text-white">
                  <Fingerprint className="h-4 w-4 text-brand-600" /> Punch feed
                </h3>
                <ul className="max-h-[420px] divide-y divide-slate-100 dark:divide-slate-800 overflow-y-auto">
                  {data.feed.length === 0 && <li className="p-6 text-center text-xs text-slate-500">No punches on this day yet.</li>}
                  {data.feed.map((p) => (
                    <li key={p._id} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          p.direction === 'OUT' ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/10' : 'bg-sky-50 text-sky-600 dark:bg-sky-500/10'
                        }`}
                      >
                        {p.direction === 'OUT' ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        {p.name ? (
                          <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{p.name}</p>
                        ) : (
                          <p className="text-xs font-bold text-rose-600">Unknown ID {p.userPin}</p>
                        )}
                        <p className="font-mono text-[10px] text-slate-400">{p.studentId || 'not linked to a student'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{hhmm(p.time)}</p>
                        <p className="text-[10px] text-slate-400">{p.direction === 'UNKNOWN' ? 'punch' : p.direction}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Machine IDs with no student */}
              {data.unmatchedPins.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="border-b border-slate-100 dark:border-slate-800 p-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                      <UserX className="h-4 w-4 text-rose-500" /> Unknown machine IDs
                    </h3>
                    <p className="mt-1 text-[11px] text-slate-500">These IDs punched but match no student. Assign one and its punches move to that student.</p>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.unmatchedPins.map((u) => (
                      <li key={u.userPin} className="space-y-2 px-4 py-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">ID {u.userPin}</span>
                          <span className="text-slate-400">{u.punches} {u.punches === 1 ? 'punch' : 'punches'} · {ago(u.lastPunchAt)}</span>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={assign[u.userPin] || ''}
                            onChange={(e) => setAssign((a) => ({ ...a, [u.userPin]: e.target.value }))}
                            aria-label={`Student for ID ${u.userPin}`}
                            className={`${inputClass} !py-1.5 text-xs`}
                          >
                            <option value="">Select student…</option>
                            {data.directory.map((s) => (
                              <option key={s._id} value={s._id}>
                                {s.name} ({s.studentId}){s.biometricId ? ` · has ID ${s.biometricId}` : ''}
                              </option>
                            ))}
                          </select>
                          <button type="button" disabled={!assign[u.userPin]} onClick={() => assignPin(u.userPin)} className={primaryBtn}>
                            Assign
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
