import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Code2, Flag, Loader2, Play, Send, Trophy, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import { CodeEditor } from '../../components/CodeEditor';
import { Lang, LANG_LABEL, runCode, runTests, TestResult, warmUp } from '../../services/codeRunner';

// A timed coding test opened from a shared link (/coding-test/<token>). Start → solve each question in the IDE →
// "Submit answer" (checked against all tests, saved) → "Finish test". Time up = finished by itself.

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

export const CodingTestPage: React.FC = () => {
  const { token } = useParams();
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, { passed: number; total: number }>>({});
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [output, setOutput] = useState<{ stdout: string; error: string } | null>(null);
  const [busy, setBusy] = useState<'' | 'start' | 'run' | 'save' | 'finish'>('');
  const [note, setNote] = useState('');
  const [left, setLeft] = useState<number | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const offset = useRef(0); // server time − device time
  const finishing = useRef(false);

  const load = () =>
    api
      .get(`/coding/student/tests/${token}`)
      .then((r: any) => {
        offset.current = new Date(r.data.serverNow).getTime() - Date.now();
        setData(r.data);
        const s: Record<string, { passed: number; total: number }> = {};
        const c: Record<string, string> = {};
        (r.data.attempt?.answers || []).forEach((a: any) => {
          s[String(a.questionId)] = { passed: a.passed, total: a.total };
          c[String(a.questionId)] = a.code;
        });
        r.data.questions.forEach((q: any) => {
          let draft = '';
          try {
            draft = localStorage.getItem(`sl-test-${token}-${q._id}`) || '';
          } catch {
            draft = '';
          }
          c[q._id] = draft || c[q._id] || q.starterCode || '';
        });
        setSaved(s);
        setCodes(c);
      })
      .catch((e: any) => setError(e.message));
  useEffect(() => {
    load();
  }, [token]);

  const lang: Lang = data?.test.language || 'python';
  const running = data?.attempt?.status === 'IN_PROGRESS';
  useEffect(() => {
    if (data) warmUp(lang);
  }, [data, lang]);

  const finish = async (auto = false) => {
    if (finishing.current) return;
    finishing.current = true;
    setBusy('finish');
    try {
      const r: any = await api.post(`/coding/student/tests/${token}/finish`, {});
      setNote(auto ? `Time is up. ${r.message}` : r.message);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
      setConfirmFinish(false);
      finishing.current = false;
    }
  };

  // Countdown; at zero the test is finished by itself
  useEffect(() => {
    if (!running || !data?.attempt?.endsAt) return;
    const end = new Date(data.attempt.endsAt).getTime();
    const tick = () => {
      const ms = end - (Date.now() + offset.current);
      setLeft(ms);
      if (ms <= 0) finish(true);
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [running, data?.attempt?.endsAt]);

  const start = async () => {
    setBusy('start');
    try {
      await api.post(`/coding/student/tests/${token}/start`, {});
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const q = data?.questions?.[index];
  const code = q ? codes[q._id] ?? '' : '';
  const setCode = (v: string) => {
    if (!q) return;
    setCodes((c) => ({ ...c, [q._id]: v }));
    try {
      localStorage.setItem(`sl-test-${token}-${q._id}`, v);
    } catch {
      /* no drafts in a private window */
    }
  };
  useEffect(() => {
    setResults(null);
    setOutput(null);
  }, [index]);

  const run = async () => {
    if (!q) return;
    setBusy('run');
    const first = q.tests.find((t: any) => !t.hidden);
    const r = await runCode(lang, code, { input: first?.input || '', setup: q.sqlSetup });
    setOutput({ stdout: r.stdout, error: r.error });
    setBusy('');
  };

  const submitAnswer = async () => {
    if (!q) return;
    setBusy('save');
    const res = await runTests(lang, code, q.tests, q.sqlSetup);
    setResults(res);
    try {
      const passed = res.filter((r) => r.passed).length;
      const r: any = await api.post(`/coding/student/tests/${token}/answer`, { questionId: q._id, code, passed });
      setSaved((s) => ({ ...s, [q._id]: { passed: r.data.passed, total: r.data.total } }));
      setNote(r.message);
    } catch (e: any) {
      setNote(e.message);
    }
    setBusy('');
  };

  if (error)
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6" /> {error}
        <Link to="/student/exams" className="mt-3 block font-bold underline">
          Go to my exams
        </Link>
      </div>
    );
  if (!data) return <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-brand-500" />;

  // Before starting
  if (!data.attempt)
    return (
      <div className="mx-auto mt-6 max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Code2 className="mx-auto h-10 w-10 text-brand-600" />
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{data.test.title}</h1>
        {data.test.description && <p className="text-sm text-slate-600 dark:text-slate-300">{data.test.description}</p>}
        <div className="grid grid-cols-3 gap-2 text-sm">
          {[
            [data.test.questionCount, 'questions'],
            [`${data.test.durationMinutes} min`, 'time'],
            [LANG_LABEL[lang], 'language'],
          ].map(([v, l]) => (
            <div key={String(l)} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <p className="text-lg font-black text-slate-900 dark:text-white">{v}</p>
              <p className="text-[11px] uppercase text-slate-500">{l}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1 text-left text-xs text-slate-500">
          <li>• The timer starts when you press Start and does not stop if you close the page.</li>
          <li>• For each question press “Submit answer”: it is checked against all tests and saved. You can submit again to improve.</li>
          <li>• Press “Finish test” when done. When the time is up the test is finished by itself.</li>
        </ul>
        <button type="button" onClick={start} disabled={busy === 'start'} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-brand-700 disabled:opacity-60">
          {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start test
        </button>
      </div>
    );

  // Finished
  if (data.attempt.status === 'SUBMITTED')
    return (
      <div className="mx-auto mt-6 max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Trophy className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{data.test.title}</h1>
        {note && <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{note}</p>}
        <p className="text-5xl font-black text-brand-600">{data.attempt.score}%</p>
        <ul className="space-y-1 text-left text-sm">
          {data.questions.map((x: any, i: number) => {
            const s = saved[x._id];
            return (
              <li key={x._id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <span>
                  {i + 1}. {x.title}
                </span>
                <span className="font-bold">{s ? `${s.passed}/${s.total}` : 'not answered'}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-slate-500">Your trainer has your result.</p>
        <Link to="/student/exams" className="inline-block rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold dark:border-slate-700">
          Back to my exams
        </Link>
      </div>
    );

  const low = left !== null && left < 5 * 60000;
  return (
    <div className="space-y-3 pb-8">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <p className="mr-auto text-sm font-extrabold text-slate-900 dark:text-white">{data.test.title}</p>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-black ${low ? 'animate-pulse bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'}`}>
          <Clock className="h-4 w-4" /> {left === null ? '--:--' : mmss(left)}
        </span>
        <button type="button" onClick={() => setConfirmFinish(true)} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
          <Flag className="h-4 w-4" /> Finish test
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {data.questions.map((x: any, i: number) => {
          const s = saved[x._id];
          const full = s && s.total && s.passed === s.total;
          return (
            <button
              key={x._id}
              type="button"
              onClick={() => setIndex(i)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${i === index ? 'border-brand-500 bg-brand-600 text-white' : full ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40' : s ? 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
            >
              Q{i + 1}
              {s ? ` • ${s.passed}/${s.total}` : ''}
            </button>
          );
        })}
      </div>
      {q && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 xl:max-h-[calc(100vh-220px)] xl:overflow-y-auto">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Q{index + 1}. {q.title}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">{q.description}</p>
            {lang === 'sql' && q.sqlSetup && (
              <details className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                <summary className="cursor-pointer font-bold">Tables for this question</summary>
                <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px]">{q.sqlSetup}</pre>
              </details>
            )}
            {q.tests
              .filter((t: any) => !t.hidden)
              .map((t: any, n: number) => (
                <div key={n} className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60">
                  <p className="mb-1 font-bold">Example {n + 1}</p>
                  {lang !== 'sql' && <pre className="mb-1 whitespace-pre-wrap font-mono">Input: {t.input || '(nothing)'}</pre>}
                  <pre className="whitespace-pre-wrap font-mono">Output: {t.expected}</pre>
                </div>
              ))}
          </div>
          <div className="space-y-3">
            <CodeEditor lang={lang} value={code} onChange={setCode} height="min(50vh, 500px)" />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={run} disabled={!!busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                {busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-emerald-600" />} Run example
              </button>
              <button type="button" onClick={submitAnswer} disabled={!!busy || !code.trim()} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-brand-700 disabled:opacity-60">
                {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit answer
              </button>
              {note && <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{note}</span>}
            </div>
            {(output || results) && (
              <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                {results ? (
                  <ul className="space-y-1">
                    {results.map((r, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        {r.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />} Test {i + 1} {q.tests[i]?.hidden ? '(hidden)' : ''} {r.passed ? 'passed' : 'failed'}
                        {r.error && <span className="truncate text-rose-600"> • {r.error.split('\n').pop()}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  output && (
                    <>
                      <pre className="whitespace-pre-wrap font-mono">{output.stdout || (output.error ? '' : '(nothing printed)')}</pre>
                      {output.error && <pre className="mt-1 whitespace-pre-wrap font-mono text-rose-600">{output.error}</pre>}
                    </>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {confirmFinish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-xl dark:bg-slate-900">
            <Flag className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
            <p className="font-bold text-slate-900 dark:text-white">Finish the test now?</p>
            <p className="mt-1 text-xs text-slate-500">
              {Object.keys(saved).length} of {data.questions.length} questions submitted. You cannot change answers after this.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold dark:border-slate-700" onClick={() => setConfirmFinish(false)}>
                Keep working
              </button>
              <button type="button" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white" disabled={busy === 'finish'} onClick={() => finish(false)}>
                {busy === 'finish' ? 'Finishing…' : 'Finish test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
