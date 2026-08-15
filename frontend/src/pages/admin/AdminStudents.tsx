import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { StudentProfile } from '../../types';
import { Badge } from '../../components/Badge';
import { Users, Search, ShieldCheck } from 'lucide-react';

export const AdminStudents: React.FC = () => {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/students')
      .then((res: any) => {
        if (res.success) setStudents(res.data.students || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Student Directory & Identity Registry</h1>
        <p className="text-xs text-slate-500">Central Student ID management across all academy modules</p>
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
                <th className="p-4">Full Name</th>
                <th className="p-4">Degree & Branch</th>
                <th className="p-4">CGPA</th>
                <th className="p-4">Verified Skills</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {students.map((st) => (
                <tr key={st._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-4 font-mono font-bold text-brand-600 dark:text-brand-400">{st.studentId}</td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{(st.userId as any)?.fullName || 'Student'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{st.degree} — {st.branch} ({st.graduationYear})</td>
                  <td className="p-4 font-bold text-emerald-600">{st.cgpa}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {st.skills.slice(0, 4).map((sk) => (
                        <span key={sk} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                          {sk}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge variant="green">ACTIVE</Badge>
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
