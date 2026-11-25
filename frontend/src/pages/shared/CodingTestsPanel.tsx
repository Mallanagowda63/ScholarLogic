import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Link2, Trash2, Trophy } from 'lucide-react';
import { api } from '../../services/api';
import { Modal, Spinner, secondaryBtn } from '../admin/tracking/shared';

// Trainer: coding tests made with "Technical test (link)": share link, who took it, scores
const when = (d?: string) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export const CodingTestsPanel: React.FC<{ initialTestId?: string; onClose: () => void; onMessage: (m: string) => void }> = ({ initialTestId, onClose, onMessage }) => {
  const [tests, setTests] = useState<any[] | null>(null);
  const [openId, setOpenId] = useState(initialTestId || '');
  const [detail, setDetail] = useState<any | null>(null);
  const load = () => api.get('/coding/tests').then((r: any) => setTests(r.data.tests)).catch((e: any) => onMessage(e.message));
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    setDetail(null);
    if (openId) api.get(`/coding/tests/${openId}/results`).then((r: any) => setDetail(r.data)).catch((e: any) => onMessage(e.message));
  }, [openId]);
  const copy = (link: string) => navigator.clipboard?.writeText(link).then(() => onMessage('Link copied'), () => undefined);
  const remove = async (t: any) => {
    if (!window.confirm(`Remove "${t.title}" and its results?`)) return;
    try {
      const r: any = await api.delete(`/coding/tests/${t._id}`);
      onMessage(r.message);
      setOpenId('');
      load();
    } catch (e: any) {
      onMessage(e.message);
    }
  };

  return (
    <Modal wide title={detail ? detail.test.title : 'Coding tests'} subtitle={detail ? `${detail.attempts.length} students • ${detail.questions.length} questions • ${detail.test.durationMinutes} min` : 'Made with Exams → Technical test (link) → ScholarLogic coding test'} onClose={onClose}>
      {!openId ? (
        !tests ? (
          <Spinner />
        ) : tests.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">No coding tests yet. Make one in Exams → Technical test (link).</p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {tests.map((t) => (
              <li key={t._id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <button type="button" className="min-w-0 text-left" onClick={() => setOpenId(t._id)}>
                  <span className="block text-sm font-bold text-slate-900 hover:text-brand-600 dark:text-white">{t.title}</span>
                  <span className="block text-[11px] text-slate-500">
                    {t.folder?.name} • {t.questionCount} questions • {t.durationMinutes} min • {t.submitted}/{t.started} finished • average {t.average}%
                  </span>
                </button>
                <span className="flex gap-1">
                  <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => copy(t.link)}>
                    <Copy className="h-3.5 w-3.5" /> Link
                  </button>
                  <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => setOpenId(t._id)}>
                    <Trophy className="h-3.5 w-3.5" /> Results
                  </button>
                  <button type="button" aria-label={`Remove ${t.title}`} className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600" onClick={() => remove(t)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )
      ) : !detail ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => setOpenId('')}>
              <ArrowLeft className="h-3.5 w-3.5" /> All tests
            </button>
            <span className="flex min-w-0 flex-1 items-center gap-1 truncate rounded-lg bg-brand-50 px-2 py-1 font-mono text-xs text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
              <Link2 className="h-3.5 w-3.5 shrink-0" /> {detail.test.link}
            </span>
            <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => copy(detail.test.link)}>
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
          {detail.attempts.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">Nobody has opened this test yet.</p>
          ) : (
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Score</th>
                    {detail.questions.map((q: any, i: number) => (
                      <th key={q._id} className="px-2 py-2 text-center" title={q.title}>
                        Q{i + 1}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left">Finished</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {detail.attempts.map((a: any, i: number) => (
                    <tr key={a._id}>
                      <td className="px-3 py-2 font-bold text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{a.student?.fullName}</span> <span className="font-mono text-[10px] text-slate-400">{a.student?.studentId}</span>
                      </td>
                      <td className="px-3 py-2 font-black text-brand-600">{a.score}%</td>
                      {detail.questions.map((q: any) => {
                        const ans = a.answers.find((x: any) => String(x.questionId) === String(q._id));
                        return (
                          <td key={q._id} className="px-2 py-2 text-center">
                            {!ans ? <span className="text-slate-300">—</span> : ans.passed === ans.total ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" /> : <span className="font-bold text-amber-600">{ans.passed}/{ans.total}</span>}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">{a.status === 'SUBMITTED' ? when(a.submittedAt) : 'still taking it'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
