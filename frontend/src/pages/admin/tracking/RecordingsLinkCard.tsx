import React, { useState } from 'react';
import { ExternalLink, FolderOpen, Pencil, Save, Video } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, inputClass, primaryBtn, secondaryBtn } from './shared';

// One Zoho link per batch: the trainer makes a shared folder once, uploads every class recording into it,
// and students of the batch always open the same link.
export const RecordingsLinkCard: React.FC<{ batch: any; onSaved: (message: string) => void }> = ({ batch, onSaved }) => {
  const saved: string = batch.recordingsLink || '';
  const [editing, setEditing] = useState(!saved);
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
      setEditing(!res.data.recordingsLink);
      onSaved(res.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={`p-5 ${saved ? '' : 'border-amber-300 dark:border-amber-800'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Video className="h-4 w-4 text-rose-500" /> Class recordings link (Zoho)
          </h2>
          <p className="text-xs text-slate-500">
            {saved
              ? 'Students of this batch open this one link for every recording. Just keep uploading new recordings into the same Zoho folder.'
              : 'Add this once for the batch: make a folder in Zoho WorkDrive, share it ("anyone with the link can view"), and paste the link here. Then upload every recording into that folder; no new link needed each class.'}
          </p>
        </div>
        {saved && !editing && (
          <div className="flex gap-2">
            <a href={saved} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
              <FolderOpen className="h-4 w-4" /> Open folder <ExternalLink className="h-3 w-3" />
            </a>
            <button type="button" className={secondaryBtn} onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Change
            </button>
          </div>
        )}
      </div>

      {saved && !editing && <p className="mt-2 truncate font-mono text-[11px] text-slate-400">{saved}</p>}

      {editing && (
        <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="recordings-link"
            className={`${inputClass} flex-1`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://workdrive.zoho.in/folder/..."
            autoComplete="off"
          />
          <button type="submit" className={primaryBtn} disabled={busy || (!value.trim() && !saved)}>
            <Save className="h-4 w-4" /> {busy ? 'Saving…' : value.trim() ? 'Save link' : 'Remove link'}
          </button>
          {saved && (
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
          )}
        </form>
      )}
      {error && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
    </Card>
  );
};
