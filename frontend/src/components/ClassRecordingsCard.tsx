import React, { useEffect, useState } from 'react';
import { ExternalLink, FolderOpen, Radio, Video } from 'lucide-react';
import { api } from '../services/api';

// Student: one Zoho link per batch with all its class recordings. Hidden until the student is in a batch.
interface BatchRecordings {
  batchId: string;
  batchCode: string;
  subject: string;
  trainer: string;
  current: boolean;
  recordingsLink: string;
  meetingLink?: string;
  nextClassAt?: string | null;
  timing?: string;
}

export const ClassRecordingsCard: React.FC = () => {
  const [rows, setRows] = useState<BatchRecordings[] | null>(null);
  useEffect(() => {
    api
      .get('/tracking/me/recordings')
      .then((res: any) => setRows(res.data.recordings || []))
      .catch(() => setRows([]));
  }, []);
  if (!rows?.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <Video className="h-4 w-4 text-rose-500" /> Live Class & Recordings
      </h3>
      <p className="mb-3 text-xs text-slate-500">Join your live class here. Every recording of your batch is in one Zoho folder; the same link always has the latest classes.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.batchId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{r.subject || r.batchCode}</p>
              <p className="truncate text-[11px] text-slate-500">
                {r.batchCode}
                {r.trainer && ` • ${r.trainer}`}
                {!r.current && ' • finished'}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
            {r.meetingLink && (
              <a href={r.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700">
                <Radio className="h-3.5 w-3.5" /> Join class
              </a>
            )}
            {r.meetingLink && r.nextClassAt && (
              <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                {new Date(r.nextClassAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {r.recordingsLink ? (
              <a
                href={r.recordingsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                <FolderOpen className="h-3.5 w-3.5" /> Open recordings <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="shrink-0 text-[11px] font-semibold text-slate-400">No recordings link yet</span>
            )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
