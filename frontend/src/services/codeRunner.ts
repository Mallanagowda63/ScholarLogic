// Runs student code inside the browser, each language in its own Web Worker (off the page, with a time limit).
// Python: Pyodide (WebAssembly) • SQL: sql.js (SQLite in WebAssembly) • JavaScript: plain worker.
// Nothing is sent to a server to run, so it is free and safe for the website.

export type Lang = 'python' | 'sql' | 'javascript';
export interface RunResult {
  stdout: string;
  error: string;
  timedOut: boolean;
  ms: number;
}

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const SQLJS = 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/';

const WORKERS: Record<Lang, string> = {
  python: `
importScripts('${PYODIDE}pyodide.js');
let py;
loadPyodide({ indexURL: '${PYODIDE}' }).then((p) => { py = p; postMessage({ ready: true }); }, (e) => postMessage({ ready: false, error: String(e) }));
self.onmessage = async (e) => {
  const { id, code, input } = e.data;
  let out = '';
  py.setStdout({ batched: (s) => { out += s + '\\n'; } });
  py.setStderr({ batched: (s) => { out += s + '\\n'; } });
  const lines = String(input || '').replace(/\\r/g, '').split('\\n');
  let i = 0;
  py.setStdin({ stdin: () => (i < lines.length ? lines[i++] : null) });
  const g = py.globals.get('dict')();
  try {
    await py.runPythonAsync(code, { globals: g });
    postMessage({ id, stdout: out, error: '' });
  } catch (err) {
    // Keep only the useful end of the traceback
    const msg = String((err && err.message) || err).split('\\n').filter((l) => !/File "\\/lib\\/|_pyodide|pyodide\\.ffi|^\\s*\\^+\\s*$/.test(l));
    postMessage({ id, stdout: out, error: msg.slice(-6).join('\\n').trim() });
  } finally {
    g.destroy();
  }
};`,
  javascript: `
postMessage({ ready: true });
self.onmessage = async (e) => {
  const { id, code, input } = e.data;
  let out = '';
  const show = (v) => (typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })());
  const write = (...a) => { out += a.map(show).join(' ') + '\\n'; };
  const con = { log: write, info: write, warn: write, error: write };
  const lines = String(input || '').replace(/\\r/g, '').split('\\n');
  let i = 0;
  const readLine = () => (i < lines.length ? lines[i++] : '');
  try {
    const fn = new Function('console', 'input', 'readline', 'prompt', '"use strict";\\n' + code);
    await fn(con, readLine, readLine, readLine);
    postMessage({ id, stdout: out, error: '' });
  } catch (err) {
    postMessage({ id, stdout: out, error: String((err && (err.name + ': ' + err.message)) || err) });
  }
};`,
  sql: `
importScripts('${SQLJS}sql-wasm.js');
let SQL;
initSqlJs({ locateFile: (f) => '${SQLJS}' + f }).then((s) => { SQL = s; postMessage({ ready: true }); }, (e) => postMessage({ ready: false, error: String(e) }));
const cell = (v) => (v === null ? 'NULL' : String(v));
self.onmessage = (e) => {
  const { id, code, input, setup } = e.data;
  const db = new SQL.Database();
  try {
    if (setup) db.run(setup);
    if (input) db.run(input);
    const res = db.exec(code);
    const last = res[res.length - 1];
    const out = last ? [last.columns.join(' | '), ...last.values.map((r) => r.map(cell).join(' | '))].join('\\n') + '\\n' : '';
    postMessage({ id, stdout: out, error: '' });
  } catch (err) {
    postMessage({ id, stdout: '', error: String((err && err.message) || err) });
  } finally {
    db.close();
  }
};`,
};

interface Slot {
  worker: Worker;
  ready: Promise<void>;
}
const slots: Partial<Record<Lang, Slot>> = {};
let seq = 0;

function slotFor(lang: Lang): Slot {
  const existing = slots[lang];
  if (existing) return existing;
  const url = URL.createObjectURL(new Blob([WORKERS[lang]], { type: 'text/javascript' }));
  const worker = new Worker(url);
  const ready = new Promise<void>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && 'ready' in e.data) {
        worker.removeEventListener('message', onMsg);
        if (e.data.ready) resolve();
        else reject(new Error(e.data.error || 'Could not load the runner'));
      }
    };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', (e) => reject(new Error(e.message || 'Could not start the runner')));
  });
  const slot = { worker, ready };
  slots[lang] = slot;
  return slot;
}

function drop(lang: Lang) {
  slots[lang]?.worker.terminate();
  delete slots[lang];
}

/** Loads the runner in the background (Python takes a few seconds the first time) */
export function warmUp(lang: Lang) {
  slotFor(lang).ready.catch(() => drop(lang));
}

let queue: Promise<unknown> = Promise.resolve();

/** One run. `input` = what the program reads (stdin); for SQL it is extra SQL run after `setup`. */
export function runCode(lang: Lang, code: string, opts: { input?: string; setup?: string; timeoutMs?: number } = {}): Promise<RunResult> {
  const job = queue.then(async () => {
    const slot = slotFor(lang);
    try {
      await Promise.race([slot.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('The runner took too long to load. Check the internet and try again.')), 90000))]);
    } catch (e: any) {
      drop(lang);
      return { stdout: '', error: String(e?.message || e), timedOut: false, ms: 0 };
    }
    const id = ++seq;
    const started = performance.now();
    return new Promise<RunResult>((resolve) => {
      const timer = window.setTimeout(() => {
        slot.worker.removeEventListener('message', onMsg);
        drop(lang); // an endless loop: throw the worker away
        resolve({ stdout: '', error: `Time limit exceeded (${Math.round((opts.timeoutMs || 6000) / 1000)} s). Check for an endless loop or a missing input.`, timedOut: true, ms: opts.timeoutMs || 6000 });
      }, opts.timeoutMs || 6000);
      const onMsg = (e: MessageEvent) => {
        if (e.data?.id !== id) return;
        window.clearTimeout(timer);
        slot.worker.removeEventListener('message', onMsg);
        resolve({ stdout: String(e.data.stdout || ''), error: String(e.data.error || ''), timedOut: false, ms: Math.round(performance.now() - started) });
      };
      slot.worker.addEventListener('message', onMsg);
      slot.worker.postMessage({ id, code, input: opts.input || '', setup: opts.setup || '' });
    });
  });
  queue = job.catch(() => undefined);
  return job;
}

/** Output compared line by line, ignoring spaces at line ends, around " | " and blank lines at the end */
export const normalizeOutput = (s: string) =>
  String(s || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/\s*\|\s*/g, ' | ').replace(/\s+$/g, ''))
    .join('\n')
    .trim();

export interface TestResult {
  passed: boolean;
  got: string;
  error: string;
  ms: number;
}

export async function runTests(lang: Lang, code: string, tests: { input: string; expected: string }[], setup = ''): Promise<TestResult[]> {
  const out: TestResult[] = [];
  for (const t of tests) {
    const r = await runCode(lang, code, { input: t.input, setup });
    out.push({ passed: !r.error && normalizeOutput(r.stdout) === normalizeOutput(t.expected), got: r.stdout, error: r.error, ms: r.ms });
  }
  return out;
}

export const LANG_LABEL: Record<Lang, string> = { python: 'Python', sql: 'SQL', javascript: 'JavaScript' };
export const MONACO_LANG: Record<Lang, string> = { python: 'python', sql: 'sql', javascript: 'javascript' };
