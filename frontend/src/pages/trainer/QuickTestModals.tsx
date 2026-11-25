import React, { useEffect, useState } from 'react';
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
  const [mode, setMode] = useState<'coding' | 'outside'>('coding');
  const [form, setForm] = useState({ title: '', testLink: '', durationMinutes: 60, description: '' });
  const [folders, setFolders] = useState<any[] | null>(null);
  const [folderId, setFolderId] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [randomCount, setRandomCount] = useState(0);
  const [published, setPublished] = useState<{ title: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/coding/folders')
      .then((r: any) => setFolders(r.data.folders.filter((f: any) => f.questionCount > 0)))
      .catch(() => setFolders([]));
  }, []);
  useEffect(() => {
    setQuestions([]);
    setPicked([]);
    if (!folderId) return;
    api.get(`/coding/folders/${folderId}/questions`).then((r: any) => setQuestions(r.data.questions)).catch((e: any) => setError(e.message));
  }, [folderId]);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'outside') {
        const res: any = await api.post('/exams/link', form);
        onDone(res.message);
        return;
      }
      const res: any = await api.post('/coding/tests', { title: form.title, description: form.description, durationMinutes: form.durationMinutes, folderId, questionIds: picked, randomCount: picked.length ? 0 : randomCount });
      setPublished({ title: res.data.test.title, link: res.data.link });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    if (!published) return;
    navigator.clipboard?.writeText(published.link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => undefined
    );
  };

  if (published)
    return (
      <Modal title="Coding test published" subtitle={published.title} onClose={() => onDone('Coding test published')}>
        <p className="text-sm text-slate-600 dark:text-slate-300">Share this link with the students. They log in, press Start, and solve the questions in the IDE. It is also on their Exams page.</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-900 dark:bg-brand-950/30">
          <Link2 className="h-4 w-4 shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-brand-700 dark:text-brand-300">{published.link}</span>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <a
            className={secondaryBtn}
            href={`https://wa.me/?text=${encodeURIComponent(`${published.title}: coding test on ScholarLogic\n${published.link}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on WhatsApp
          </a>
          <button type="button" className={primaryBtn} onClick={copy}>
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </Modal>
    );

  const allPicked = questions.length > 0 && picked.length === questions.length;
  const ready = mode === 'outside' ? !!form.title.trim() && !!form.testLink.trim() : !!form.title.trim() && !!folderId && (picked.length > 0 || randomCount > 0);

  return (
    <Modal wide={mode === 'coding'} title="Technical test (link)" subtitle="Make a coding test with a shareable link, or publish a test from another site." onClose={onClose}>
      <ErrorNote text={error} />
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(
          [
            ['coding', 'ScholarLogic coding test', 'Questions from Technical Practice, solved in our IDE'],
            ['outside', 'Outside link', 'HackerRank, HackerEarth, Google Forms…'],
          ] as const
        ).map(([k, t, d]) => (
          <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-xl border p-3 text-left ${mode === k ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:bg-brand-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
            <span className="block text-sm font-bold text-slate-900 dark:text-white">{t}</span>
            <span className="block text-[11px] text-slate-500">{d}</span>
          </button>
        ))}
      </div>
      <form onSubmit={publish} className="space-y-3">
        <Field label="Test name" required>
          <input id="link-title" className={inputClass} value={form.title} onChange={(e) => setForm((x) => ({ ...x, title: e.target.value }))} placeholder="Python coding round" required />
        </Field>
        {mode === 'outside' ? (
          <Field label="Test link" required>
            <input id="link-url" className={inputClass} value={form.testLink} onChange={(e) => setForm((x) => ({ ...x, testLink: e.target.value }))} placeholder="https://" required />
          </Field>
        ) : (
          <>
            <Field label="Questions from folder" required>
              <select className={inputClass} value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                <option value="">{folders === null ? 'Loading…' : folders.length ? 'Choose a Technical Practice folder' : 'No folder with questions yet: add them in Technical Practice'}</option>
                {(folders || []).map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} ({f.language}, {f.questionCount} questions)
                  </option>
                ))}
              </select>
            </Field>
            {questions.length > 0 && (
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? [] : questions.map((q) => String(q._id)))} /> Pick questions ({picked.length} chosen)
                  </label>
                  <label className="flex items-center gap-2 text-slate-500">
                    or random
                    <input type="number" min={0} max={questions.length} className={`${inputClass} !w-20 !py-1 text-xs`} value={randomCount} disabled={picked.length > 0} onChange={(e) => setRandomCount(Number(e.target.value))} />
                    of {questions.length}
                  </label>
                </div>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {questions.map((q, i) => (
                    <li key={q._id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-slate-800">
                        <input type="checkbox" checked={picked.includes(String(q._id))} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, String(q._id)] : p.filter((x) => x !== String(q._id))))} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {i + 1}. {q.title}
                        </span>
                        <span className="text-slate-400">• {q.difficulty.toLowerCase()} • {q.tests.length} tests</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Time (minutes)">
            <input type="number" min={1} className={inputClass} value={form.durationMinutes} onChange={(e) => setForm((x) => ({ ...x, durationMinutes: Number(e.target.value) }))} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Instructions" hint="Optional">
              <input className={inputClass} value={form.description} onChange={(e) => setForm((x) => ({ ...x, description: e.target.value }))} placeholder={mode === 'coding' ? 'Solve all questions; Submit each answer, then Finish test' : 'Use your Student ID as the name'} />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn} disabled={busy || !ready}>
            <Link2 className="h-4 w-4" /> {busy ? 'Publishing…' : mode === 'coding' ? 'Publish & get link' : 'Publish test link'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
