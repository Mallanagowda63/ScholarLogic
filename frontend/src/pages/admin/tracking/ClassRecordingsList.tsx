import React, { useState } from 'react';
import { Clapperboard, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, inputClass, primaryBtn, secondaryBtn } from './shared';

// Batch → one row per class recording. Zoho recordings of meetings created here are added by themselves
// (every hour, or "Get recordings from Zoho"); the trainer can also add any recording link by hand.

const when = (d?: string) => (d ? new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const ClassRecordingsList: React.FC<{ batch: any; canEdit: boolean; onSaved: (message: string) => void }> = ({ batch, canEdit, onSaved }) => {
  const list: any[] = [...(batch.classRecordings || [])].sort((a, b) => new Date(b.recordedAt || b.addedAt).getTime() - new Date(a.recordedAt || a.addedAt).getTime());
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showAll, setShowAll] = useState(false);

  const run = async (fn: () => Promise<any>, after?: () => void) => {
    setBusy(true);
    setError('');
    try {
      const res: any = await fn();
      after?.();
      onSaved(res.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const hasZoho = (batch.zohoMeetings || []).length > 0;
  const shown = showAll ? list : list.slice(0, 8);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Clapperboard className="h-4 w-4 text-violet-500" /> Class recordings ({list.length})
          </h2>
          <p className="text-xs text-slate-500">
            {hasZoho
              ? 'Recordings of the Zoho meetings created here are added by themselves within an hour after Zoho finishes them.'
              : canEdit
                ? 'Create the class with “Create Zoho meeting” and its recording is added here by itself. You can also add any recording link.'
                : 'Recordings the trainer adds for this batch.'}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {hasZoho && (
              <button type="button" className={secondaryBtn} disabled={busy} onClick={() => run(() => api.post(`/tracking/batches/${batch._id}/recordings/sync`, {}))}>
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Get recordings from Zoho
              </button>
            )}
            <button type="button" className={primaryBtn} onClick={() => setAdding((v) => !v)}>
              <Plus className="h-4 w-4" /> Add recording link
            </button>
          </div>
        )}
      </div>

      {canEdit && adding && (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr_160px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => api.post(`/tracking/batches/${batch._id}/recordings`, { url: url.trim(), title: title.trim(), recordedAt: new Date(`${date}T12:00:00`).toISOString() }),
              () => {
                setAdding(false);
                setUrl('');
                setTitle('');
              }
            );
          }}
        >
          <input id="rec-url" className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Recording link (Zoho, Drive, YouTube…)" required aria-label="Recording link" />
          <input id="rec-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Joins in SQL)" aria-label="Title" />
          <input id="rec-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Class date" />
          <button type="submit" className={primaryBtn} disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}
      {error && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
          {shown.map((r) => (
            <li key={r._id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-slate-800 dark:text-slate-200">{r.title}</span>
                <span className="text-[11px] text-slate-500">
                  {when(r.recordedAt || r.addedAt)}
                  {r.durationMinutes ? ` • ${r.durationMinutes} min` : ''}
                  {r.source === 'ZOHO' ? ' • from Zoho' : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-violet-700">
                  Watch <ExternalLink className="h-3 w-3" />
                </a>
                {canEdit && (
                  <button
                    type="button"
                    title="Remove this recording"
                    aria-label={`Remove ${r.title}`}
                    disabled={busy}
                    onClick={() => run(() => api.delete(`/tracking/batches/${batch._id}/recordings/${r._id}`))}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {list.length > 8 && (
        <button type="button" className="mt-2 text-[11px] font-bold text-brand-600 hover:underline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </Card>
  );
};
