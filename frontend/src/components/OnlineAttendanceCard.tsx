import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CalendarCheck, CheckCircle2, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { api } from '../services/api';

// Online students: scan this QR with your phone to mark today's attendance.
// The code changes every minute; attendance is separate from the eSSL machine.

interface QrData {
  checkInUrl: string;
  expiresInSeconds: number;
  today: string;
  markedToday: { checkedInAt: string; topic: string } | null;
}
interface Rec {
  _id: string;
  localDate: string;
  checkedInAt: string;
  topic: string;
}

const REFRESH_MS = 30000;
const fmtTime = (d: string) => new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export const OnlineAttendanceCard: React.FC = () => {
  const [qr, setQr] = useState<QrData | null>(null);
  const [img, setImg] = useState('');
  const [history, setHistory] = useState<{ records: Rec[]; thisMonth: number } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get('/online-attendance/qr')
      .then(async (res: any) => {
        setQr(res.data);
        setError('');
        setImg(await QRCode.toDataURL(res.data.checkInUrl, { width: 260, margin: 1, errorCorrectionLevel: 'M' }));
      })
      .catch((e: any) => setError(e.message));
    api
      .get('/online-attendance/me')
      .then((res: any) => setHistory(res.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    // New code every 30 s (each one is valid for 2 minutes) and today's status picks up a scan from the phone
    const t = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const marked = qr?.markedToday;

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
            <QrCode className="h-5 w-5 text-brand-600" /> Online Attendance
          </h2>
          <p className="text-xs text-slate-500">Scan the code with your phone once a day, during or after your online class.</p>
        </div>
        {history && (
          <span className="rounded-full bg-brand-50 dark:bg-brand-950/50 px-3 py-1 text-xs font-bold text-brand-700 dark:text-brand-300">
            {history.thisMonth} day{history.thisMonth === 1 ? '' : 's'} this month
          </span>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>}

      <div className="mt-5 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-2">
          {marked ? (
            <div className="flex h-[260px] w-[260px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-600" />
              <p className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">Present today</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Marked at {fmtTime(marked.checkedInAt)}</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 line-clamp-2">{marked.topic}</p>
            </div>
          ) : img ? (
            <>
              <img src={img} alt="QR code to mark today's online attendance" width={260} height={260} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-2" />
              <button type="button" onClick={load} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-brand-600">
                <RefreshCw className="h-3 w-3" /> Changes every minute · refresh
              </button>
            </>
          ) : (
            <div className="h-[260px] w-[260px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          )}
        </div>

        <div className="min-w-0 space-y-4">
          {!marked && (
            <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Open your phone camera and point it at the QR code.
              </li>
              <li className="flex gap-2">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> Tap the link, check your details, write today's class or topic, and submit.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> This box turns green when your attendance is saved.
              </li>
            </ol>
          )}

          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Recent online attendance</h3>
            {!history || history.records.length === 0 ? (
              <p className="text-xs text-slate-500">No online attendance yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                {history.records.slice(0, 7).map((r) => (
                  <li key={r._id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">{fmtDay(r.localDate)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">{r.topic}</span>
                    <span className="whitespace-nowrap text-emerald-600 font-semibold">{fmtTime(r.checkedInAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
