import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Code2, Download, Eye, FolderOpen, FolderPlus, Loader2, Pencil, Play, Plus, Trash2, Upload, Wand2, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { CodeEditor } from '../../components/CodeEditor';
import { Lang, LANG_LABEL, runCode, runTests, warmUp } from '../../services/codeRunner';
import { Card, Modal, PageHeader, Spinner, inputClass, primaryBtn, secondaryBtn, useToast } from '../admin/tracking/shared';
import { CodingTestsPanel } from './CodingTestsPanel';

// Trainer / admin → Technical Practice: folders (e.g. "If-else") of coding questions with test cases.
// Students solve them in the browser IDE; each submission is listed here and the folder's trainer is notified.

const when = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const STATUS_CLS: Record<string, string> = {
  PASSED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  PARTIAL: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  FAILED: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

const FolderModal: React.FC<{ folder?: any; batches: any[]; onClose: () => void; onDone: (m: string) => void }> = ({ folder, batches, onClose, onDone }) => {
  const [name, setName] = useState(folder?.name || '');
  const [description, setDescription] = useState(folder?.description || '');
  const [language, setLanguage] = useState<Lang>(folder?.language || 'python');
  const [batchIds, setBatchIds] = useState<string[]>((folder?.batchIds || []).map(String));
  const [error, setError] = useState('');
  const save = async () => {
    try {
      const body = { name, description, language, batchIds };
      const r: any = folder ? await api.put(`/coding/folders/${folder._id}`, body) : await api.post('/coding/folders', body);
      onDone(r.message);
    } catch (e: any) {
      setError(e.message);
    }
  };
  return (
    <Modal title={folder ? `Edit “${folder.name}”` : 'New folder'} subtitle="A folder holds questions on one topic, e.g. If-else, Loops, Joins." onClose={onClose}>
      {error && <p className="mb-2 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">{error}</p>}
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Folder name
          <input className={`${inputClass} mt-1`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. If-else" />
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Short description (optional)
          <input className={`${inputClass} mt-1`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Conditions with if, elif and else" />
        </label>
        {!folder && (
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Language
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(['python', 'sql', 'javascript'] as Lang[]).map((l) => (
                <button key={l} type="button" onClick={() => setLanguage(l)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${language === l ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700'}`}>
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          Who can see it
          <p className="font-normal text-slate-400">No batch ticked = every student.</p>
          <div className="mt-1 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
            {batches.map((b) => (
              <label key={b._id} className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold ${batchIds.includes(String(b._id)) ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                <input type="checkbox" className="sr-only" checked={batchIds.includes(String(b._id))} onChange={(e) => setBatchIds((x) => (e.target.checked ? [...x, String(b._id)] : x.filter((y) => y !== String(b._id))))} />
                {b.batchCode}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button type="button" className={secondaryBtn} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={primaryBtn} disabled={!name.trim()} onClick={save}>
          Save folder
        </button>
      </div>
    </Modal>
  );
};

const QuestionModal: React.FC<{ folder: any; question?: any; onClose: () => void; onDone: (m: string) => void }> = ({ folder, question, onClose, onDone }) => {
  const lang: Lang = folder.language;
  const [f, setF] = useState({
    title: question?.title || '',
    description: question?.description || '',
    difficulty: question?.difficulty || 'EASY',
    starterCode: question?.starterCode || '',
    solution: question?.solution || '',
    sqlSetup: question?.sqlSetup || '',
  });
  const [tests, setTests] = useState<{ input: string; expected: string; hidden: boolean }[]>(question?.tests?.length ? question.tests : [{ input: '', expected: '', hidden: false }]);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  useEffect(() => warmUp(lang), [lang]);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const setTest = (i: number, k: 'input' | 'expected' | 'hidden', v: any) => setTests((t) => t.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  // Runs the trainer's solution on every test input and writes its output as the expected output
  const fillFromSolution = async () => {
    if (!f.solution.trim()) return setError('Write your solution first');
    setBusy('fill');
    setError('');
    const out = [];
    for (const t of tests) {
      const r = await runCode(lang, f.solution, { input: t.input, setup: f.sqlSetup });
      if (r.error) {
        setBusy('');
        return setError(`Your solution failed on a test: ${r.error}`);
      }
      out.push({ ...t, expected: r.stdout.replace(/\s+$/, '') });
    }
    setTests(out);
    setBusy('');
    setNote('Expected outputs filled from your solution.');
  };
  const checkSolution = async () => {
    setBusy('check');
    setError('');
    const res = await runTests(lang, f.solution, tests, f.sqlSetup);
    setBusy('');
    setNote(`Your solution passes ${res.filter((r) => r.passed).length}/${res.length} tests.`);
  };
  const save = async () => {
    setBusy('save');
    setError('');
    try {
      const body = { ...f, tests };
      const r: any = question ? await api.put(`/coding/questions/${question._id}`, body) : await api.post(`/coding/folders/${folder._id}/questions`, body);
      onDone(r.message);
    } catch (e: any) {
      setError(e.message);
      setBusy('');
    }
  };

  return (
    <Modal wide title={question ? 'Edit question' : `New question in “${folder.name}”`} subtitle={`${LANG_LABEL[lang]} • students see the title, question, examples (visible tests) and starter code`} onClose={() => !busy && onClose()}>
      {error && <p className="mb-2 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">{error}</p>}
      {note && <p className="mb-2 rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">{note}</p>}
      <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
          <input className={inputClass} value={f.title} onChange={(e) => set('title')(e.target.value)} placeholder="Title, e.g. Even or odd" />
          <select className={inputClass} value={f.difficulty} onChange={(e) => set('difficulty')(e.target.value)}>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>
        <textarea className={`${inputClass} min-h-[90px]`} value={f.description} onChange={(e) => set('description')(e.target.value)} placeholder="The question: what the program reads and what it must print" />
        {lang === 'sql' && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Tables (CREATE TABLE and INSERT, run before the student's query)</p>
            <CodeEditor lang="sql" value={f.sqlSetup} onChange={set('sqlSetup')} height={140} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Starter code (students start with this)</p>
            <CodeEditor lang={lang} value={f.starterCode} onChange={set('starterCode')} height={160} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Your solution (only you see it)</p>
            <CodeEditor lang={lang} value={f.solution} onChange={set('solution')} height={160} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryBtn} disabled={!!busy || !f.solution.trim()} onClick={fillFromSolution}>
            {busy === 'fill' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Fill outputs from my solution
          </button>
          <button type="button" className={secondaryBtn} disabled={!!busy || !f.solution.trim()} onClick={checkSolution}>
            {busy === 'check' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Check my solution
          </button>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Test cases {lang === 'sql' ? '(Input = extra SQL for that test, usually empty)' : '(Input = what the program reads; Output = exactly what it must print)'}</p>
          <div className="space-y-2">
            {tests.map((t, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700 sm:grid-cols-[1fr_1fr_auto]">
                <textarea className={`${inputClass} font-mono text-xs`} rows={2} value={t.input} onChange={(e) => setTest(i, 'input', e.target.value)} placeholder={`Input ${i + 1}`} />
                <textarea className={`${inputClass} font-mono text-xs`} rows={2} value={t.expected} onChange={(e) => setTest(i, 'expected', e.target.value)} placeholder={`Expected output ${i + 1}`} />
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <input type="checkbox" checked={t.hidden} onChange={(e) => setTest(i, 'hidden', e.target.checked)} /> Hidden
                  </label>
                  <button type="button" aria-label={`Remove test ${i + 1}`} onClick={() => setTests((x) => x.filter((_, j) => j !== i))} className="rounded-lg p-1 text-slate-400 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {tests.length < 20 && (
            <button type="button" className="mt-2 text-xs font-bold text-brand-600 hover:underline" onClick={() => setTests((x) => [...x, { input: '', expected: '', hidden: x.length >= 2 }])}>
              + Add test case
            </button>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <button type="button" className={secondaryBtn} disabled={!!busy} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={primaryBtn} disabled={!!busy || !f.title.trim() || !tests.some((t) => t.expected.trim())} onClick={save}>
          {busy === 'save' ? 'Saving…' : 'Save question'}
        </button>
      </div>
    </Modal>
  );
};

export const CodingBank: React.FC = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [folders, setFolders] = useState<any[] | null>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [current, setCurrent] = useState<{ folder: any; questions: any[]; canEdit: boolean } | null>(null);
  const [subs, setSubs] = useState<any[] | null>(null);
  const [dialog, setDialog] = useState<any>(null);
  const folderId = params.get('folder') || '';
  const tab = params.get('tab') === 'submissions' ? 'submissions' : 'questions';

  const loadFolders = () => api.get('/coding/folders').then((r: any) => setFolders(r.data.folders)).catch((e: any) => toast.show(e.message));
  const loadFolder = (id: string) => {
    setCurrent(null);
    setSubs(null);
    api.get(`/coding/folders/${id}/questions`).then((r: any) => setCurrent(r.data)).catch((e: any) => toast.show(e.message));
    api.get(`/coding/submissions?folderId=${id}`).then((r: any) => setSubs(r.data.submissions)).catch(() => setSubs([]));
  };
  useEffect(() => {
    loadFolders();
    api.get('/coding/batches').then((r: any) => setBatches(r.data.batches)).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (folderId) loadFolder(folderId);
  }, [folderId]);
  // Opened from a "finished the test" notification
  useEffect(() => {
    if (params.get('tests')) setDialog({ kind: 'tests', testId: params.get('test') || '' });
  }, []);

  const open = (id: string, t = 'questions') => setParams(id ? { folder: id, tab: t } : {});
  const done = (m: string) => {
    setDialog(null);
    toast.show(m);
    loadFolders();
    if (folderId) loadFolder(folderId);
  };

  const downloadTemplate = async () => {
    try {
      const res: any = await api.get('/coding/import-template', { responseType: 'blob' as any });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res instanceof Blob ? res : new Blob([res]));
      a.download = 'coding-questions-template.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      toast.show(e.message);
    }
  };
  const importExcel = async (file: File) => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r: any = await api.post(`/coding/folders/${folderId}/import`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      done(r.message);
    } catch (e: any) {
      toast.show(e.message);
    }
  };
  const remove = async () => {
    try {
      const r: any = dialog.kind === 'delFolder' ? await api.delete(`/coding/folders/${dialog.item._id}`) : await api.delete(`/coding/questions/${dialog.item._id}`);
      if (dialog.kind === 'delFolder') open('');
      done(r.message);
    } catch (e: any) {
      toast.show(e.message);
    }
  };

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Technical Practice"
        subtitle="Make a folder per topic (e.g. If-else), add coding questions with test cases, and students solve them in the IDE. You get a notification for every submission."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'tests' })}>
              <Eye className="h-4 w-4" /> Coding tests & results
            </button>
            <button type="button" className={primaryBtn} onClick={() => setDialog({ kind: 'folder' })}>
              <FolderPlus className="h-4 w-4" /> New folder
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Folders */}
        <Card className="h-fit p-3">
          {!folders ? (
            <Spinner />
          ) : folders.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-500">No folders yet. Press “New folder”.</p>
          ) : (
            <ul className="space-y-1">
              {folders.map((f) => (
                <li key={f._id}>
                  <button type="button" onClick={() => open(f._id)} className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left ${folderId === f._id ? 'bg-brand-50 dark:bg-brand-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <FolderOpen className={`mt-0.5 h-4 w-4 shrink-0 ${folderId === f._id ? 'text-brand-600' : 'text-amber-500'}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900 dark:text-white">{f.name}</span>
                      <span className="block text-[11px] text-slate-500">
                        {LANG_LABEL[f.language as Lang]} • {f.questionCount} questions • {f.studentCount} students
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Folder content */}
        <div className="space-y-3">
          {!folderId ? (
            <Card className="p-10 text-center text-sm text-slate-500">
              <Code2 className="mx-auto mb-2 h-8 w-8 text-brand-500" />
              Choose a folder on the left, or make a new one.
            </Card>
          ) : !current ? (
            <Spinner />
          ) : (
            <>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold text-slate-900 dark:text-white">{current.folder.name}</p>
                    <p className="text-xs text-slate-500">
                      {LANG_LABEL[current.folder.language as Lang]} • {current.questions.length} questions • {folders?.find((f) => f._id === folderId)?.batches?.join(', ') || 'all students'}
                    </p>
                  </div>
                  {current.canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={primaryBtn} onClick={() => setDialog({ kind: 'question' })}>
                        <Plus className="h-4 w-4" /> Add question
                      </button>
                      <label className={`${secondaryBtn} cursor-pointer`}>
                        <Upload className="h-4 w-4" /> Import Excel
                        <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && importExcel(e.target.files[0])} />
                      </label>
                      <button type="button" className={secondaryBtn} onClick={downloadTemplate}>
                        <Download className="h-4 w-4" /> Excel template
                      </button>
                      <button type="button" title="Edit folder" aria-label="Edit folder" className={secondaryBtn} onClick={() => setDialog({ kind: 'folder', item: folders?.find((f) => f._id === folderId) })}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" title="Delete folder" aria-label="Delete folder" className="rounded-xl p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setDialog({ kind: 'delFolder', item: current.folder })}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-1">
                  {(['questions', 'submissions'] as const).map((t) => (
                    <button key={t} type="button" onClick={() => open(folderId, t)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${tab === t ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                      {t === 'questions' ? `Questions (${current.questions.length})` : `Submissions (${subs?.length ?? '…'})`}
                    </button>
                  ))}
                </div>
              </Card>

              {tab === 'questions' ? (
                <Card className="overflow-hidden">
                  {current.questions.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">No questions yet. Add one, or import many from Excel.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {current.questions.map((q, i) => (
                        <li key={q._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                          <span className="min-w-0">
                            <span className="mr-2 text-xs font-bold text-slate-400">{i + 1}.</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{q.title}</span>
                            <span className="ml-2 text-[11px] text-slate-500">
                              {q.difficulty.toLowerCase()} • {q.tests.length} tests • {q.solved}/{q.tried} students solved
                            </span>
                          </span>
                          {current.canEdit && (
                            <span className="flex gap-1">
                              <button type="button" aria-label={`Edit ${q.title}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800" onClick={() => setDialog({ kind: 'question', item: q })}>
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button type="button" aria-label={`Delete ${q.title}`} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setDialog({ kind: 'delQuestion', item: q })}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ) : (
                <Card className="overflow-x-auto">
                  {!subs ? (
                    <Spinner />
                  ) : subs.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">No submissions yet.</p>
                  ) : (
                    <table className="w-full min-w-[720px] text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/60">
                        <tr>
                          {['When', 'Student', 'Question', 'Result', ''].map((h) => (
                            <th key={h} className="px-3 py-2.5 text-left">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {subs.map((s) => (
                          <tr key={s._id}>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-500">{when(s.createdAt)}</td>
                            <td className="px-3 py-2">
                              <span className="font-semibold text-slate-900 dark:text-white">{s.student?.fullName || 'Student'}</span> <span className="font-mono text-[10px] text-slate-400">{s.student?.studentId}</span>
                            </td>
                            <td className="px-3 py-2">{s.questionTitle}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[s.status]}`}>
                                {s.status === 'PASSED' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />} {s.passed}/{s.total} tests
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => setDialog({ kind: 'code', item: s })}>
                                <Eye className="h-3.5 w-3.5" /> Code
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {dialog?.kind === 'tests' && (
        <CodingTestsPanel
          initialTestId={dialog.testId}
          onClose={() => {
            setDialog(null);
            if (params.get('tests')) setParams(folderId ? { folder: folderId } : {});
          }}
          onMessage={(m) => toast.show(m)}
        />
      )}
      {dialog?.kind === 'folder' && <FolderModal folder={dialog.item} batches={batches} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'question' && current && <QuestionModal folder={current.folder} question={dialog.item} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'code' && (
        <Modal wide title={`${dialog.item.student?.fullName || 'Student'} • ${dialog.item.questionTitle}`} subtitle={`${when(dialog.item.createdAt)} • ${dialog.item.passed}/${dialog.item.total} tests passed`} onClose={() => setDialog(null)}>
          <CodeEditor lang={dialog.item.language} value={dialog.item.code} onChange={() => undefined} readOnly height={360} />
        </Modal>
      )}
      {(dialog?.kind === 'delFolder' || dialog?.kind === 'delQuestion') && (
        <Modal title={`Delete “${dialog.item.name || dialog.item.title}”?`} subtitle={dialog.kind === 'delFolder' ? 'All its questions and students’ submissions are deleted too.' : 'Students’ submissions for it are deleted too.'} onClose={() => setDialog(null)}>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondaryBtn} onClick={() => setDialog(null)}>
              Keep
            </button>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
};
