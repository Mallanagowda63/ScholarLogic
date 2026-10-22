import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Card, EmptyRow, ErrorNote, PageHeader, Spinner, inputClass } from './tracking/shared';

// Online students' QR attendance for one day (separate from eSSL machine punches)

const todayIST = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);

export const AdminOnlineAttendance: React.FC = () => {
  const [date, setDate] = useState(todayIST());
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api
      .get('/online-attendance', { params: { date } })
      .then((res: any) => setData(res.data))
      .catch((e: any) => setError(e.message));
  }, [date]);

  const th = 'px-3 py-3 whitespace-nowrap text-left';
  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Online Attendance"
        subtitle="Online students mark attendance by scanning the QR code on their dashboard. This is separate from the eSSL machine."
        action={<input id="oa-date" type="date" className={`${inputClass} !w-44`} value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} />}
      />
      <ErrorNote text={error} />
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Card className="p-4">
              <p className="text-2xl font-extrabold text-emerald-600">{data.present.length}</p>
              <p className="text-[11px] font-semibold text-slate-500">Marked present</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-extrabold text-amber-600">{data.notMarked.length}</p>
              <p className="text-[11px] font-semibold text-slate-500">Online students not marked</p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <h3 className="border-b border-slate-100 dark:border-slate-800 p-4 text-sm font-bold text-slate-900 dark:text-white">Present</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    {['Time', 'Student', 'Course / batch', 'Topic attended', 'Note'].map((h) => (
                      <th key={h} className={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.present.length === 0 ? (
                    <EmptyRow colSpan={5} text="Nobody has marked online attendance on this day." />
                  ) : (
                    data.present.map((r: any) => (
                      <tr key={r._id}>
                        <td className="px-3 py-3 whitespace-nowrap font-semibold text-emerald-600">
                          {new Date(r.checkedInAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-white">{r.fullName}</span>
                          <span className="block font-mono text-[10px] text-slate-400">{r.studentId}</span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {r.course || '—'}
                          {r.batches?.length > 0 && <span className="block font-mono text-[10px] text-slate-400">{r.batches.join(', ')}</span>}
                        </td>
                        <td className="px-3 py-3">{r.topic}</td>
                        <td className="px-3 py-3 text-slate-500">{r.note || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {data.notMarked.length > 0 && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Online students who have not marked attendance</h3>
              <div className="flex flex-wrap gap-2">
                {data.notMarked.map((s: any) => (
                  <span key={s.studentId} className="rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    {s.fullName} <span className="font-mono opacity-70">{s.studentId}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
