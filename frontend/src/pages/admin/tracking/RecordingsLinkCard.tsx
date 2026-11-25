import React, { useState } from 'react';
import { ExternalLink, FolderOpen, Pencil, Plus } from 'lucide-react';
import { api } from '../../../services/api';
import { inputClass, primaryBtn, secondaryBtn } from './shared';

// Optional extra inside "Class recordings": one shared Zoho WorkDrive folder for the whole batch, for trainers who
// upload recordings there by hand. Students get an "Open recordings" button for it.
export const RecordingsLinkCard: React.FC<{ batch: any; onSaved: (message: string) => void; canEdit?: boolean }> = ({ batch, onSaved, canEdit = true }) => {
  const saved: string = batch.recordingsLink || '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res: any = await api.put(`/tracking/batches/${batch._id}/recordings-link`, { recordingsLink: value.trim() });
      setValue(res.data.recordingsLink);
      setEditing(false);
      onSaved(res.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Admins only see it when the trainer added one
  if (!saved && !canEdit) return null;

  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
      {!editing ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex min-w-0 items-center gap-2 text-slate-600 dark:text-slate-300">
            <FolderOpen className="h-4 w-4 shrink-0 text-rose-500" />
            {saved ? (
              <>
                <span className="font-semibold">Shared recordings folder</span>
                <span className="truncate font-mono text-[11px] text-slate-400">{saved}</span>
              </>
            ) : (
              <span>Optional: one shared Zoho WorkDrive folder for all recordings of this batch.</span>
            )}
          </span>
          <span className="flex shrink-0 gap-2">
            {saved && (
              <a href={saved} target="_blank" rel="noopener noreferrer" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`}>
                Open <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {canEdit && (
              <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => setEditing(true)}>
                {saved ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} {saved ? 'Change' : 'Add folder link'}
              </button>
            )}
          </span>
        </div>
      ) : (
        <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row">
          <input
            id="recordings-link"
            className={`${inputClass} flex-1`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://workdrive.zoho.in/folder/… (shared: anyone with the link can view)"
            autoComplete="off"
          />
          <button type="submit" className={primaryBtn} disabled={busy || (!value.trim() && !saved)}>
            {busy ? 'Saving…' : saved && !value.trim() ? 'Remove link' : 'Save link'}
          </button>
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => {
              setValue(saved);
              setEditing(false);
              setError('');
            }}
          >
            Cancel
          </button>
        </form>
      )}
      {error && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
    </div>
  );
};
