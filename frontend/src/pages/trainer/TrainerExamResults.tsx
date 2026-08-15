import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { ShieldAlert, Award, Clock, ArrowLeft, Eye, CheckCircle2, AlertTriangle, Users, BarChart3 } from 'lucide-react';

export const TrainerExamResults: React.FC = () => {
  const { examId } = useParams();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAttempt, setSelectedAttempt] = useState<any | null>(null);

  useEffect(() => {
    fetchTrainerResults();
  }, [examId]);

  const fetchTrainerResults = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/exams/${examId}/trainer-results`);
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const exam = data?.exam;
  const attempts = data?.attempts || [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <Link to="/trainer/exams" className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 mb-1 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Exams
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{exam?.title} — Results & Proctoring Audit</h1>
          <p className="text-xs text-slate-500">Review student scores, time spent, passing status, and security violation logs</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Attempts</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">{attempts.length}</span>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pass Rate</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {attempts.length > 0
              ? `${Math.round((attempts.filter((a: any) => a.passed).length / attempts.length) * 100)}%`
              : '0%'}
          </span>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Avg Class Score</span>
          <span className="text-2xl font-black text-indigo-500 mt-1 block">
            {attempts.length > 0
              ? `${Math.round(attempts.reduce((sum: number, a: any) => sum + (a.percentage || 0), 0) / attempts.length)}%`
              : '0%'}
          </span>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Security Flags Logged</span>
          <span className="text-2xl font-black text-amber-500 mt-1 block">
            {attempts.reduce((sum: number, a: any) => sum + (a.violationsCount || 0), 0)}
          </span>
        </div>
      </div>

      {/* Attempts Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Student Exam Attempts</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Student Name</th>
                <th className="p-4">Student ID</th>
                <th className="p-4">Score</th>
                <th className="p-4">Percentage</th>
                <th className="p-4">Status</th>
                <th className="p-4">Violations</th>
                <th className="p-4 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {attempts.map((att: any) => (
                <tr key={att._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{att.studentId?.fullName || 'Student'}</td>
                  <td className="p-4 font-mono text-[11px] text-slate-500">{att.studentId?.studentId || 'SL-2026'}</td>
                  <td className="p-4 font-extrabold">{att.score ?? 0} / {exam?.totalMarks}</td>
                  <td className="p-4 font-bold">{att.percentage ?? 0}%</td>
                  <td className="p-4">
                    <Badge variant={att.passed ? 'green' : 'red'}>{att.passed ? 'PASS' : 'FAIL'}</Badge>
                  </td>
                  <td className="p-4">
                    {att.violationsCount > 0 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                        <AlertTriangle className="h-3.5 w-3.5" /> {att.violationsCount} Violations
                      </span>
                    ) : (
                      <span className="text-emerald-500 font-bold">✓ Clean</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedAttempt(att)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-[11px]"
                    >
                      View Logs
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Violation Log Modal */}
      {selectedAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" /> Proctoring Log: {selectedAttempt.studentId?.fullName}
              </h3>
              <button onClick={() => setSelectedAttempt(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-slate-300">
                <span>Submission Reason: </span>
                <strong className="text-white">{selectedAttempt.submissionReason || 'USER_SUBMITTED'}</strong>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {selectedAttempt.violations && selectedAttempt.violations.length > 0 ? (
                  selectedAttempt.violations.map((v: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs flex justify-between">
                      <span className="font-bold text-amber-400">{v.type}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(v.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic text-center py-4">No security violations recorded for this attempt.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
