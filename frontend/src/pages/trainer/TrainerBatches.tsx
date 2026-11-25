import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Video } from 'lucide-react';
import { BatchDetailView } from '../admin/tracking/BatchDetailView';
import { Card, PageHeader, ProgressBar, Spinner, StatusBadge, fmtDate, fmtMode, statusTone } from '../admin/tracking/shared';

// Trainer sees only batches assigned to them
export const TrainerBatches: React.FC = () => {
  const [batches, setBatches] = useState<any[] | null>(null);
  useEffect(() => {
    api.get('/tracking/trainer/batches').then((r: any) => setBatches(r.data?.batches || [])).catch(() => setBatches([]));
  }, []);
  if (!batches) return <Spinner />;
  const live = batches.filter((b) => !['COMPLETED', 'CANCELLED'].includes(b.status));
  const past = batches.filter((b) => ['COMPLETED', 'CANCELLED'].includes(b.status));
  const card = (b: any) => (
    <Link key={b._id} to={`/trainer/batches/${b._id}`}>
      <Card className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between">
          <span className="font-mono text-lg font-extrabold text-slate-900 dark:text-white">{b.batchCode}</span>
          <StatusBadge status={b.status} />
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {b.subject?.name} — {b.timing}
        </p>
        <p className="text-xs text-slate-500">
          {fmtMode(b.mode)} • {b.studentCount} students • {b.classesConducted} classes
        </p>
        <div className="mt-3 flex justify-between text-xs">
          <span className="text-slate-500">{b.progress.completed} / {b.progress.total} topics</span>
          <span className="font-bold text-slate-900 dark:text-white">{b.progress.percentage}%</span>
        </div>
        <ProgressBar value={b.progress.percentage} tone={statusTone(b.status)} className="mt-1" />
        <p className="mt-2 text-[11px] text-slate-400">Expected completion {fmtDate(b.estimatedCompletion)}</p>
        {b.recordingsLink ? (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <Video className="h-3 w-3" /> Recordings link added
          </p>
        ) : (
          !['COMPLETED', 'CANCELLED'].includes(b.status) && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <Video className="h-3 w-3" /> Add the Zoho recordings link
            </p>
          )
        )}
      </Card>
    </Link>
  );
  return (
    <div className="space-y-5 pb-12">
      <PageHeader title="My Batches" subtitle="Open a batch after each class to mark attendance and tick completed topics." />
      {live.length === 0 ? <Card className="p-10 text-center text-sm text-slate-500">No batches assigned to you yet.</Card> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{live.map(card)}</div>}
      {past.length > 0 && (
        <>
          <h2 className="pt-2 text-sm font-bold text-slate-500">Completed batches</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{past.map(card)}</div>
        </>
      )}
    </div>
  );
};

export const TrainerBatchDetail: React.FC = () => {
  const { id } = useParams();
  return <BatchDetailView batchId={id!} role="TRAINER" />;
};
