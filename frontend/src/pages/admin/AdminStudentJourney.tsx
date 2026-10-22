import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  Mail,
  CalendarDays,
  Clock,
  Pencil,
  CalendarPlus,
  ArrowRightLeft,
  RotateCcw,
  Wifi,
  PauseCircle,
  CheckCircle2,
  Circle,
  User,
  BookOpen,
  Flag,
} from 'lucide-react';
import {
  AllocateModal,
  AllocationStatusModal,
  Card,
  ModeChangeModal,
  ProgressBar,
  ReallocateModal,
  Spinner,
  StatusBadge,
  StudentFormModal,
  TrainingStatusModal,
  fmtDate,
  fmtMode,
  linkBtn,
  primaryBtn,
  secondaryBtn,
  statusTone,
  toneFill,
  useToast,
} from './tracking/shared';

type Dialog =
  | null
  | { kind: 'edit' }
  | { kind: 'allocate'; subjectId?: string }
  | { kind: 'realloc'; mode: 'MOVE' | 'REALLOCATE'; allocationId: string; subjectId: string; batchCode?: string; batchId?: string; closed?: boolean }
  | { kind: 'allocStatus'; allocationId: string; batchCode?: string }
  | { kind: 'status' }
  | { kind: 'mode' };

const TIMELINE_DOT: Record<string, string> = {
  JOINED: 'bg-emerald-500',
  ALLOCATED: 'bg-brand-500',
  MOVED: 'bg-orange-500',
  REALLOCATED: 'bg-orange-500',
  ALLOCATION_STATUS: 'bg-rose-500',
  SUBJECT_COMPLETED: 'bg-emerald-500',
  STATUS_CHANGED: 'bg-amber-500',
  REJOINED: 'bg-purple-500',
  MODE_CHANGED: 'bg-sky-500',
  PROFILE_UPDATED: 'bg-slate-400',
};

