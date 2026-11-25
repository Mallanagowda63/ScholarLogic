import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Search, Send, Upload, Wifi, WifiOff } from 'lucide-react';
import { api } from '../../services/api';
import { Card, EmptyRow, ErrorNote, Field, Modal, PageHeader, Spinner, inputClass, linkBtn, primaryBtn, secondaryBtn, useToast } from './tracking/shared';

type DeviceUserStatus = 'NO_E_NUMBER' | 'NOT_PUSHED' | 'QUEUED' | 'SENT' | 'FAILED' | 'CONFIRMED' | 'VERIFIED' | 'CARD_MISMATCH';

interface StudentRow {
  _id: string;
  name: string;
  studentId: string;
  biometricId: string;
  cardNumber: string;
  mode: string;
  accountStatus: string;
  essl: { company: string; department: string; designation: string; applyType: string };
  device: { status: DeviceUserStatus; message: string; commandId: number | null; updatedAt: string | null };
}

interface DeviceRow {
  serialNumber: string;
  online: boolean;
  lastSeenAt: string;
  lastPunchAt: string | null;
  lastSyncAt: string | null;
  lastSyncReceived: number;
  lastSyncInserted: number;
  lastErrorAt: string | null;
  lastError: string;
  totalPunches: number;
  pushVersion: string;
  deviceInfo: string;
  pendingCommands: number;
}

interface Overview {
  integration: { method: string; userCommand: string; allowedSerials: string[]; targetSerial: string; timezone: string; window: { start: string; end: string } };
  devices: DeviceRow[];
  targetDevice: { serial: string; everConnected: boolean; online: boolean };
  nextENumber: number;
  counts: {
    students: number;
    withENumber: number;
    withoutENumber: number;
    withCard: number;
    verifiedOnDevice: number;
    unknownIds: number;
    conflictIds: number;
    outOfWindowPunches: number;
  };
  settings: { defaults: Record<'company' | 'department' | 'designation' | 'applyType', string>; applyTypeAllowed: string[]; templateHeaders: string[] };
  exportReadiness: { students: number; blank: Record<'company' | 'department' | 'designation' | 'applyType', number>; layout: string };
  students: StudentRow[];
}

interface ImportRow {
  row: number;
  eNumber: string;
  name: string;
  company: string;
  department: string;
  designation: string;
  applyType: string;
  cardNumber: string;
  action: 'LINK' | 'UPDATE' | 'UNCHANGED' | 'SKIP' | 'ERROR';
  errors: string[];
  warnings: string[];
  changes: string[];
  student: { _id: string; studentId: string; name: string } | null;
  result?: 'APPLIED' | 'UNCHANGED' | 'SKIPPED' | 'INVALID' | 'FAILED';
  resultMessage?: string;
}

interface ImportData {
  fileName: string;
  headers: string[];
  applyTypeValidated: boolean;
  rows: ImportRow[];
  summary: { total: number; link: number; update: number; unchanged: number; skip: number; error: number; warnings: number };
  results?: { total: number; applied: number; unchanged: number; skipped: number; invalid: number; failed: number; punchesLinked: number };
}

interface PushResult {
  studentMongoId: string;
  studentId: string;
  name: string;
  biometricId: string;
  outcome: 'QUEUED' | 'ALREADY_QUEUED' | 'AWAITING_DEVICE' | 'NOT_QUEUED';
  message: string;
}

interface Candidate {
  _id: string;
  studentId: string;
  fullName: string;
}

interface ReviewId {
  userPin: string;
  machineName?: string;
  isMachineAdmin?: boolean;
  suggestion?: Candidate | null;
  punches: number;
  lastPunchAt: string;
  lastLocal: string;
  note: string;
}

interface ReviewData {
  window: { start: string; end: string };
  candidates: Candidate[];
  unknownIds: ReviewId[];
  conflicts: ReviewId[];
  outOfWindow: { _id: string; userPin: string; date: string; time: string; direction: string; studentId: string | null; name: string | null }[];
}

