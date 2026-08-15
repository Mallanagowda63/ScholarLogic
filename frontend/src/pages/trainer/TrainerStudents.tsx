import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Users, Search, AlertTriangle, Eye, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const TrainerStudents: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [students, setStudents] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'AT_RISK'>(tabParam === 'atrisk' ? 'AT_RISK' : 'ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = () => {
    setLoading(true);
    api.get('/trainer/students')
      .then((res: any) => {
        if (res.success) setStudents(res.data.students || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const displayedStudents = activeTab === 'AT_RISK'
    ? students.filter((s) => s.courseProgressPct < 70 || s.avgExamScore < 70 || s.cgpa < 7.5)
    : students;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Enrolled Students & Performance</h1>
          <p className="text-xs text-slate-500">Track student progress, test scores, assignment completions, and at-risk indicators</p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ALL' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            All Students ({students.length})
          </button>

          <button
            onClick={() => setActiveTab('AT_RISK')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'AT_RISK' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            At-Risk Students
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Student ID</th>
                <th className="p-4">Student Name</th>
                <th className="p-4">Course & Branch</th>
                <th className="p-4">Course Progress</th>
                <th className="p-4">Average Score</th>
                <th className="p-4">Assignments</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedStudents.map((st) => (
                <tr key={st._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-4 font-mono font-bold text-brand-600 dark:text-brand-400">{st.studentId}</td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{st.fullName}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{st.branch}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500" style={{ width: `${st.courseProgressPct}%` }} />
                      </div>
                      <span className="font-bold">{st.courseProgressPct}%</span>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-emerald-600">{st.avgExamScore}%</td>
                  <td className="p-4">
                    {st.pendingAssignments > 0 ? (
                      <Badge variant="amber">{st.pendingAssignments} Overdue</Badge>
                    ) : (
                      <Badge variant="green">All Submitted</Badge>
                    )}
                  </td>
                  <td className="p-4">
                    {st.courseProgressPct < 50 || st.avgExamScore < 50 ? (
                      <Badge variant="red">AT RISK</Badge>
                    ) : (
                      <Badge variant="green">ON TRACK</Badge>
                    )}
                  </td>
                  <td className="p-4">
                    <Link
                      to={`/trainer/students/${st._id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold text-[11px] hover:bg-brand-700"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Profile
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
