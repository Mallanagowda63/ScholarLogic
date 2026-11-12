import React, { useEffect, useState } from 'react';
import { CalendarClock, ExternalLink, Link2, LogOut, Play, Video } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, inputClass, primaryBtn, secondaryBtn } from './shared';

// Batch → live class. The trainer connects their own Zoho account once and creates the class meeting here
// (or pastes any meeting link). Students see "Join class" on their dashboard. Admins only see it.

interface ZohoStatus {
  configured: boolean;
  connected: boolean;
  email: string;
}

const when = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm"
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const ClassMeetingCard: React.FC<{ batch: any; canEdit: boolean; onSaved: (message: string) => void }> = ({ batch, canEdit, onSaved }) => {
  const [zoho, setZoho] = useState<ZohoStatus | null>(null);
  const [mode, setMode] = useState<'view' | 'zoho' | 'paste'>('view');
  const tomorrow10 = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  })();
  const [startAt, setStartAt] = useState(localInput(tomorrow10));
  const [duration, setDuration] = useState('60');
  const [topic, setTopic] = useState('');
  const [link, setLink] = useState(batch.meetingLink || '');
  const [pasteAt, setPasteAt] = useState(batch.nextClassAt ? localInput(new Date(batch.nextClassAt)) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Back from the Zoho sign-in page: say how it went, then tidy the address bar
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const z = q.get('zoho');
    if (!z) return;
    const messages: Record<string, string> = {
      connected: 'Zoho connected. You can now create class meetings here.',
      cancelled: 'Zoho sign-in was cancelled.',
      expired: 'The Zoho sign-in took too long. Press Connect Zoho again.',
      invalid: 'The Zoho sign-in could not be checked. Press Connect Zoho again.',
      error: `Zoho could not be connected: ${q.get('reason') || 'unknown error'}`,
    };
    if (z === 'connected') onSaved(messages.connected);
    else setError(messages[z] || messages.error);
    q.delete('zoho');
    q.delete('reason');
    window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canEdit) return;
    api
      .get('/integrations/zoho/status')
      .then((res: any) => setZoho(res.data))
      .catch(() => setZoho({ configured: false, connected: false, email: '' }));
  }, [canEdit]);

  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    setError('');
    try {
      const res: any = await fn();
      setMode('view');
      onSaved(res.message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      const res: any = await api.get('/integrations/zoho/connect-url', { params: { returnTo: window.location.pathname } });
      window.location.assign(res.data.url);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };
  const disconnect = async () => {
    await api.post('/integrations/zoho/disconnect', {}).catch(() => undefined);
    setZoho((z) => (z ? { ...z, connected: false, email: '' } : z));
  };

  const hasLink = !!batch.meetingLink;
  const upcoming = batch.nextClassAt && new Date(batch.nextClassAt).getTime() > Date.now() - 3 * 3600000;

  return (
    <Card className={`p-5 ${hasLink ? '' : canEdit ? 'border-sky-300 dark:border-sky-800' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Video className="h-4 w-4 text-sky-500" /> Live class (Zoho Meeting)
          </h2>
          <p className="text-xs text-slate-500">
            {hasLink
              ? upcoming
                ? `Next class: ${when(batch.nextClassAt)}. Students see “Join class” on their dashboard.`
                : 'Students see “Join class” on their dashboard.'
              : canEdit
                ? 'Create the class meeting here. Students of this batch get the join link on their dashboard.'
                : 'The trainer has not added a class meeting yet.'}
          </p>
        </div>
        {hasLink && mode === 'view' && (
          <div className="flex flex-wrap gap-2">
            {canEdit && batch.meetingStartLink && (
              <a href={batch.meetingStartLink} target="_blank" rel="noopener noreferrer" className={primaryBtn}>
                <Play className="h-4 w-4" /> Start meeting
              </a>
            )}
            <a href={batch.meetingLink} target="_blank" rel="noopener noreferrer" className={canEdit && batch.meetingStartLink ? secondaryBtn : primaryBtn}>
              <ExternalLink className="h-4 w-4" /> {canEdit ? 'Student join link' : 'Open class link'}
            </a>
          </div>
        )}
      </div>

      {canEdit && mode === 'view' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {zoho?.configured && !zoho.connected && (
            <button type="button" className={primaryBtn} disabled={busy} onClick={connect}>
              <Link2 className="h-4 w-4" /> Connect Zoho
            </button>
          )}
          {zoho?.connected && (
            <button type="button" className={primaryBtn} onClick={() => setMode('zoho')}>
              <CalendarClock className="h-4 w-4" /> {hasLink ? 'Schedule next class' : 'Create Zoho meeting'}
            </button>
          )}
          <button type="button" className={secondaryBtn} onClick={() => setMode('paste')}>
            <Link2 className="h-4 w-4" /> {hasLink ? 'Change link' : 'Paste a meeting link'}
          </button>
          {zoho?.connected && (
            <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-slate-500">
              Zoho: {zoho.email || 'connected'}
              <button type="button" onClick={disconnect} className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline">
                <LogOut className="h-3 w-3" /> Disconnect
              </button>
            </span>
          )}
          {zoho && !zoho.configured && <span className="text-[11px] text-slate-400">Zoho sign-in is not switched on yet; paste the meeting link for now.</span>}
        </div>
      )}

      {canEdit && mode === 'zoho' && (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.post(`/tracking/batches/${batch._id}/zoho-meeting`, { startAt: new Date(startAt).toISOString(), durationMinutes: Number(duration), topic: topic.trim() }));
          }}
        >
          <input id="zm-topic" className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={`Topic (default: ${batch.subject?.name || 'Class'} - ${batch.batchCode})`} aria-label="Topic" />
          <input id="zm-start" type="datetime-local" className={inputClass} value={startAt} onChange={(e) => setStartAt(e.target.value)} required aria-label="Class date and time" />
          <select id="zm-duration" className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} aria-label="Duration">
            {[30, 45, 60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} hour${m > 60 ? 's' : ''}`}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className={primaryBtn} disabled={busy}>
              {busy ? 'Creating…' : 'Create'}
            </button>
            <button type="button" className={secondaryBtn} onClick={() => setMode('view')}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {canEdit && mode === 'paste' && (
        <form
          className="mt-3 grid gap-2 sm:grid-cols-[1fr_220px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api.put(`/tracking/batches/${batch._id}/meeting-link`, { meetingLink: link.trim(), nextClassAt: pasteAt ? new Date(pasteAt).toISOString() : null }));
          }}
        >
          <input id="zm-link" className={inputClass} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meeting.zoho.in/… (leave empty to remove)" aria-label="Meeting link" />
          <input id="zm-when" type="datetime-local" className={inputClass} value={pasteAt} onChange={(e) => setPasteAt(e.target.value)} aria-label="Next class (optional)" />
          <div className="flex gap-2">
            <button type="submit" className={primaryBtn} disabled={busy}>
              {busy ? 'Saving…' : link.trim() ? 'Save link' : 'Remove link'}
            </button>
            <button type="button" className={secondaryBtn} onClick={() => setMode('view')}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
    </Card>
  );
};
