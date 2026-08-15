import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { CheckSquare, Users, Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react';

export const TrainerAttendance: React.FC = () => {
  const [students, setStudents] = useState<any[]>([]);
  const [sessionName, setSessionName] = useState('Python OOP Lecture 04');
  const [records, setRecords] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trainer/students')
      .then((res: any) => {
        if (res.success && res.data.students) {
          setStudents(res.data.students);
          const initial: Record<string, any> = {};
          res.data.students.forEach((s: any) => {
            initial[s._id] = 'PRESENT';
          });
          setRecords(initial);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSaveAttendance = async () => {
    try {
      const coursesRes: any = await api.get('/trainer/courses');
      const courseId = coursesRes.data.courses[0]?._id;

      const formattedRecords = Object.entries(records).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      await api.post('/trainer/attendance', {
        courseId,
        sessionName,
        records: formattedRecords,
      });

      alert('Attendance saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Session Attendance Marker</h1>
          <p className="text-xs text-slate-500">Record and monitor student attendance across live classes and doubt clearing sessions</p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500">Class Attendance Rate:</span>
          <Badge variant="green" className="text-sm font-black px-3 py-1">87% PRESENT</Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500">Session Name / Topic:</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white w-64"
            />
          </div>

          <button
            onClick={handleSaveAttendance}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors shadow-md"
          >
            Save Session Attendance
          </button>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-3">Student ID</th>
              <th className="p-3">Student Name</th>
              <th className="p-3">Attendance Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {students.map((st) => (
              <tr key={st._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="p-3 font-mono font-bold text-brand-600">{st.studentId}</td>
                <td className="p-3 font-bold text-slate-900 dark:text-white">{st.fullName}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setRecords((prev) => ({ ...prev, [st._id]: status }))}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          records[st._id] === status
                            ? status === 'PRESENT'
                              ? 'bg-emerald-600 text-white'
                              : status === 'ABSENT'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-500 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
