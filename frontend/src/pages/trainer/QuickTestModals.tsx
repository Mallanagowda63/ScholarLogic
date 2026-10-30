import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Link2, Upload } from 'lucide-react';
import { api } from '../../services/api';
import { ErrorNote, Field, Modal, inputClass, primaryBtn, secondaryBtn } from '../admin/tracking/shared';

// Trainer tests the quick way: an MCQ test from an Excel sheet, or a technical test given as a link

const readBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(file);
  });

export const downloadMcqTemplate = async () => {
  const blob: any = await api.get('/exams/excel/template', { responseType: 'blob' as any });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
  a.download = 'ScholarLogic-MCQ-test-format.xlsx';
  a.click();
  URL.revokeObjectURL(a.href);
};

const LETTER = ['1', '2', '3', '4'];

export const ExcelMcqTestModal: React.FC<{ onClose: () => void; onDone: (message: string) => void }> = ({ onClose, onDone }) => {
  const [form, setForm] = useState({ title: '', durationMinutes: 60, marksPerQuestion: 1, passPercentage: 40, attemptLimit: 1 });
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<{ count: number; errors: string[]; sample: { question: string; options: string[]; correct: number }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (f?: File) => {
    setPreview(null);
    setError('');
    if (!f) return setFile(null);
    if (f.size > 1.4 * 1024 * 1024) return setError('This file is too big. 500 questions fit easily in a normal Excel file; remove pictures or extra sheets.');
    setBusy(true);
    try {
      const base64 = await readBase64(f);
      setFile({ name: f.name, base64 });
      const res: any = await api.post('/exams/excel/preview', { fileBase64: base64 });
      setPreview(res.data);
      if (!form.title) setForm((x) => ({ ...x, title: f.name.replace(/\.(xlsx|xls|csv)$/i, '') }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const res: any = await api.post('/exams/excel', { ...form, fileBase64: file.base64 });
      onDone(res.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ready = preview && preview.count > 0 && preview.errors.length === 0;
  return (
    <Modal title="MCQ test from Excel" subtitle="Up to 500 questions. Students get them in the same order as the sheet." onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-50 p-3 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
        <span>
          Format: <b>Question | Option 1 | Option 2 | Option 3 | Option 4 | Correct Answer</b> (1, 2, 3 or 4)
        </span>
        <button type="button" className={secondaryBtn} onClick={() => downloadMcqTemplate().catch((err) => setError(err.message))}>
          <Download className="h-4 w-4" /> Download format
        </button>
      </div>
      <ErrorNote text={error} />
      <form onSubmit={publish} className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 hover:border-brand-400 dark:border-slate-700">
          <Upload className="h-6 w-6 text-brand-600" />
          {file ? <span className="font-semibold text-slate-800 dark:text-slate-200">{file.name}</span> : 'Choose the filled Excel file (.xlsx or .csv)'}
          <input id="mcq-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </label>

        {busy && !preview && <p className="text-xs text-slate-500">Reading the sheet…</p>}
        {preview && (
          <div className="space-y-2">
            <p className={`flex items-center gap-2 text-sm font-bold ${ready ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {preview.count} questions read{preview.errors.length ? `, ${preview.errors.length} problem(s) to fix in the sheet:` : '. Ready to publish.'}
            </p>
            {preview.errors.length > 0 && (
              <ul className="max-h-32 list-disc overflow-y-auto rounded-xl bg-amber-50 p-3 pl-7 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {preview.errors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            {preview.sample.length > 0 && (
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                {preview.sample.map((q, i) => (
                  <div key={i}>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {i + 1}. {q.question}
                    </p>
                    <p className="text-slate-500">
                      {q.options.map((o, j) => (
                        <span key={j} className={j === q.correct ? 'font-bold text-emerald-600' : ''}>
                          {LETTER[j]}) {o}
                          {j < 3 ? '   ' : ''}
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
                {preview.count > preview.sample.length && <p className="text-slate-400">…and {preview.count - preview.sample.length} more</p>}
              </div>
            )}
          </div>
        )}

        <Field label="Test name" required>
          <input id="mcq-title" className={inputClass} value={form.title} onChange={(e) => setForm((x) => ({ ...x, title: e.target.value }))} required />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Time (minutes)">
            <input type="number" min={1} className={inputClass} value={form.durationMinutes} onChange={(e) => setForm((x) => ({ ...x, durationMinutes: Number(e.target.value) }))} />
          </Field>
          <Field label="Marks per question">
            <input type="number" min={0.25} step={0.25} className={inputClass} value={form.marksPerQuestion} onChange={(e) => setForm((x) => ({ ...x, marksPerQuestion: Number(e.target.value) }))} />
          </Field>
          <Field label="Pass %">
            <input type="number" min={0} max={100} className={inputClass} value={form.passPercentage} onChange={(e) => setForm((x) => ({ ...x, passPercentage: Number(e.target.value) }))} />
          </Field>
          <Field label="Attempts allowed">
            <input type="number" min={1} className={inputClass} value={form.attemptLimit} onChange={(e) => setForm((x) => ({ ...x, attemptLimit: Number(e.target.value) }))} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn} disabled={busy || !ready}>
            <FileSpreadsheet className="h-4 w-4" /> {busy && preview ? 'Publishing…' : `Publish test${preview?.count ? ` (${preview.count} questions)` : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const LinkTestModal: React.FC<{ onClose: () => void; onDone: (message: string) => void }> = ({ onClose, onDone }) => {
  const [form, setForm] = useState({ title: '', testLink: '', durationMinutes: 60, description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res: any = await api.post('/exams/link', form);
      onDone(res.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Technical test (link)" subtitle="For coding tests on HackerRank, HackerEarth, Google Forms, etc. Students get an Open test button." onClose={onClose}>
      <ErrorNote text={error} />
      <form onSubmit={publish} className="space-y-3">
        <Field label="Test name" required>
          <input id="link-title" className={inputClass} value={form.title} onChange={(e) => setForm((x) => ({ ...x, title: e.target.value }))} placeholder="Python coding round" required />
        </Field>
        <Field label="Test link" required>
          <input id="link-url" className={inputClass} value={form.testLink} onChange={(e) => setForm((x) => ({ ...x, testLink: e.target.value }))} placeholder="https://" required />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Time (minutes)">
            <input type="number" min={1} className={inputClass} value={form.durationMinutes} onChange={(e) => setForm((x) => ({ ...x, durationMinutes: Number(e.target.value) }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Instructions" hint="Optional">
              <input className={inputClass} value={form.description} onChange={(e) => setForm((x) => ({ ...x, description: e.target.value }))} placeholder="Use your Student ID as the name" />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn} disabled={busy}>
            <Link2 className="h-4 w-4" /> {busy ? 'Publishing…' : 'Publish test link'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
