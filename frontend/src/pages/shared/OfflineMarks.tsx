import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Download, FileSpreadsheet, Trash2, Trophy, Upload } from 'lucide-react';
import { api } from '../../services/api';
import { Card, Modal, PageHeader, Spinner, inputClass, primaryBtn, secondaryBtn, useToast } from '../admin/tracking/shared';

// Trainer / admin → Offline Test Marks: download the batch's Excel, fill marks, upload, check, save.
// Saved marks count in the "Top students" leaderboard on every student's dashboard.

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

async function downloadTemplate(batchId: string, outOf: string, label: string) {
  const res: any = await api.get(`/offline-tests/template?${new URLSearchParams({ ...(batchId ? { batchId } : {}), outOf: outOf || '100' })}`, { responseType: 'blob' as any });
  const blob = res instanceof Blob ? res : new Blob([res]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `marks-${label}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const UploadModal: React.FC<{ batches: any[]; onClose: () => void; onSaved: (m: string) => void }> = ({ batches, onClose, onSaved }) => {
  const [batchId, setBatchId] = useState(batches[0]?._id || '');
  const [name, setName] = useState('');
  const [date, setDate] = useState(today());
  const [outOf, setOutOf] = useState('100');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: any[]; missing: any[]; fileName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const batch = batches.find((b) => b._id === batchId);
  const good = preview?.rows.filter((r) => r.ok) || [];

  const check = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('batchId', batchId);
      fd.append('outOf', outOf);
      const res: any = await api.post('/offline-tests/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(res.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const res: any = await api.post('/offline-tests', { batchId, name: name.trim(), date, rows: preview?.rows, fileName: preview?.fileName });
      onSaved(res.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal wide title="Upload offline test marks" subtitle="1. Download the Excel for the batch • 2. Fill the Marks column • 3. Upload and check • 4. Save" onClose={() => !busy && onClose()}>
      {error && <p className="mb-3 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
      {!preview ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Batch
              <select className={`${inputClass} mt-1`} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                {batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.batchCode} • {b.subject} {b.timing ? `• ${b.timing}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Test name
              <input className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SQL Weekly Test 1" />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Test date
              <input type="date" className={`${inputClass} mt-1`} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Total marks (Out of)
              <input type="number" min={1} className={`${inputClass} mt-1`} value={outOf} onChange={(e) => setOutOf(e.target.value)} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-4 dark:border-brand-800 dark:bg-brand-950/20">
            <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
            <div className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-bold text-slate-900 dark:text-white">Step 1: Excel with {batch?.batchCode || 'the batch'}'s students</p>
              Student ID and Name are already filled. Type the marks and save it.
            </div>
            <button type="button" className={secondaryBtn} disabled={!batchId} onClick={() => downloadTemplate(batchId, outOf, batch?.batchCode || 'batch').catch((e) => setError(e.message))}>
              <Download className="h-4 w-4" /> Download Excel
            </button>
          </div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
            Step 2: the filled Excel
            <input type="file" accept=".xlsx,.xls,.csv" className={`${inputClass} mt-1`} onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondaryBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={primaryBtn} disabled={busy || !file || !batchId || !name.trim()} onClick={check}>
              <Upload className="h-4 w-4" /> {busy ? 'Reading…' : 'Upload & check'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            <b className="text-slate-900 dark:text-white">{name}</b> • {batch?.batchCode} • {fmtDay(date)} • from {preview.fileName}
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{good.length} ready to save</span>
            {preview.rows.length - good.length > 0 && <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{preview.rows.length - good.length} skipped</span>}
            {preview.missing.length > 0 && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{preview.missing.length} batch students not in the file</span>}
          </div>
          <div className="max-h-[45vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  {['', 'Student ID', 'Name', 'Marks', 'Out of', 'Check'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.rows.map((r, i) => (
                  <tr key={i} className={r.ok ? '' : 'bg-amber-50/60 dark:bg-amber-950/20'}>
                    <td className="px-3 py-1.5">{r.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}</td>
                    <td className="px-3 py-1.5 font-mono">{r.code}</td>
                    <td className="px-3 py-1.5 font-semibold text-slate-900 dark:text-white">{r.student?.fullName || r.name}</td>
                    <td className="px-3 py-1.5 font-bold">{r.marks ?? '—'}</td>
                    <td className="px-3 py-1.5">{r.outOf || '—'}</td>
                    <td className="px-3 py-1.5 text-[11px] text-slate-500">{r.ok ? 'OK' : r.problem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.missing.length > 0 && <p className="text-[11px] text-slate-500">Not in the file: {preview.missing.map((m: any) => m.fullName).join(', ')}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondaryBtn} disabled={busy} onClick={() => setPreview(null)}>
              Back
            </button>
            <button type="button" className={primaryBtn} disabled={busy || !good.length} onClick={save}>
              <CheckCircle2 className="h-4 w-4" /> {busy ? 'Saving…' : `Save marks for ${good.length}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export const OfflineMarks: React.FC = () => {
  const toast = useToast();
  const [tests, setTests] = useState<any[] | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [removing, setRemoving] = useState<any | null>(null);

  const load = () =>
    api
      .get('/offline-tests')
      .then((r: any) => setTests(r.data.tests))
      .catch((e: any) => {
        setTests([]);
        toast.show(e.message);
      });
  useEffect(() => {
    load();
    api.get('/offline-tests/batches').then((r: any) => setBatches(r.data.batches)).catch(() => undefined);
  }, []);

  const totals = useMemo(() => ({ tests: (tests || []).length, marks: (tests || []).reduce((n, t) => n + t.count, 0) }), [tests]);

  const remove = async () => {
    try {
      const res: any = await api.delete(`/offline-tests/${removing._id}`);
      toast.show(res.message);
      setRemoving(null);
      load();
    } catch (e: any) {
      toast.show(e.message);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Offline Test Marks"
        subtitle="For written or classroom tests: download the batch's Excel, fill the marks, upload it. The marks count in the Top students list on every student's dashboard."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryBtn} onClick={() => downloadTemplate('', '50', 'demo').catch((e) => toast.show(e.message))}>
              <Download className="h-4 w-4" /> Demo Excel
            </button>
            <button type="button" className={primaryBtn} disabled={!batches.length} onClick={() => setUploading(true)} title={batches.length ? '' : 'You have no batch yet'}>
              <Upload className="h-4 w-4" /> Upload marks
            </button>
          </div>
        }
      />
      {tests && (
        <p className="text-xs text-slate-500">
          {totals.tests} test{totals.tests === 1 ? '' : 's'} uploaded • {totals.marks} student marks
        </p>
      )}
      {!tests ? (
        <Spinner />
      ) : tests.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">No offline test marks yet. Press “Upload marks” to add the first test.</Card>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => (
            <Card key={t._id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.batchCode} • {fmtDay(t.date)} • {t.count} students • out of {t.outOf} • average {t.average}%
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {t.top.map((x: any, i: number) => (
                    <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${['bg-amber-100 text-amber-800', 'bg-slate-200 text-slate-700', 'bg-orange-100 text-orange-800'][i]} dark:bg-slate-800 dark:text-slate-200`}>
                      <Trophy className="h-3 w-3" /> {x.name} {x.marks}/{x.outOf}
                    </span>
                  ))}
                  <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => setOpen(open === t._id ? null : t._id)}>
                    {open === t._id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} All marks
                  </button>
                  <button type="button" title="Remove this test" aria-label={`Remove ${t.name}`} onClick={() => setRemoving(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {open === t._id && (
                <ol className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {t.entries.map((e: any, i: number) => (
                    <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs dark:bg-slate-800/50">
                      <span>
                        <span className="mr-1.5 font-bold text-slate-400">{i + 1}.</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{e.name}</span> <span className="font-mono text-[10px] text-slate-400">{e.studentCode}</span>
                      </span>
                      <span className="font-bold">
                        {e.marks}/{e.outOf} <span className="font-normal text-slate-400">({e.percentage}%)</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ))}
        </div>
      )}

      {uploading && (
        <UploadModal
          batches={batches}
          onClose={() => setUploading(false)}
          onSaved={(m) => {
            setUploading(false);
            toast.show(m);
            load();
          }}
        />
      )}
      {removing && (
        <Modal title={`Remove “${removing.name}”?`} subtitle={`${removing.batchCode} • ${removing.count} students`} onClose={() => setRemoving(null)}>
          <p className="text-sm text-slate-600 dark:text-slate-300">These marks are taken out of the Top students list. You can upload the Excel again later.</p>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" className={secondaryBtn} onClick={() => setRemoving(null)}>
              Keep
            </button>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
};