interface LogRow {
  _id: string;
  at: string;
  kind: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

const POLL_MS = 15_000;

const green = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
const amber = 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300';
const rose = 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300';
const sky = 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300';
const grey = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

// Only VERIFIED means the machine itself has shown the student's record
const DEVICE_STYLE: Record<DeviceUserStatus, { label: string; cls: string }> = {
  NO_E_NUMBER: { label: 'No E Number', cls: grey },
  NOT_PUSHED: { label: 'Not pushed', cls: grey },
  QUEUED: { label: 'Queued', cls: sky },
  SENT: { label: 'Sent, no reply yet', cls: sky },
  FAILED: { label: 'Failed', cls: rose },
  CONFIRMED: { label: 'Accepted by machine', cls: amber },
  VERIFIED: { label: 'Verified on machine', cls: green },
  CARD_MISMATCH: { label: 'Card mismatch', cls: rose },
};

const ACTION_STYLE: Record<ImportRow['action'], { label: string; cls: string }> = {
  LINK: { label: 'Will link', cls: green },
  UPDATE: { label: 'Will update', cls: sky },
  UNCHANGED: { label: 'No change', cls: grey },
  SKIP: { label: 'Skip', cls: amber },
  ERROR: { label: 'Error', cls: rose },
};

const RESULT_STYLE: Record<NonNullable<ImportRow['result']>, { label: string; cls: string }> = {
  APPLIED: { label: 'Applied', cls: green },
  UNCHANGED: { label: 'No change', cls: grey },
  SKIPPED: { label: 'Skipped', cls: amber },
  INVALID: { label: 'Invalid', cls: rose },
  FAILED: { label: 'Failed', cls: rose },
};

const OUTCOME_STYLE: Record<PushResult['outcome'], { label: string; cls: string }> = {
  QUEUED: { label: 'Queued', cls: sky },
  ALREADY_QUEUED: { label: 'Already queued', cls: grey },
  AWAITING_DEVICE: { label: 'Awaiting machine', cls: amber },
  NOT_QUEUED: { label: 'Not queued', cls: rose },
};

const Badge: React.FC<{ cls: string; children: React.ReactNode }> = ({ cls, children }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${cls}`}>{children}</span>
);

const ago = (iso?: string | null) => {
  if (!iso) return 'never';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
};

const istTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' });

const th = 'px-4 py-2.5 text-left text-[10px] font-bold uppercase text-slate-400';
const td = 'px-4 py-2.5 align-top';

// Inline editor for the card linked to a student's E Number
const CardCell: React.FC<{ student: StudentRow; onSaved: (msg: string) => void; onError: (msg: string) => void }> = ({ student, onSaved, onError }) => {
  const [value, setValue] = useState(student.cardNumber);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(student.cardNumber), [student.cardNumber]);
  const dirty = value.trim() !== student.cardNumber;

  const save = () => {
    setSaving(true);
    api
      .put(`/attendance/students/${student._id}/card-number`, { cardNumber: value.trim() })
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
        inputMode="numeric"
        placeholder="Card no."
        aria-label={`Card Number for ${student.name}`}
        className={`${inputClass} !w-32 !py-1 font-mono text-xs`}
      />
      {dirty && (
        <button type="submit" disabled={saving} className={linkBtn}>
          {saving ? '…' : 'Save'}
        </button>
      )}
    </form>
  );
};

type Tab = 'students' | 'sheet' | 'review' | 'logs';

export const AdminEssl: React.FC = () => {
  const [tab, setTab] = useState<Tab>('students');
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setRefreshing(true);
    api
      .get('/attendance/biometric/overview')
      .then((res: any) => setData(res.data))
      .catch((e: any) => setError(e.message || 'Could not load the eSSL integration status'))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const done = (msg: string) => {
    setError('');
    toast.show(msg);
    load();
  };

  if (!data && !error) return <Spinner />;

  const reviewCount = data ? data.counts.unknownIds + data.counts.conflictIds : 0;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'students', label: 'Students & machine' },
    { key: 'sheet', label: 'Import / export' },
    { key: 'review', label: `Review queue${reviewCount ? ` (${reviewCount})` : ''}` },
    { key: 'logs', label: 'Sync log' },
  ];

  return (
    <div className="space-y-5 pb-12">
      {toast.node}
      <PageHeader
        title="eSSL Integration"
        subtitle="E Numbers, cards, the eSSL master sheet and what the machine has actually confirmed."
        action={
          <button type="button" onClick={load} title="Refresh" className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5 text-slate-500 hover:text-brand-600">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <ErrorNote text={error} />

      {data && (
        <>
          <SyncStatus data={data} />

          <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-xs font-bold ${
                  tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'students' && <StudentsTab data={data} onDone={done} onError={setError} />}
          {tab === 'sheet' && <SheetTab data={data} onDone={done} onError={setError} />}
          {tab === 'review' && <ReviewTab onDone={done} onError={setError} />}
          {tab === 'logs' && <LogsTab onError={setError} />}
        </>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sync status
// ---------------------------------------------------------------------------

const SyncStatus: React.FC<{ data: Overview }> = ({ data }) => {
  const stats = [
    { label: 'Students', value: data.counts.students },
    { label: 'With E Number', value: data.counts.withENumber },
    { label: 'With card', value: data.counts.withCard },
    { label: 'Verified on machine', value: data.counts.verifiedOnDevice },
    { label: 'IDs to review', value: data.counts.unknownIds + data.counts.conflictIds },
    { label: 'Out-of-window punches', value: data.counts.outOfWindowPunches },
  ];
  return (
    <div className="space-y-3">
      {!data.targetDevice.everConnected && (
        <Card className="flex items-start gap-3 p-4 text-xs text-slate-600 dark:text-slate-300">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <p className="text-sm font-bold text-rose-600">The machine has never connected to ScholarLogic</p>
            <p className="mt-1">
              Nothing can be delivered to it or received from it until its ADMS (Cloud Server) setting points at this server. Expected serial:{' '}
              <b className="font-mono">{data.targetDevice.serial || 'not configured'}</b>. Pushes stay queued and are reported as not delivered.
            </p>
          </div>
        </Card>
      )}
      {data.devices.map((d) => (
        <Card key={d.serialNumber} className="space-y-2 p-4 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className={`flex items-center gap-2 text-sm font-bold ${d.online ? 'text-emerald-600' : 'text-rose-600'}`}>
              {d.online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              {d.online ? 'Machine online' : 'Machine offline'}
            </span>
            <span>
              SN <b className="font-mono text-slate-700 dark:text-slate-200">{d.serialNumber}</b>
            </span>
            <span>Last contact {ago(d.lastSeenAt)}</span>
            <span>
              Last successful sync <b className="text-slate-700 dark:text-slate-200">{d.lastSyncAt ? ago(d.lastSyncAt) : 'never'}</b>
              {d.lastSyncAt ? ` (${d.lastSyncInserted} new of ${d.lastSyncReceived})` : ''}
            </span>
            <span>{d.totalPunches} punches stored</span>
            <span>{d.pendingCommands} command(s) pending</span>
            {d.pushVersion && <span>Push protocol {d.pushVersion}</span>}
          </div>
          {d.lastError && (
            <p className="flex items-start gap-2 text-rose-600">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Last error {ago(d.lastErrorAt)}: {d.lastError}
            </p>
          )}
        </Card>
      ))}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Students: E Numbers, cards, push
// ---------------------------------------------------------------------------

const StudentsTab: React.FC<{ data: Overview; onDone: (msg: string) => void; onError: (msg: string) => void }> = ({ data, onDone, onError }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [pushResults, setPushResults] = useState<{ deviceOnline: boolean; deviceEverConnected: boolean; results: PushResult[] } | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.students.filter(
      (s) => !q || s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q) || s.biometricId.toLowerCase().includes(q) || s.cardNumber.includes(q)
    );
  }, [data.students, search]);

  const allShown = rows.length > 0 && rows.every((r) => selected.has(r._id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allShown ? new Set() : new Set(rows.map((r) => r._id)));

  const assign = () => {
    setBusy(true);
    api
      .post('/attendance/biometric/e-numbers/assign', {})
      .then((res: any) => onDone(res.message))
      .catch((e: any) => onError(e.message))
      .finally(() => setBusy(false));
  };

  const push = (force = false) => {
    setBusy(true);
    api
      .post('/attendance/biometric/push', { studentIds: [...selected], force })
      .then((res: any) => {
        setPushResults(res.data);
        onDone('Push request recorded. See each student’s result.');
      })
      .catch((e: any) => onError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-4">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, E Number or card" className={`${inputClass} !w-72 !py-1.5 pl-8 text-xs`} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {data.counts.withoutENumber > 0 && (
            <button type="button" disabled={busy} onClick={assign} className={secondaryBtn} title={`Next number: ${data.nextENumber}`}>
              Assign E Numbers ({data.counts.withoutENumber} without, next {data.nextENumber})
            </button>
          )}
          <button type="button" disabled={busy || selected.size === 0} onClick={() => push()} className={primaryBtn}>
            <Send className="h-3.5 w-3.5" /> Push {selected.size || ''} to machine
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-xs">
          <thead>
            <tr>
              <th className={th}>
                <input type="checkbox" checked={allShown} onChange={toggleAll} aria-label="Select all students shown" />
              </th>
              {['Student', 'E Number (Biometric ID)', 'Card Number', 'On the machine'].map((h) => (
                <th key={h} className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.length === 0 && <EmptyRow colSpan={5} text="No students match." />}
            {rows.map((s) => (
              <tr key={s._id}>
                <td className={td}>
                  <input type="checkbox" checked={selected.has(s._id)} onChange={() => toggle(s._id)} aria-label={`Select ${s.name}`} />
                </td>
                <td className={td}>
                  <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                  <p className="font-mono text-[10px] text-slate-400">
                    {s.studentId}
                    {s.mode === 'ONLINE' ? ' · online' : ''}
                  </p>
                </td>
                <td className={`${td} font-mono font-bold text-slate-800 dark:text-slate-100`}>{s.biometricId || <span className="font-sans font-medium text-slate-400">—</span>}</td>
                <td className={td}>
                  <CardCell student={s} onSaved={onDone} onError={onError} />
                </td>
                <td className={td}>
                  <Badge cls={DEVICE_STYLE[s.device.status].cls}>{DEVICE_STYLE[s.device.status].label}</Badge>
                  <p className="mt-1 max-w-xs text-[11px] text-slate-500">{s.device.message}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pushResults && (
        <Modal
          title="Push results"
          subtitle={
            !pushResults.deviceEverConnected
              ? 'The machine has never connected: nothing below has reached it.'
              : pushResults.deviceOnline
                ? 'Queued commands are collected by the machine within seconds. The table updates as it replies.'
                : 'The machine is offline: queued commands are delivered when it reconnects.'
          }
          onClose={() => setPushResults(null)}
          wide
        >
          <table className="w-full text-xs">
            <thead>
              <tr>
                {['Student', 'E Number', 'Result', 'Detail'].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pushResults.results.map((r) => (
                <tr key={r.studentMongoId}>
                  <td className={td}>
                    <p className="font-bold text-slate-900 dark:text-white">{r.name || '—'}</p>
                    <p className="font-mono text-[10px] text-slate-400">{r.studentId}</p>
                  </td>
                  <td className={`${td} font-mono`}>{r.biometricId || '—'}</td>
                  <td className={td}>
                    <Badge cls={OUTCOME_STYLE[r.outcome].cls}>{OUTCOME_STYLE[r.outcome].label}</Badge>
                  </td>
                  <td className={`${td} text-slate-600 dark:text-slate-300`}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pushResults.results.some((r) => /push with overwrite/.test(r.message)) && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              <span>Some IDs are already on the machine under a different name. Overwrite only if they are the same people.</span>
              <button type="button" disabled={busy} onClick={() => push(true)} className={secondaryBtn}>
                Push with overwrite
              </button>
            </div>
          )}
        </Modal>
      )}
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Master sheet import / export
// ---------------------------------------------------------------------------

const SheetTab: React.FC<{ data: Overview; onDone: (msg: string) => void; onError: (msg: string) => void }> = ({ data, onDone, onError }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [defaults, setDefaults] = useState(data.settings.defaults);
  const [allowed, setAllowed] = useState(data.settings.applyTypeAllowed.join(', '));

  const send = (step: 'preview' | 'commit') => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    api
      .post(`/attendance/biometric/import/${step}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((res: any) => {
        setPreview(res.data);
        if (step === 'commit') onDone(res.message);
      })
      .catch((e: any) => {
        setPreview(null);
        onError(e.message);
      })
      .finally(() => setBusy(false));
  };

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(null);
  };

  const download = (format: 'xlsx' | 'xls' | 'csv') => {
    api
      .get('/attendance/biometric/export', { params: { format }, responseType: 'blob' })
      .then((blob: any) => {
        const url = URL.createObjectURL(blob as Blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `essl-master-${new Date().toISOString().slice(0, 10)}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e: any) => onError(e.status === 400 ? 'No students have an E Number yet, so there is nothing to export.' : e.message));
  };

  const saveSettings = () => {
    api
      .put('/attendance/biometric/settings', { defaults, applyTypeAllowed: allowed.split(',').map((v) => v.trim()).filter(Boolean) })
      .then((res: any) => onDone(res.message))
      .catch((e: any) => onError(e.message));
  };

  const committed = !!preview?.results;
  const toApply = preview ? preview.summary.link + preview.summary.update : 0;
  const shown = preview ? preview.rows.filter((r) => !onlyProblems || r.errors.length > 0 || r.warnings.length > 0) : [];
  const blank = data.exportReadiness.blank;
  const blankFields = (Object.keys(blank) as (keyof typeof blank)[]).filter((k) => blank[k] > 0);

  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Upload className="h-4 w-4 text-brand-600" /> Import the eSSL master sheet
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Columns: E Number, Name, Company, Department, Designation, Apply Type (optional: Card Number, Student ID). Rows are matched to a student by Student ID,
            then E Number, then one exact name match. Nothing is saved until you confirm the preview.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileInput.current?.click()} className={secondaryBtn}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> {file ? 'Choose another file' : 'Choose file'}
          </button>
          {file && <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{file.name}</span>}
          <button type="button" disabled={!file || busy} onClick={() => send('preview')} className={primaryBtn}>
            {busy && !committed ? 'Checking…' : 'Preview'}
          </button>
        </div>

        {preview && (
          <div className="space-y-3">
            {committed ? (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                Import finished: {preview.results!.applied} applied, {preview.results!.unchanged} unchanged, {preview.results!.skipped} skipped, {preview.results!.invalid} invalid,{' '}
                {preview.results!.failed} failed. {preview.results!.punchesLinked} waiting punch(es) linked.
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge cls={green}>{preview.summary.link} to link</Badge>
                <Badge cls={sky}>{preview.summary.update} to update</Badge>
                <Badge cls={grey}>{preview.summary.unchanged} unchanged</Badge>
                <Badge cls={amber}>{preview.summary.skip} skipped</Badge>
                <Badge cls={rose}>{preview.summary.error} with errors</Badge>
                <span className="text-slate-500">of {preview.summary.total} rows</span>
              </div>
            )}
            {!preview.applyTypeValidated && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Apply Type is only checked for blanks: its allowed values are not set (see settings below).
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} /> Show only rows with errors or warnings
              </label>
              {!committed && (
                <button type="button" disabled={busy || toApply === 0} onClick={() => send('commit')} className={primaryBtn}>
                  {busy ? 'Importing…' : `Import ${toApply} row${toApply === 1 ? '' : 's'}`}
                </button>
              )}
            </div>
            <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-100 dark:border-slate-800">
              <table className="w-full min-w-[900px] text-xs">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr>
                    {['Row', 'E Number', 'Name', 'Company / Dept / Designation / Apply Type', 'Student', committed ? 'Result' : 'Action', 'Notes'].map((h) => (
                      <th key={h} className={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {shown.length === 0 && <EmptyRow colSpan={7} text="No rows to show." />}
                  {shown.map((r) => {
                    const style = committed && r.result ? RESULT_STYLE[r.result] : ACTION_STYLE[r.action];
                    return (
                      <tr key={r.row}>
                        <td className={`${td} text-slate-400`}>{r.row}</td>
                        <td className={`${td} font-mono font-bold`}>{r.eNumber || '—'}</td>
                        <td className={td}>{r.name || '—'}</td>
                        <td className={`${td} text-slate-500`}>{[r.company, r.department, r.designation, r.applyType].map((v) => v || '—').join(' / ')}</td>
                        <td className={td}>{r.student ? <span className="font-mono text-[11px]">{r.student.studentId}</span> : <span className="text-slate-400">—</span>}</td>
                        <td className={td}>
                          <Badge cls={style.cls}>{style.label}</Badge>
                        </td>
                        <td className={`${td} space-y-0.5`}>
                          {r.errors.map((e) => (
                            <p key={e} className="text-rose-600">{e}</p>
                          ))}
                          {r.warnings.map((w) => (
                            <p key={w} className="text-amber-600">{w}</p>
                          ))}
                          {!r.errors.length && r.changes.map((c) => (
                            <p key={c} className="text-slate-500">{c}</p>
                          ))}
                          {committed && r.result === 'FAILED' && <p className="text-rose-600">{r.resultMessage}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <Download className="h-4 w-4 text-brand-600" /> Export for eSSL
        </h3>
        <p className="text-[11px] text-slate-500">
          {data.exportReadiness.students} student(s) with an E Number. Layout: {data.exportReadiness.layout}.
          {blankFields.length > 0 && (
            <span className="text-amber-700 dark:text-amber-300">
              {' '}
              Blank in the export: {blankFields.map((k) => `${k === 'applyType' ? 'Apply Type' : k[0].toUpperCase() + k.slice(1)} (${blank[k]})`).join(', ')}. Set defaults below.
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {(['xlsx', 'xls', 'csv'] as const).map((f) => (
            <button key={f} type="button" disabled={data.exportReadiness.students === 0} onClick={() => download(f)} className={secondaryBtn}>
              <Download className="h-3.5 w-3.5" /> .{f}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Master sheet settings</h3>
          <p className="mt-1 text-[11px] text-slate-500">Defaults fill the export when a student has no value of their own.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(['company', 'department', 'designation', 'applyType'] as const).map((k) => (
            <Field key={k} label={`Default ${k === 'applyType' ? 'Apply Type' : k[0].toUpperCase() + k.slice(1)}`}>
              <input value={defaults[k]} onChange={(e) => setDefaults({ ...defaults, [k]: e.target.value })} className={inputClass} />
            </Field>
          ))}
        </div>
        <Field label="Allowed Apply Type values" hint="Comma-separated, exactly as eSSL accepts them. Leave empty until confirmed: import then only warns about blanks.">
          <input value={allowed} onChange={(e) => setAllowed(e.target.value)} className={inputClass} />
        </Field>
        <button type="button" onClick={saveSettings} className={primaryBtn}>
          Save settings
        </button>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

const ReviewTab: React.FC<{ onDone: (msg: string) => void; onError: (msg: string) => void }> = ({ onDone, onError }) => {
  const [data, setData] = useState<ReviewData | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get('/attendance/biometric/review')
      .then((res: any) => setData(res.data))
      .catch((e: any) => onError(e.message));
  }, [onError]);
  useEffect(load, [load]);

  const [machine, setMachine] = useState<any>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [linking, setLinking] = useState('');
  const [filter, setFilter] = useState('');
  const loadMachine = useCallback(() => {
    api.get('/attendance/biometric/machine/status').then((res: any) => setMachine(res.data)).catch(() => undefined);
  }, []);
  useEffect(loadMachine, [loadMachine]);

  const readMachine = () => {
    setBusy(true);
    api
      .post('/attendance/biometric/machine/pull', {})
      .then((res: any) => {
        onDone(res.message);
        load();
      })
      .catch((e: any) => onError(e.message))
      .finally(() => {
        setBusy(false);
        loadMachine();
      });
  };

  // Confirm: the student gets this machine code as their E Number (and as a login ID); their punches link at once
  const link = (pin: string, studentMongoId: string) => {
    if (!studentMongoId) return;
    setLinking(pin);
    api
      .put(`/attendance/students/${studentMongoId}/biometric-id`, { biometricId: pin })
      .then((res: any) => {
        onDone(`${res.message}. ${res.data.relinked} punch(es) linked.`);
        load();
      })
      .catch((e: any) => onError(e.message))
      .finally(() => setLinking(''));
  };

  const rematch = () => {
    setBusy(true);
    api
      .post('/attendance/biometric/review/rematch', {})
      .then((res: any) => {
        onDone(res.message);
        load();
      })
      .catch((e: any) => onError(e.message))
      .finally(() => setBusy(false));
  };

  if (!data) return <Spinner />;

  const idTable = (rows: ReviewId[], empty: string, withNote: boolean) => (
    <table className="w-full text-xs">
      <thead>
        <tr>
          {['Machine ID', 'Punches', 'Last punch (IST)', ...(withNote ? ['Why it is held'] : [])].map((h) => (
            <th key={h} className={th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.length === 0 && <EmptyRow colSpan={withNote ? 4 : 3} text={empty} />}
        {rows.map((u) => (
          <tr key={u.userPin}>
            <td className={`${td} font-mono font-bold text-slate-900 dark:text-white`}>{u.userPin}</td>
            <td className={td}>{u.punches}</td>
            <td className={td}>{u.lastLocal}</td>
            {withNote && <td className={`${td} text-rose-600`}>{u.note}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Punches here are stored but not counted. They are never attached to a student by guesswork: give the right student this E Number (Biometric Live or the
          Students tab), then re-check.
        </p>
        <button type="button" disabled={busy} onClick={rematch} className={secondaryBtn}>
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Re-check against current IDs
        </button>
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="font-bold text-slate-900 dark:text-white">Reading from the machine</p>
            {!machine ? (
              <p className="text-slate-500">Checking…</p>
            ) : !machine.configured ? (
              <p className="text-amber-600">Off. Run the campus helper on a computer at the campus, or set ESSL_DEVICE_HOST in the backend .env.</p>
            ) : machine.lastPull ? (
              <p className={machine.lastPull.ok ? 'text-slate-500' : 'text-rose-600'}>
                {machine.mode === 'agent' ? 'Campus helper, last report' : 'Last read'} {new Date(machine.lastPull.at).toLocaleString()}: {machine.lastPull.message}
              </p>
            ) : machine.mode === 'agent' ? (
              <p className="text-slate-500">The campus helper reads the machine every few minutes and sends new punches here. Waiting for its first report since the server started.</p>
            ) : (
              <p className="text-slate-500">Reads automatically every few minutes. Nothing is changed on the machine.</p>
            )}
          </div>
          <button
            type="button"
            disabled={busy || machine?.mode !== 'direct'}
            title={machine?.mode === 'agent' ? 'Readings come from the campus helper automatically' : undefined}
            onClick={readMachine}
            className={primaryBtn}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /> Read from machine now
          </button>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Machine codes not linked to a student ({data.unknownIds.length})</h3>
            <p className="text-[11px] text-slate-500">
              Codes are given by the admins in eSSL Web. Pick the student and click Confirm: the code becomes their E Number and their login ID, and their punches show
              up at once.
            </p>
          </div>
          <label className="relative block w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input id="review-filter" className={`${inputClass} pl-8 !py-1.5 text-xs`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search code or name" />
          </label>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr>
                {['Machine code', 'Name on machine', 'Punches', 'Last punch (IST)', 'Link to student'].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.unknownIds.length === 0 && <EmptyRow colSpan={5} text="Every code on the machine is linked to a student." />}
              {data.unknownIds
                .filter((u) => !filter.trim() || `${u.userPin} ${u.machineName || ''}`.toLowerCase().includes(filter.trim().toLowerCase()))
                .map((u) => {
                  const chosen = picks[u.userPin] ?? u.suggestion?._id ?? '';
                  return (
                    <tr key={u.userPin}>
                      <td className={`${td} font-mono font-bold text-slate-900 dark:text-white`}>{u.userPin}</td>
                      <td className={td}>
                        {u.machineName || <span className="text-slate-400">—</span>}
                        {u.isMachineAdmin && <span className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold ${grey}`}>Machine admin</span>}
                      </td>
                      <td className={td}>{u.punches || <span className="text-slate-400">none yet</span>}</td>
                      <td className={td}>{u.lastLocal || '—'}</td>
                      <td className={td}>
                        {u.isMachineAdmin ? (
                          <span className="text-slate-400">Staff account, not a student</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              id={`link-${u.userPin}`}
                              className={`${inputClass} !w-56 !py-1 text-xs`}
                              value={chosen}
                              onChange={(e) => setPicks((p) => ({ ...p, [u.userPin]: e.target.value }))}
                            >
                              <option value="">Choose student…</option>
                              {data.candidates.map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.fullName} ({c.studentId})
                                </option>
                              ))}
                            </select>
                            <button type="button" disabled={!chosen || linking === u.userPin} onClick={() => link(u.userPin, chosen)} className={`${primaryBtn} !px-2.5 !py-1`}>
                              {linking === u.userPin ? 'Linking…' : 'Confirm'}
                            </button>
                            {u.suggestion && !picks[u.userPin] && <span className="text-[10px] font-semibold text-emerald-600">Same name</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <h3 className="border-b border-slate-100 dark:border-slate-800 p-4 text-sm font-bold text-slate-900 dark:text-white">Conflicting IDs ({data.conflicts.length})</h3>
        <div className="overflow-x-auto">{idTable(data.conflicts, 'No conflicting IDs.', true)}</div>
      </Card>
      <Card className="overflow-hidden">
        <h3 className="border-b border-slate-100 dark:border-slate-800 p-4 text-sm font-bold text-slate-900 dark:text-white">
          Punches outside {data.window.start}–{data.window.end} ({data.outOfWindow.length})
        </h3>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {['Date', 'Time', 'IN / OUT', 'Machine ID', 'Student'].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.outOfWindow.length === 0 && <EmptyRow colSpan={5} text="No punches outside the attendance window." />}
              {data.outOfWindow.map((p) => (
                <tr key={p._id}>
                  <td className={td}>{p.date}</td>
                  <td className={td}>{p.time}</td>
                  <td className={td}>{p.direction === 'UNKNOWN' ? '—' : p.direction}</td>
                  <td className={`${td} font-mono`}>{p.userPin}</td>
                  <td className={td}>{p.name ? `${p.name} (${p.studentId})` : <span className="text-slate-400">not linked</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sync log
// ---------------------------------------------------------------------------

const LEVEL_STYLE: Record<LogRow['level'], string> = { INFO: grey, WARN: amber, ERROR: rose };

const LogsTab: React.FC<{ onError: (msg: string) => void }> = ({ onError }) => {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [level, setLevel] = useState('');

  useEffect(() => {
    api
      .get('/attendance/biometric/logs', { params: level ? { level } : {} })
      .then((res: any) => setLogs(res.data))
      .catch((e: any) => onError(e.message));
  }, [level, onError]);

  if (!logs) return <Spinner />;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Last {logs.length} events (kept for 90 days)</h3>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Filter by level" className={`${inputClass} !w-40 !py-1.5 text-xs`}>
          <option value="">All levels</option>
          <option value="ERROR">Errors</option>
          <option value="WARN">Warnings</option>
          <option value="INFO">Info</option>
        </select>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {['Time (IST)', 'Level', 'Type', 'What happened'].map((h) => (
                <th key={h} className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.length === 0 && <EmptyRow colSpan={4} text="Nothing logged yet." />}
            {logs.map((l) => (
              <tr key={l._id}>
                <td className={`${td} whitespace-nowrap text-slate-500`}>{istTime(l.at)}</td>
                <td className={td}>
                  <Badge cls={LEVEL_STYLE[l.level]}>{l.level}</Badge>
                </td>
                <td className={`${td} text-slate-500`}>{l.kind}</td>
                <td className={`${td} text-slate-700 dark:text-slate-200`}>{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
