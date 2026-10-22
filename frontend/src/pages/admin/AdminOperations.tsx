import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { BatchDetailView } from './tracking/BatchDetailView';
import { Card, EmptyRow, PageHeader, ProgressBar, Spinner, StatusBadge, fmtDate, fmtMode, inputClass, statusTone } from './tracking/shared';

export const AdminBatchDetail: React.FC = () => {
  const { id } = useParams();
  return <BatchDetailView batchId={id!} role="ADMIN" />;
};

// Factual operational tracking only — no ratings
export const AdminTrainers: React.FC = () => {
  const [trainers, setTrainers] = useState<any[] | null>(null);
  useEffect(() => {
    api.get('/tracking/trainers').then((r: any) => setTrainers(r.data?.trainers || [])).catch(() => setTrainers([]));
  }, []);
  if (!trainers) return <Spinner />;
  return (
    <div className="space-y-5 pb-12">
      <PageHeader title="Trainers" subtitle="Assigned batches, classes conducted and topic progress per trainer." />
      {trainers.length === 0 && <Card className="p-10 text-center text-sm text-slate-500">No trainer accounts found.</Card>}
      {trainers.map((t) => (
        <Card key={t._id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.fullName}</h3>
              <p className="text-xs text-slate-500">{t.currentSubjects.join(', ') || 'No current subjects'}</p>
            </div>
            <div className="grid grid-cols-4 gap-6 text-center">
              {[
                ['Assigned batches', t.assignedBatches],
                ['Classes conducted', t.classesConducted],
                ['Topics completed', t.topicsCompleted],
                ['Delayed batches', t.delayedBatches],
              ].map(([l, v]) => (
                <div key={l as string}>
                  <p className={`text-xl font-extrabold ${l === 'Delayed batches' && Number(v) > 0 ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>{v}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{l}</p>
                </div>
              ))}
            </div>
          </div>
          {t.batches.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="text-[10px] font-bold uppercase text-slate-400">
                  <tr>
                    {['Batch', 'Subject', 'Timing', 'Students', 'Progress', 'Expected completion', 'Status'].map((h) => (
                      <th key={h} className="py-2 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {t.batches.map((b: any) => (
                    <tr key={b._id}>
                      <td className="py-2 pr-3 font-mono font-bold"><Link to={`/admin/batches/${b._id}`} className="text-brand-600 dark:text-brand-400 hover:underline">{b.batchCode}</Link></td>
                      <td className="py-2 pr-3">{b.subject?.name}</td>
                      <td className="py-2 pr-3">{b.timing} • {fmtMode(b.mode)}</td>
                      <td className="py-2 pr-3">{b.studentCount}</td>
                      <td className="py-2 pr-3 w-40">
                        <span className="font-bold">{b.progress.completed}/{b.progress.total} • {b.progress.percentage}%</span>
                        <ProgressBar value={b.progress.percentage} tone={statusTone(b.status)} className="mt-1" />
                      </td>
                      <td className="py-2 pr-3">{fmtDate(b.estimatedCompletion)}</td>
                      <td className="py-2 pr-3"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

// Allocated vs actually attended, per batch
export const AdminAttendance: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [batchId, setBatchId] = useState('');
  const [detail, setDetail] = useState<any>(null);
  useEffect(() => {
    api.get('/tracking/batches').then((r: any) => {
      const list = r.data?.batches || [];
      setBatches(list);
      const first = list.find((b: any) => ['RUNNING', 'DELAYED'].includes(b.status)) || list[0];
      if (first) setBatchId(first._id);
    });
  }, []);
  useEffect(() => {
    if (!batchId) return;
    setDetail(null);
    api.get(`/tracking/batches/${batchId}`).then((r: any) => setDetail(r.data)).catch(() => {});
  }, [batchId]);

  const sessions = useMemo(() => (detail ? [...detail.attendance].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()) : []), [detail]);
  const people = detail ? [...detail.students, ...detail.pastStudents] : [];

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Attendance"
        subtitle="Allocated vs actually attended. Trainers mark attendance with each class update."
        action={
          <select className={`${inputClass} w-64`} value={batchId} onChange={(e) => setBatchId(e.target.value)} aria-label="Batch">
            {batches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.batchCode} — {b.subject?.name} ({b.timing})
              </option>
            ))}
          </select>
        }
      />
      {!detail ? (
        <Spinner />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                <tr>
                  <th className="sticky left-0 bg-slate-50 dark:bg-slate-800 px-3 py-3">Student</th>
                  <th className="px-3 py-3">Allocation</th>
                  <th className="px-3 py-3">Attended</th>
                  {sessions.map((s: any) => (
                    <th key={s._id} className="px-2 py-3 text-center whitespace-nowrap">{new Date(s.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {people.length === 0 ? (
                  <EmptyRow colSpan={3 + sessions.length} text="No students allocated to this batch." />
                ) : (
                  people.map((p: any) => (
                    <tr key={p.allocationId}>
                      <td className="sticky left-0 bg-white dark:bg-slate-900 px-3 py-2 whitespace-nowrap">
                        <Link to={`/admin/students/${p.studentMongoId}`} className="font-semibold hover:underline">{p.fullName}</Link>
                        <span className="block font-mono text-[10px] text-slate-400">{p.studentId}</span>
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={p.status} /></td>
                      <td className="px-3 py-2 whitespace-nowrap font-bold">{p.attendance.total ? `${p.attendance.attended}/${p.attendance.total} (${p.attendance.percentage}%)` : '—'}</td>
                      {sessions.map((s: any) => {
                        const rec = s.records.find((r: any) => String(r.studentId) === String(p.studentMongoId));
                        return (
                          <td key={s._id} className="px-2 py-2 text-center">
                            {rec ? <StatusBadge status={rec.status} /> : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {sessions.length === 0 && <p className="border-t border-slate-100 dark:border-slate-800 p-4 text-xs text-slate-500">No classes marked yet for this batch.</p>}
        </Card>
      )}
    </div>
  );
};

export const AdminHistory: React.FC = () => {
  const [events, setEvents] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    api.get('/tracking/timeline', { params: { limit: 300 } }).then((r: any) => setEvents(r.data?.events || [])).catch(() => setEvents([]));
  }, []);
  const visible = (events || []).filter((e) => {
    const term = q.trim().toLowerCase();
    return !term || [e.title, e.details, e.studentId?.studentId, e.studentId?.userId?.fullName].filter(Boolean).join(' ').toLowerCase().includes(term);
  });
  return (
    <div className="space-y-5 pb-12">
      <PageHeader title="History" subtitle="Every allocation, move, reallocation, status and mode change across all students. Records are never deleted." />
      <input className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by student, batch or action" />
      {!events ? (
        <Spinner />
      ) : (
        <Card className="divide-y divide-slate-100 dark:divide-slate-800">
          {visible.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No history yet.</p>}
          {visible.map((e) => (
            <div key={e._id} className="flex flex-wrap items-start gap-3 p-4 text-xs">
              <span className="w-24 shrink-0 text-slate-400">{fmtDate(e.date)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white">{e.title}</p>
                {e.details && <p className="text-slate-500">{e.details}</p>}
              </div>
              {e.studentId && (
                <Link to={`/admin/students/${e.studentId._id}`} className="shrink-0 text-right hover:underline">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{e.studentId.userId?.fullName}</span>
                  <span className="block font-mono text-[10px] text-slate-400">{e.studentId.studentId}</span>
                </Link>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};
