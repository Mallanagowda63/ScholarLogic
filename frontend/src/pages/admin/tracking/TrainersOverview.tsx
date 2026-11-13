import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, CalendarClock, CheckCircle2, ChevronRight, Layers, Mail, Plus, Search, Users, Video } from 'lucide-react';
import { api } from '../../../services/api';
import { PageHeader, ProgressBar, Spinner, StatusBadge, fmtDate, fmtMode, inputClass, statusTone } from './shared';

// Admin → Trainers: who teaches what right now. Facts only (batches, classes, topics), no ratings.

const GRADIENTS = ['from-sky-500 to-indigo-600', 'from-violet-500 to-fuchsia-600', 'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-cyan-500 to-blue-600'];
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
const gradientFor = (id: string) => GRADIENTS[[...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];

const Tile: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode; tone: string }> = ({ icon: Icon, label, value, tone }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
      <Icon className="h-5 w-5" />
    </span>
    <div className="min-w-0">
      <p className="text-2xl font-black leading-none text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  </div>
);

const Chip: React.FC<{ label: string; value: number; warn?: boolean }> = ({ label, value, warn }) => (
  <div className={`rounded-xl px-3 py-2 text-center ${warn && value > 0 ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-slate-50 dark:bg-slate-800/60'}`}>
    <p className={`text-lg font-black leading-none ${warn && value > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-white'}`}>{value}</p>
    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
  </div>
);

export const TrainersOverview: React.FC = () => {
  const [trainers, setTrainers] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'ALL' | 'TEACHING' | 'FREE'>('ALL');

  useEffect(() => {
    api
      .get('/tracking/trainers')
      .then((r: any) => setTrainers(r.data?.trainers || []))
      .catch(() => setTrainers([]));
  }, []);

  const sorted = useMemo(
    () => [...(trainers || [])].sort((a, b) => Number(b.assignedBatches > 0) - Number(a.assignedBatches > 0) || b.assignedBatches - a.assignedBatches || a.fullName.localeCompare(b.fullName)),
    [trainers]
  );
  const visible = sorted.filter((t) => {
    if (show === 'TEACHING' && !t.assignedBatches) return false;
    if (show === 'FREE' && t.assignedBatches) return false;
    const term = q.trim().toLowerCase();
    return !term || [t.fullName, t.email, ...t.currentSubjects, ...t.batches.map((b: any) => b.batchCode)].join(' ').toLowerCase().includes(term);
  });

  if (!trainers) return <Spinner />;

  const teaching = trainers.filter((t) => t.assignedBatches > 0).length;
  const totals = {
    batches: trainers.reduce((s, t) => s + t.assignedBatches, 0),
    students: trainers.reduce((s, t) => s + (t.studentsTeaching || 0), 0),
    classes: trainers.reduce((s, t) => s + t.classesConducted, 0),
    delayed: trainers.reduce((s, t) => s + t.delayedBatches, 0),
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Trainers"
        subtitle="Who teaches which batch, how many classes are done and how far each syllabus is."
        action={
          <Link to="/admin/staff" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <Plus className="h-4 w-4" /> Add a trainer
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Tile icon={Users} label="Trainers" value={trainers.length} tone="bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" />
        <Tile icon={Layers} label="Active batches" value={totals.batches} tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" />
        <Tile icon={BookOpen} label="Students being taught" value={totals.students} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" />
        <Tile icon={CalendarClock} label="Classes conducted" value={totals.classes} tone="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" />
        <Tile
          icon={totals.delayed ? AlertTriangle : CheckCircle2}
          label={totals.delayed ? 'Delayed batches' : `Free trainers`}
          value={totals.delayed || trainers.length - teaching}
          tone={totals.delayed ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input id="trainer-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search trainer, email, subject or batch" />
        </label>
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {(
            [
              ['ALL', `All (${trainers.length})`],
              ['TEACHING', `Teaching (${teaching})`],
              ['FREE', `Free (${trainers.length - teaching})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setShow(k)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold ${show === k ? 'bg-brand-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">No trainers match.</p>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {visible.map((t) => {
          const busy = t.assignedBatches > 0;
          return (
            <div
              key={t._id}
              className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-slate-900 ${busy ? 'border-slate-200 dark:border-slate-800 xl:col-span-2' : 'border-dashed border-slate-300 dark:border-slate-700'}`}
            >
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-lg font-black text-white shadow-md ${gradientFor(t._id)}`}>{initials(t.fullName) || 'T'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{t.fullName}</h3>
                    {busy ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Teaching</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">Free</span>
                    )}
                    {t.zohoConnected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" title="Zoho Meeting connected">
                        <Video className="h-3 w-3" /> Zoho
                      </span>
                    )}
                    {t.isActive === false && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Access removed</span>}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                    <Mail className="h-3 w-3 shrink-0" /> {t.email}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t.currentSubjects.length ? t.currentSubjects.join(' • ') : t.specialization || 'No batch assigned yet'}
                  </p>
                </div>
                {busy ? (
                  <div className="grid grid-cols-4 gap-2 sm:w-[420px]">
                    <Chip label="Batches" value={t.assignedBatches} />
                    <Chip label="Students" value={t.studentsTeaching || 0} />
                    <Chip label="Classes" value={t.classesConducted} />
                    <Chip label="Delayed" value={t.delayedBatches} warn />
                  </div>
                ) : (
                  <Link to="/admin/batches" className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300">
                    Assign a batch <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>

              {t.batches.length > 0 && (
                <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/30 md:grid-cols-2 2xl:grid-cols-3">
                  {t.batches.map((b: any) => (
                    <Link
                      key={b._id}
                      to={`/admin/batches/${b._id}`}
                      className="group rounded-xl border border-slate-200 bg-white p-3.5 transition-colors hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-600"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-extrabold text-brand-700 group-hover:underline dark:text-brand-300">{b.batchCode}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">{b.subject?.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {b.timing} • {fmtMode(b.mode)} • {b.studentCount} student{b.studentCount === 1 ? '' : 's'}
                      </p>
                      <div className="mt-2.5">
                        <div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-500">
                          <span>
                            {b.progress.completed}/{b.progress.total} topics
                          </span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{b.progress.percentage}%</span>
                        </div>
                        <ProgressBar value={b.progress.percentage} tone={statusTone(b.status)} />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-400">Expected to finish {fmtDate(b.estimatedCompletion)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