export const AdminStudentJourney: React.FC = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const tab = searchParams.get('tab') === 'history' ? 'history' : searchParams.get('tab') === 'status' ? 'status' : 'journey';

  const load = () =>
    api
      .get(`/tracking/students/${id}`)
      .then((res: any) => setData(res.data))
      .catch((e: any) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const journey = data?.journey;
  const student = data?.student;
  const studentRef = student ? { _id: student._id, fullName: student.fullName, studentId: student.studentId } : null;

  // Deep-link actions from the Students table (?action=edit|allocate|move|reallocate|history)
  useEffect(() => {
    if (!journey) return;
    const action = searchParams.get('action');
    if (!action) return;
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    const current = journey.current;
    const needs = journey.subjects.find((s: any) => ['MISSED', 'REALLOCATION_REQUIRED', 'ON_HOLD', 'DROPPED'].includes(s.status));
    if (action === 'edit') setDialog({ kind: 'edit' });
    else if (action === 'allocate') setDialog({ kind: 'allocate', subjectId: needs?.subjectId || journey.next?.subjectId });
    else if ((action === 'move' || action === 'reallocate') && (current || needs)) {
      const target = action === 'move' ? current || needs : needs || current;
      setDialog({
        kind: 'realloc',
        mode: action === 'move' ? 'MOVE' : 'REALLOCATE',
        allocationId: target.currentAllocationId || target.latestAllocationId,
        subjectId: target.subjectId,
        batchCode: target.batch?.batchCode,
        batchId: target.batch?._id,
        closed: !target.currentAllocationId,
      });
    } else if (action === 'move' || action === 'reallocate') {
      toast.show('No batch allocation to move yet — allocate first');
    } else if (action === 'history') next.set('tab', 'history');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey]);

  const selected = useMemo(
    () => journey?.subjects.find((s: any) => s.subjectId === (selectedSubject || journey.current?.subjectId)) || journey?.subjects[0],
    [journey, selectedSubject]
  );

  const done = (msg: string) => {
    setDialog(null);
    toast.show(msg);
    load();
  };

  if (error) return <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-700 dark:text-rose-300">{error}</div>;
  if (!data) return <Spinner />;

  const enr = student.enrollment || {};
  const paused = ['ON_HOLD', 'DROPPED'].includes(journey.trainingStatus);
  const current = journey.current;
  const setTab = (t: string) => setSearchParams(t === 'journey' ? {} : { tab: t }, { replace: true });

  return (
    <div className="space-y-6 pb-12">
      <Link to="/admin/students" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        <ArrowLeft className="h-3.5 w-3.5" /> All students
      </Link>

      {/* Identity */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-xl font-black text-white">
              {student.fullName?.[0]?.toUpperCase() || 'S'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">{student.fullName}</h1>
                <StatusBadge status={journey.trainingStatus} />
                <StatusBadge status={journey.allocationStatus} />
              </div>
              <p className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400">{student.studentId}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {student.phone || '—'}</span>
                {student.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {student.email}</span>}
                <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {journey.course?.name || 'No course'}</span>
                <span className="inline-flex items-center gap-1"><Wifi className="h-3.5 w-3.5" /> {fmtMode(enr.mode)}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Prefers {enr.preferredTiming || '—'}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Joined {fmtDate(enr.joiningDate)}</span>
                <span className="inline-flex items-center gap-1"><Flag className="h-3.5 w-3.5" /> Expected completion {journey.course ? fmtDate(journey.expectedCompletion) : '—'}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'edit' })}><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'mode' })}><Wifi className="h-3.5 w-3.5" /> Change mode</button>
            <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'status' })}>
              <PauseCircle className="h-3.5 w-3.5" /> {paused ? 'Rejoin' : 'Hold / Drop'}
            </button>
            {current && (
              <button
                type="button"
                className={secondaryBtn}
                onClick={() => setDialog({ kind: 'realloc', mode: 'MOVE', allocationId: current.currentAllocationId, subjectId: current.subjectId, batchCode: current.batch?.batchCode, batchId: current.batch?._id })}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" /> Move
              </button>
            )}
            {!paused && journey.course && (
              <button type="button" className={primaryBtn} onClick={() => setDialog({ kind: 'allocate', subjectId: journey.next?.subjectId })}>
                <CalendarPlus className="h-3.5 w-3.5" /> Allocate
              </button>
            )}
          </div>
        </div>

        {/* Right now */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Current subject', current ? current.name : '—'],
            ['Current batch', current?.batch ? current.batch.batchCode : '—', current?.batch ? `/admin/batches/${current.batch._id}` : undefined],
            ['Trainer', current?.batch?.trainer?.fullName || '—'],
            ['Timing', current?.batch ? `${current.batch.timing} • ${fmtMode(current.batch.mode)}` : '—'],
            ['Next subject', journey.next ? journey.next.name : journey.allocationStatus === 'COMPLETED' ? 'Course complete' : '—'],
            ['Completed', `${journey.completedCount} / ${journey.subjects.length} subjects`],
          ].map(([label, value, href]) => (
            <div key={label as string}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              {href ? (
                <Link to={href as string} className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400 hover:underline">{value}</Link>
              ) : (
                <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
              )}
            </div>
          ))}
        </div>
        {current && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{current.name} progress</span>
                <span className="font-bold text-slate-900 dark:text-white">{current.progress.completed} / {current.progress.total} topics • {current.progress.percentage}%</span>
              </div>
              <ProgressBar value={current.progress.percentage} tone={statusTone(current.status)} />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Attendance ({current.name})</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {current.attendance.percentage === null ? 'No classes marked' : `${current.attendance.attended} / ${current.attendance.total} classes • ${current.attendance.percentage}%`}
                </span>
              </div>
              <ProgressBar value={current.attendance.percentage || 0} tone="green" />
            </div>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <nav className="flex gap-6 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
        {[
          ['journey', 'Course journey'],
          ['history', `History (${data.timeline.length})`],
          ['status', 'Status & mode history'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`relative pb-3 ${tab === key ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {label}
            <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500 ${tab === key ? 'opacity-100' : 'opacity-0'}`} />
          </button>
        ))}
      </nav>

      {tab === 'journey' && (
        <>
          {journey.subjects.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-500">No course assigned. Use Edit to assign a course.</Card>
          ) : (
            <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
              {journey.subjects.map((s: any, i: number) => {
                const tone = statusTone(s.status);
                const active = selected?.subjectId === s.subjectId;
                return (
                  <React.Fragment key={s.subjectId}>
                    {i > 0 && <ArrowRight className="h-5 w-5 shrink-0 self-center text-slate-300 dark:text-slate-600" />}
                    <button
                      type="button"
                      onClick={() => setSelectedSubject(s.subjectId)}
                      className={`relative w-60 shrink-0 overflow-hidden rounded-2xl border bg-white dark:bg-slate-900 p-4 text-left shadow-sm transition-all ${
                        active ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span className={`absolute inset-x-0 top-0 h-1 ${toneFill[tone]}`} />
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{s.name}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <div className="mt-2 flex items-baseline justify-between text-xs">
                        <span className="text-slate-500">{s.progress.completed}/{s.progress.total} topics</span>
                        <span className="font-bold text-slate-900 dark:text-white">{s.progress.percentage}%</span>
                      </div>
                      <ProgressBar value={s.progress.percentage} tone={tone} className="mt-1" />
                      <dl className="mt-3 space-y-0.5 text-[11px] text-slate-500">
                        <div className="flex justify-between"><dt>Batch</dt><dd className="font-mono font-semibold text-slate-700 dark:text-slate-300">{s.batch?.batchCode || '—'}</dd></div>
                        <div className="flex justify-between"><dt>Trainer</dt><dd className="truncate pl-2 text-slate-700 dark:text-slate-300">{s.batch?.trainer?.fullName || '—'}</dd></div>
                        <div className="flex justify-between"><dt>Timing</dt><dd className="text-slate-700 dark:text-slate-300">{s.batch?.timing || '—'}</dd></div>
                        <div className="flex justify-between"><dt>Start</dt><dd className="text-slate-700 dark:text-slate-300">{fmtDate(s.startDate)}</dd></div>
                        <div className="flex justify-between"><dt>Expected end</dt><dd className="text-slate-700 dark:text-slate-300">{s.batch ? fmtDate(s.expectedEndDate) : `~${s.expectedDurationDays} days`}</dd></div>
                      </dl>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {selected && (
            <div className="grid gap-6 lg:grid-cols-5">
              <Card className="p-5 lg:col-span-2">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selected.name} topics</h3>
                  <span className="text-xs font-semibold text-slate-500">{selected.progress.completed} / {selected.progress.total} • {selected.progress.percentage}%</span>
                </div>
                {selected.currentTopic && (
                  <p className="mb-3 rounded-xl bg-brand-50 dark:bg-brand-950/40 px-3 py-2 text-xs text-brand-800 dark:text-brand-300">
                    Current topic: <b>{selected.currentTopic.title}</b>
                  </p>
                )}
                {selected.topics.length === 0 ? (
                  <p className="text-xs text-slate-500">No topics defined for this subject yet.</p>
                ) : (
                  <ol className="max-h-96 space-y-1 overflow-y-auto">
                    {selected.topics.map((t: any) => (
                      <li key={t._id} className="flex items-center gap-2 text-xs">
                        {t.completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />}
                        <span className={t.completed ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'}>
                          {t.order}. {t.title}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>

              <Card className="p-5 lg:col-span-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selected.name} batch history</h3>
                  <div className="flex gap-3 text-xs text-slate-500">
                    <span>Attendance: <b className="text-slate-800 dark:text-slate-200">{selected.attendance.percentage === null ? '—' : `${selected.attendance.percentage}%`}</b></span>
                    <span>Reallocations: <b className="text-slate-800 dark:text-slate-200">{selected.reallocations}</b></span>
                  </div>
                </div>
                {selected.history.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
                    Not allocated yet.
                    {!paused && (
                      <button type="button" className={`${linkBtn} ml-1`} onClick={() => setDialog({ kind: 'allocate', subjectId: selected.subjectId })}>
                        Allocate a batch
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selected.history.map((h: any) => {
                      const isActive = ['BATCH_ALLOCATED', 'ATTENDING', 'RE_ATTENDING'].includes(h.status);
                      const canReallocate = ['MISSED', 'REALLOCATION_REQUIRED', 'ON_HOLD', 'DROPPED', 'MOVED'].includes(h.status) && h._id === selected.latestAllocationId && !paused;
                      return (
                        <div key={h._id} className={`rounded-xl border p-3 ${isActive ? 'border-brand-200 dark:border-brand-900 bg-brand-50/40 dark:bg-brand-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Link to={`/admin/batches/${h.batch?._id}`} className="font-mono text-sm font-bold text-slate-900 dark:text-white hover:text-brand-600">
                                {h.batch?.batchCode}
                              </Link>
                              <StatusBadge status={h.status} />
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {fmtDate(h.startDate)} → {h.endDate ? fmtDate(h.endDate) : 'present'}
                            </span>
                          </div>
                          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300 sm:grid-cols-4">
                            <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {h.batch?.trainer?.fullName || '—'}</span>
                            <span>⏰ {h.batch?.timing} • {fmtMode(h.mode)}</span>
                            <span>Attendance: {h.attendance.total ? `${h.attendance.attended}/${h.attendance.total}` : '—'}</span>
                            <span>Topics here: {h.topicsCovered}</span>
                          </div>
                          {(h.reason || h.remarks) && (
                            <p className="mt-1.5 text-[11px] text-slate-500">
                              {h.reason && <><b>Reason:</b> {h.reason} </>}
                              {h.remarks && <><b>Remarks:</b> {h.remarks}</>}
                            </p>
                          )}
                          {(isActive || canReallocate) && (
                            <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 dark:border-slate-800 pt-2">
                              {isActive && (
                                <>
                                  <button type="button" className={linkBtn} onClick={() => setDialog({ kind: 'realloc', mode: 'MOVE', allocationId: h._id, subjectId: selected.subjectId, batchCode: h.batch?.batchCode, batchId: h.batch?._id })}>
                                    Move
                                  </button>
                                  <button type="button" className={linkBtn} onClick={() => setDialog({ kind: 'realloc', mode: 'REALLOCATE', allocationId: h._id, subjectId: selected.subjectId, batchCode: h.batch?.batchCode, batchId: h.batch?._id })}>
                                    Reallocate
                                  </button>
                                  <button type="button" className={linkBtn} onClick={() => setDialog({ kind: 'allocStatus', allocationId: h._id, batchCode: h.batch?.batchCode })}>
                                    Mark missed / completed
                                  </button>
                                </>
                              )}
                              {canReallocate && (
                                <button type="button" className={linkBtn} onClick={() => setDialog({ kind: 'realloc', mode: 'REALLOCATE', allocationId: h._id, subjectId: selected.subjectId, batchCode: h.batch?.batchCode, batchId: h.batch?._id, closed: true })}>
                                  <RotateCcw className="mr-1 inline h-3 w-3" /> Reallocate to a new batch
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <Card className="p-5 sm:p-6">
          {data.timeline.length === 0 ? (
            <p className="text-xs text-slate-500">No history yet.</p>
          ) : (
            <ol className="relative space-y-5 border-l-2 border-slate-100 dark:border-slate-800 pl-6">
              {data.timeline.map((e: any) => (
                <li key={e._id} className="relative">
                  <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-900 ${TIMELINE_DOT[e.type] || 'bg-slate-400'}`} />
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{fmtDate(e.date)}</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{e.title}</p>
                  {e.details && <p className="text-xs text-slate-500">{e.details}</p>}
                  {e.byName && <p className="text-[10px] text-slate-400">by {e.byName}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {tab === 'status' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Status history</h3>
            <ul className="space-y-3">
              {[...(student.statusHistory || [])].reverse().map((h: any, i: number) => (
                <li key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={h.status} />
                    <span className="text-slate-500">{fmtDate(h.date)}</span>
                  </div>
                  {h.reason && <p className="mt-1 text-slate-600 dark:text-slate-300"><b>Reason:</b> {h.reason}</p>}
                  {h.remarks && <p className="text-slate-500">{h.remarks}</p>}
                  {(h.completedSubjectIds?.length > 0 || h.pendingSubjectIds?.length > 0) && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Completed subjects: {h.completedSubjectIds.length} • Pending: {h.pendingSubjectIds.length}
                    </p>
                  )}
                </li>
              ))}
              {!student.statusHistory?.length && <li className="text-xs text-slate-500">No status changes recorded.</li>}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Mode history</h3>
            <ul className="space-y-3">
              {[...(student.modeHistory || [])].reverse().map((m: any, i: number) => (
                <li key={i} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">{fmtMode(m.mode)}</span>
                  <span className="text-slate-500">
                    {fmtDate(m.from)} → {m.to ? fmtDate(m.to) : 'present'}
                  </span>
                  <span className="max-w-[40%] truncate text-slate-400">{m.reason || ''}</span>
                </li>
              ))}
              {!student.modeHistory?.length && <li className="text-xs text-slate-500">No mode history recorded.</li>}
            </ul>
          </Card>
        </div>
      )}

      {/* Dialogs */}
      {dialog?.kind === 'edit' && <StudentFormModal initial={student} onClose={() => setDialog(null)} onDone={(m) => done(m)} />}
      {dialog?.kind === 'allocate' && studentRef && (
        <AllocateModal
          student={studentRef}
          subjects={journey.subjects.filter((s: any) => !s.currentAllocationId && s.status !== 'COMPLETED').map((s: any) => ({ subjectId: s.subjectId, name: s.name }))}
          defaultSubjectId={dialog.subjectId}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === 'realloc' && (
        <ReallocateModal
          allocationId={dialog.allocationId}
          subjectId={dialog.subjectId}
          currentBatchCode={dialog.batchCode}
          currentBatchId={dialog.batchId}
          studentName={student.fullName}
          mode={dialog.mode}
          alreadyClosed={dialog.closed}
          onClose={() => setDialog(null)}
          onDone={done}
        />
      )}
      {dialog?.kind === 'allocStatus' && (
        <AllocationStatusModal allocationId={dialog.allocationId} batchCode={dialog.batchCode} studentName={student.fullName} onClose={() => setDialog(null)} onDone={done} />
      )}
      {dialog?.kind === 'status' && studentRef && <TrainingStatusModal student={studentRef} current={journey.trainingStatus} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'mode' && studentRef && <ModeChangeModal student={studentRef} current={enr.mode || 'OFFLINE'} onClose={() => setDialog(null)} onDone={done} />}
      {toast.node}
    </div>
  );
};
