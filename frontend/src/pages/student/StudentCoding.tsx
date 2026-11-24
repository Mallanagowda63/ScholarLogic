import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Circle, Code2, FolderOpen, Loader2, Play, Send, Terminal, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { CodeEditor } from '../../components/CodeEditor';
import { Lang, LANG_LABEL, normalizeOutput, runCode, runTests, TestResult, warmUp } from '../../services/codeRunner';

// Student → Technical Practice: folders of coding questions from the trainers. Solve in the IDE, Run, Submit.

const DIFF_CLS: Record<string, string> = {
  EASY: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  MEDIUM: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  HARD: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};
const LANG_CLS: Record<Lang, string> = {
  python: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  sql: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  javascript: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
};

export const StudentCoding: React.FC = () => {
  const [folders, setFolders] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get('/coding/student/folders')
      .then((r: any) => setFolders(r.data.folders))
      .catch((e: any) => {
        setError(e.message);
        setFolders([]);
      });
  }, []);
  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
          <Code2 className="h-6 w-6 text-brand-600" /> Technical Practice
        </h1>
        <p className="text-xs text-slate-500">Coding questions from your trainers. Open a folder, write the code in the editor, Run to try it, Submit when it is ready.</p>
      </div>
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!folders ? (
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-500" />
      ) : folders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">No practice folders yet. Your trainer will add them here.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((f) => {
            const pct = f.questionCount ? Math.round((f.solved / f.questionCount) * 100) : 0;
            return (
              <Link key={f._id} to={`/student/coding/${f._id}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <FolderOpen className="h-8 w-8 text-amber-500" />
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${LANG_CLS[f.language as Lang]}`}>{LANG_LABEL[f.language as Lang]}</span>
                </div>
                <p className="mt-3 text-base font-extrabold text-slate-900 group-hover:text-brand-600 dark:text-white">{f.name}</p>
                {f.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{f.description}</p>}
                <div className="mt-4 flex justify-between text-xs font-semibold text-slate-500">
                  <span>
                    {f.solved}/{f.questionCount} solved
                  </span>
                  <span className="text-slate-900 dark:text-white">{pct}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const StudentCodingFolder: React.FC = () => {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{ folder: any; questions: any[] } | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState('');
  const [tab, setTab] = useState<'input' | 'output' | 'tests'>('tests');
  const [customInput, setCustomInput] = useState('');
  const [output, setOutput] = useState<{ stdout: string; error: string; ms: number } | null>(null);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [busy, setBusy] = useState<'' | 'run' | 'submit'>('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    api
      .get(`/coding/student/folders/${folderId}`)
      .then((r: any) => setData(r.data))
      .catch((e: any) => setError(e.message));
  useEffect(() => {
    load();
  }, [folderId]);

  const lang: Lang = data?.folder.language || 'python';
  useEffect(() => {
    if (data) warmUp(lang);
  }, [data, lang]);

  const q = data?.questions[index];
  const draftKey = q ? `sl-code-${q._id}` : '';
  // Open a question: the saved draft, else the last submission, else the trainer's starter code
  useEffect(() => {
    if (!q) return;
    let draft = '';
    try {
      draft = localStorage.getItem(draftKey) || '';
    } catch {
      draft = '';
    }
    setCode(draft || q.lastCode || q.starterCode || '');
    setCustomInput(q.tests.find((t: any) => !t.hidden)?.input || '');
    setOutput(null);
    setResults(null);
    setMessage(null);
    setTab('tests');
  }, [q?._id]);
  const change = (v: string) => {
    setCode(v);
    try {
      localStorage.setItem(draftKey, v);
    } catch {
      /* private window: no drafts */
    }
  };

  const shownTests = useMemo(() => (q?.tests || []).map((t: any, i: number) => ({ ...t, i })), [q]);

  const run = async () => {
    if (!q) return;
    setBusy('run');
    setMessage(null);
    setTab('output');
    const r = await runCode(lang, code, { input: customInput, setup: q.sqlSetup });
    setOutput({ stdout: r.stdout, error: r.error, ms: r.ms });
    setBusy('');
  };

  const submit = async () => {
    if (!q) return;
    setBusy('submit');
    setMessage(null);
    setTab('tests');
    const res = await runTests(lang, code, q.tests, q.sqlSetup);
    setResults(res);
    try {
      const r: any = await api.post(`/coding/student/questions/${q._id}/submit`, { code, results: res.map((x) => ({ passed: x.passed, got: x.got, error: x.error })) });
      setMessage({ ok: r.data.submission.status === 'PASSED', text: r.message });
      if (r.data.submission.status === 'PASSED') {
        setData((d) => (d ? { ...d, questions: d.questions.map((x, i) => (i === index ? { ...x, solved: true, attempts: x.attempts + 1, lastCode: code } : x)) } : d));
      }
    } catch (e: any) {
      setMessage({ ok: false, text: e.message });
    }
    setBusy('');
  };

  if (error) return <p className="m-6 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>;
  if (!data) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-brand-500" />;
  if (!data.questions.length)
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-6">
        <Link to="/student/coding" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600">
          <ArrowLeft className="h-3.5 w-3.5" /> All folders
        </Link>
        <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">No questions in “{data.folder.name}” yet.</p>
      </div>
    );

  const passedCount = results?.filter((r) => r.passed).length ?? 0;

  return (
    <div className="space-y-3 pb-8">
      {/* Top bar: folder, question picker */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => navigate('/student/coding')} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> {data.folder.name}
        </button>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${LANG_CLS[lang]}`}>{LANG_LABEL[lang]}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="Previous question" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <select value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label="Question" className="max-w-[260px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            {data.questions.map((x, i) => (
              <option key={x._id} value={i}>
                {x.solved ? '✓ ' : ''}
                {i + 1}. {x.title}
              </option>
            ))}
          </select>
          <button type="button" aria-label="Next question" disabled={index >= data.questions.length - 1} onClick={() => setIndex(index + 1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-1 text-xs text-slate-500">
            {data.questions.filter((x) => x.solved).length}/{data.questions.length} solved
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left: the question */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 xl:max-h-[calc(100vh-180px)] xl:overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {index + 1}. {q.title}
            </h1>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DIFF_CLS[q.difficulty]}`}>{q.difficulty.toLowerCase()}</span>
            {q.solved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" /> Solved
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{q.description || 'No description.'}</p>
          {lang === 'sql' && q.sqlSetup && (
            <details className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
              <summary className="cursor-pointer font-bold text-slate-700 dark:text-slate-200">Tables for this question</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-slate-600 dark:text-slate-300">{q.sqlSetup}</pre>
            </details>
          )}
          {shownTests.filter((t: any) => !t.hidden).map((t: any, n: number) => (
            <div key={t.i} className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
              <p className="mb-1 font-bold text-slate-700 dark:text-slate-200">Example {n + 1}</p>
              {lang !== 'sql' && (
                <>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Input</p>
                  <pre className="mb-2 whitespace-pre-wrap font-mono text-slate-800 dark:text-slate-100">{t.input || '(nothing)'}</pre>
                </>
              )}
              <p className="text-[10px] font-semibold uppercase text-slate-400">Expected output</p>
              <pre className="whitespace-pre-wrap font-mono text-slate-800 dark:text-slate-100">{t.expected}</pre>
            </div>
          ))}
          {shownTests.some((t: any) => t.hidden) && <p className="text-[11px] text-slate-400">+ {shownTests.filter((t: any) => t.hidden).length} hidden test(s) checked when you submit.</p>}
          {lang !== 'sql' && <p className="text-[11px] text-slate-400">{lang === 'python' ? 'Read input with input(). Print the answer with print().' : 'Read input with input() (one line each time). Print with console.log().'}</p>}
        </div>

        {/* Right: the IDE */}
        <div className="space-y-3">
          <CodeEditor lang={lang} value={code} onChange={change} height="min(52vh, 520px)" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={run} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              {busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-emerald-600" />} Run
            </button>
            <button type="button" onClick={submit} disabled={!!busy || !code.trim()} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-brand-700 disabled:opacity-60">
              {busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit
            </button>
            <button
              type="button"
              onClick={() => change(q.starterCode || '')}
              className="ml-auto rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Start again from the starter code"
            >
              Reset code
            </button>
          </div>
          {message && (
            <p className={`flex items-center gap-2 rounded-xl p-3 text-sm font-bold ${message.ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>
              {message.ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />} {message.text}
            </p>
          )}
          {/* Console */}
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="flex gap-1 border-b border-slate-100 p-1.5 dark:border-slate-800">
              {(
                [
                  ['tests', `Test results${results ? ` (${passedCount}/${results.length})` : ''}`],
                  ['output', 'Output'],
                  ...(lang !== 'sql' ? [['input', 'Custom input']] : []),
                ] as [typeof tab, string][]
              ).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1 text-xs font-bold ${tab === k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="max-h-64 overflow-y-auto p-3 text-xs">
              {tab === 'input' && (
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  rows={5}
                  placeholder="What your program reads with input(), one value per line"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              )}
              {tab === 'output' &&
                (!output ? (
                  <p className="flex items-center gap-2 text-slate-400">
                    <Terminal className="h-4 w-4" /> Press Run to see what your code prints{lang !== 'sql' ? ' (with the Custom input)' : ''}.
                  </p>
                ) : (
                  <>
                    <pre className="whitespace-pre-wrap font-mono text-slate-800 dark:text-slate-100">{output.stdout || (output.error ? '' : '(nothing printed)')}</pre>
                    {output.error && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-rose-50 p-2 font-mono text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{output.error}</pre>}
                    <p className="mt-2 text-[10px] text-slate-400">{output.ms} ms</p>
                  </>
                ))}
              {tab === 'tests' &&
                (!results ? (
                  <p className="text-slate-400">Press Submit to check your code against all {q.tests.length} test(s).</p>
                ) : (
                  <ul className="space-y-2">
                    {results.map((r, i) => {
                      const t = q.tests[i];
                      return (
                        <li key={i} className={`rounded-lg border p-2 ${r.passed ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20'}`}>
                          <p className="flex items-center gap-1.5 font-bold">
                            {r.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />} Test {i + 1} {t.hidden ? '(hidden)' : ''} • {r.passed ? 'Passed' : 'Failed'}
                          </p>
                          {!r.passed && !t.hidden && (
                            <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <div>
                                <p className="text-[10px] font-semibold uppercase text-slate-400">Expected</p>
                                <pre className="whitespace-pre-wrap font-mono">{normalizeOutput(t.expected)}</pre>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase text-slate-400">Your output</p>
                                <pre className="whitespace-pre-wrap font-mono">{normalizeOutput(r.got) || '(nothing)'}</pre>
                              </div>
                            </div>
                          )}
                          {r.error && <pre className="mt-1 whitespace-pre-wrap font-mono text-rose-700 dark:text-rose-300">{r.error}</pre>}
                        </li>
                      );
                    })}
                  </ul>
                ))}
            </div>
          </div>
          <p className="flex items-center gap-1 text-[10px] text-slate-400">
            <Circle className="h-2 w-2" /> Your code is saved on this device as you type. Submissions go to your trainer.
          </p>
        </div>
      </div>
    </div>
  );
};
