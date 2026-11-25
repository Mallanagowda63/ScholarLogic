import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Plus, ArrowUp, ArrowDown, Trash2, ArrowRight, Pencil } from 'lucide-react';
import { Card, ErrorNote, Field, Modal, PageHeader, Spinner, inputClass, primaryBtn, secondaryBtn, useToast } from './tracking/shared';

const move = <T,>(xs: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= xs.length) return xs;
  const copy = [...xs];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
};

const CourseModal: React.FC<{ initial?: any; subjects: any[]; onClose: () => void; onDone: (m: string) => void }> = ({ initial, subjects, onClose, onDone }) => {
  const [name, setName] = useState(initial?.name || '');
  const [code, setCode] = useState(initial?.code || '');
  const [durationMonths, setDuration] = useState(String(initial?.durationMonths || 6));
  const [items, setItems] = useState<{ subjectId: string; expectedDurationDays: number }[]>(
    (initial?.subjects || []).map((s: any) => ({ subjectId: s.subjectId?._id || s.subjectId, expectedDurationDays: s.expectedDurationDays }))
  );
  const [error, setError] = useState('');
  const unused = subjects.filter((s) => !items.some((i) => i.subjectId === s._id));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name, code, durationMonths: Number(durationMonths), subjects: items };
      if (initial) await api.put(`/tracking/courses/${initial._id}`, payload);
      else await api.post('/tracking/courses', payload);
      onDone(initial ? 'Course updated' : 'Course created');
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'New course'} subtitle="Subject order is the expected progression. Batches and timings are decided later, month by month." onClose={onClose}>
      <ErrorNote text={error} />
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Course name" required>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Data Analytics" />
            </Field>
          </div>
          <Field label="Code" required>
            <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} required placeholder="DA" />
          </Field>
        </div>
        <Field label="Duration (months)">
          <input type="number" min={1} className={inputClass} value={durationMonths} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Subjects in order</span>
          <ol className="space-y-1.5">
            {items.map((it, i) => {
              const s = subjects.find((x) => x._id === it.subjectId);
              return (
                <li key={it.subjectId} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs">
                  <span className="w-5 font-bold text-slate-400">{i + 1}</span>
                  <span className="flex-1 font-semibold text-slate-900 dark:text-white">{s?.name || 'Subject'}</span>
                  <input
                    type="number"
                    min={1}
                    className={`${inputClass} !w-20 !py-1 text-xs`}
                    value={it.expectedDurationDays}
                    onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, expectedDurationDays: Number(e.target.value) } : x)))}
                    aria-label="Expected days"
                    title="Expected duration (days)"
                  />
                  <span className="text-slate-400">days</span>
                  <button type="button" onClick={() => setItems(move(items, i, -1))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setItems(move(items, i, 1))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              );
            })}
          </ol>
          {unused.length > 0 && (
            <select
              className={`${inputClass} mt-2`}
              value=""
              onChange={(e) => {
                const s = subjects.find((x) => x._id === e.target.value);
                if (s) setItems([...items, { subjectId: s._id, expectedDurationDays: s.expectedDurationDays || 30 }]);
              }}
            >
              <option value="">+ Add subject…</option>
              {unused.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={primaryBtn}>Save course</button>
        </div>
      </form>
    </Modal>
  );
};

const SubjectModal: React.FC<{ initial?: any; onClose: () => void; onDone: (m: string) => void }> = ({ initial, onClose, onDone }) => {
  const [name, setName] = useState(initial?.name || '');
  const [code, setCode] = useState(initial?.code || '');
  const [days, setDays] = useState(String(initial?.expectedDurationDays || 30));
  const [topics, setTopics] = useState<{ _id?: string; title: string }[]>(
    [...(initial?.topics || [])].sort((a: any, b: any) => a.order - b.order).map((t: any) => ({ _id: t._id, title: t.title }))
  );
  const [bulk, setBulk] = useState('');
  const [error, setError] = useState('');
  const addBulk = () => {
    const lines = bulk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length) setTopics([...topics, ...lines.map((title) => ({ title }))]);
    setBulk('');
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name, code, expectedDurationDays: Number(days), topics };
      if (initial) await api.put(`/tracking/subjects/${initial._id}`, payload);
      else await api.post('/tracking/subjects', payload);
      onDone(initial ? 'Subject updated' : 'Subject created');
    } catch (err: any) {
      setError(err.message);
    }
  };
  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'New subject'} subtitle="Progress = completed topics ÷ total topics." onClose={onClose}>
      <ErrorNote text={error} />
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field label="Subject name" required>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Python" />
            </Field>
          </div>
          <Field label="Code" required hint="Used for batch IDs">
            <input className={inputClass} value={code} onChange={(e) => setCode(e.target.value)} required placeholder="PY" />
          </Field>
        </div>
        <Field label="Expected duration (days)">
          <input type="number" min={1} className={inputClass} value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <div>
          <span className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Topics ({topics.length})</span>
          <ol className="max-h-60 space-y-1 overflow-y-auto">
            {topics.map((t, i) => (
              <li key={t._id || `new-${i}`} className="flex items-center gap-2 text-xs">
                <span className="w-6 text-right font-bold text-slate-400">{i + 1}</span>
                <input className={`${inputClass} !py-1 text-xs`} value={t.title} onChange={(e) => setTopics(topics.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                <button type="button" onClick={() => setTopics(move(topics, i, -1))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setTopics(move(topics, i, 1))} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setTopics(topics.filter((_, j) => j !== i))} className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ol>
          <textarea className={`${inputClass} mt-2`} rows={3} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'Add topics, one per line\nVariables\nLoops'} />
          <button type="button" className={`${secondaryBtn} mt-2`} onClick={addBulk} disabled={!bulk.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add topics
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>Cancel</button>
          <button type="submit" className={primaryBtn}>Save subject</button>
        </div>
      </form>
    </Modal>
  );
};

export const AdminCourses: React.FC = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'subjects' ? 'subjects' : 'courses';
  const [courses, setCourses] = useState<any[] | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [dialog, setDialog] = useState<any>(null);

  const load = () => {
    api.get('/tracking/courses').then((r: any) => setCourses(r.data?.courses || [])).catch(() => setCourses([]));
    api.get('/tracking/subjects').then((r: any) => setSubjects(r.data?.subjects || [])).catch(() => {});
  };
  useEffect(load, []);
  const done = (m: string) => {
    setDialog(null);
    toast.show(m);
    load();
  };

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title={tab === 'courses' ? 'Courses' : 'Subjects'}
        subtitle={tab === 'courses' ? 'Each course is an ordered sequence of subjects.' : 'Subjects with their predefined topic syllabus.'}
        action={
          <button type="button" className={primaryBtn} onClick={() => setDialog({ kind: tab === 'courses' ? 'course' : 'subject' })}>
            <Plus className="h-4 w-4" /> {tab === 'courses' ? 'New Course' : 'New Subject'}
          </button>
        }
      />
      <nav className="flex gap-6 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
        {(['courses', 'subjects'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setParams(t === 'courses' ? {} : { tab: t }, { replace: true })} className={`relative pb-3 capitalize ${tab === t ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
            {t}
            <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500 ${tab === t ? 'opacity-100' : 'opacity-0'}`} />
          </button>
        ))}
      </nav>

      {!courses ? (
        <Spinner />
      ) : tab === 'courses' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {courses.map((c) => (
            <Card key={c._id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{c.name} <span className="font-mono text-xs text-slate-400">{c.code}</span></h3>
                  <p className="text-xs text-slate-500">{c.durationMonths} months • {c.subjects.length} subjects • {c.studentCount} students</p>
                </div>
                <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'course', initial: c })}><Pencil className="h-3.5 w-3.5" /> Edit</button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {c.subjects.map((s: any, i: number) => (
                  <React.Fragment key={s._id || i}>
                    {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
                    <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {s.subjectId?.name} <span className="text-[10px] font-normal text-slate-400">{s.expectedDurationDays}d</span>
                    </span>
                  </React.Fragment>
                ))}
                {c.subjects.length === 0 && <span className="text-xs text-slate-400">No subjects yet</span>}
              </div>
            </Card>
          ))}
          {courses.length === 0 && <Card className="p-10 text-center text-sm text-slate-500 md:col-span-2">No courses yet.</Card>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <Card key={s._id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{s.name} <span className="font-mono text-xs text-slate-400">{s.code}</span></h3>
                  <p className="text-xs text-slate-500">{s.topics.length} topics • ~{s.expectedDurationDays} days</p>
                </div>
                <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'subject', initial: s })}><Pencil className="h-3.5 w-3.5" /> Edit</button>
              </div>
              <ol className="mt-3 max-h-40 list-decimal space-y-0.5 overflow-y-auto pl-5 text-xs text-slate-600 dark:text-slate-300">
                {[...s.topics].sort((a: any, b: any) => a.order - b.order).map((t: any) => <li key={t._id}>{t.title}</li>)}
              </ol>
            </Card>
          ))}
          {subjects.length === 0 && <Card className="p-10 text-center text-sm text-slate-500 md:col-span-3">No subjects yet.</Card>}
        </div>
      )}

      {dialog?.kind === 'course' && <CourseModal initial={dialog.initial} subjects={subjects} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'subject' && <SubjectModal initial={dialog.initial} onClose={() => setDialog(null)} onDone={done} />}
      {toast.node}
    </div>
  );
};
