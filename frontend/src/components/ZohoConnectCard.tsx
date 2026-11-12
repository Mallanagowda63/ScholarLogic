import React, { useEffect, useState } from 'react';
import { CheckCircle2, Link2, LogOut, Video } from 'lucide-react';
import { api } from '../services/api';

// Trainer dashboard: connect your own Zoho Meeting account once. After that, "Create Zoho meeting" on any of
// your batches makes the class meeting, and its recording comes back by itself.
export const ZohoConnectCard: React.FC = () => {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; email: string; connectedAt: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () =>
    api
      .get('/integrations/zoho/status')
      .then((res: any) => setStatus(res.data))
      .catch(() => setStatus({ configured: false, connected: false, email: '', connectedAt: null }));

  useEffect(() => {
    load();
    // Back from the Zoho sign-in page
    const q = new URLSearchParams(window.location.search);
    const z = q.get('zoho');
    if (z) {
      setNote(
        z === 'connected'
          ? { ok: true, text: 'Zoho connected. Open a batch and press “Create Zoho meeting”.' }
          : { ok: false, text: z === 'cancelled' ? 'Zoho sign-in was cancelled.' : `Zoho could not be connected${q.get('reason') ? `: ${q.get('reason')}` : '. Please try again.'}` }
      );
      q.delete('zoho');
      q.delete('reason');
      window.history.replaceState(null, '', `${window.location.pathname}${q.toString() ? `?${q}` : ''}`);
    }
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const res: any = await api.get('/integrations/zoho/connect-url', { params: { returnTo: window.location.pathname } });
      window.location.assign(res.data.url);
    } catch (e: any) {
      setNote({ ok: false, text: e.message });
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    await api.post('/integrations/zoho/disconnect', {}).catch(() => undefined);
    await load();
    setBusy(false);
  };

  if (!status) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 p-5 shadow-sm dark:border-sky-900 dark:from-sky-950/30 dark:to-indigo-950/20 sm:flex-row sm:items-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md">
        <Video className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Zoho Meeting for your live classes</p>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {!status.configured
            ? 'Zoho sign-in is not switched on yet. Ask the admin.'
            : status.connected
              ? `Connected as ${status.email || 'your Zoho account'}. Open a batch and press “Create Zoho meeting”; recordings are added by themselves after the class.`
              : 'Connect your Zoho account once. Then create class meetings from your batches, and students get the join link and recordings automatically.'}
        </p>
        {note && <p className={`mt-1 text-xs font-semibold ${note.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{note.text}</p>}
      </div>
      {status.configured &&
        (status.connected ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </span>
            <button type="button" onClick={disconnect} disabled={busy} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
              <LogOut className="h-3.5 w-3.5" /> Disconnect
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 hover:opacity-95 disabled:opacity-60"
          >
            <Link2 className="h-4 w-4" /> {busy ? 'Opening Zoho…' : 'Connect Zoho'}
          </button>
        ))}
    </div>
  );
};
