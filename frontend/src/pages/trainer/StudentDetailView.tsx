import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { User, ShieldCheck, BookOpen, Award, CheckCircle2, TrendingUp, ArrowLeft } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

export const StudentDetailView: React.FC = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.get(`/trainer/students/${id}`)
        .then((res: any) => {
          if (res.success && res.data) setData(res.data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const student = data?.student;
  if (!student) return <div className="text-center py-12 text-xs">Student record not found.</div>;

  const topicData = [
    { topic: 'Python Basics', score: 92 },
    { topic: 'OOP Concepts', score: 86 },
    { topic: 'Data Structures', score: 74 },
    { topic: 'REST APIs', score: 90 },
    { topic: 'SQL & Databases', score: 88 },
  ];

  return (
    <div className="space-y-8 pb-12">
      <Link to="/trainer/students" className="inline-flex items-center gap-2 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Students Directory
      </Link>

      {/* Profile Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-brand-950 p-8 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-brand-500 text-white font-black text-2xl flex items-center justify-center shadow-lg">
            {student.studentId?.slice(-3) || '001'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">{student.userId?.fullName || 'Alex Morgan'}</h1>
              <Badge variant="green">ACTIVE</Badge>
            </div>
            <p className="text-xs text-brand-200 font-mono mt-1">
              ID: {student.studentId} • {student.degree} ({student.branch})
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{student.college} • Batch {student.batch || '2026'}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20">
          <div className="text-center">
            <span className="block text-2xl font-black">{student.cgpa}</span>
            <span className="text-[10px] uppercase font-bold text-white/80">CGPA Score</span>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div className="text-center">
            <span className="block text-2xl font-black">88%</span>
            <span className="text-[10px] uppercase font-bold text-white/80">Class Average</span>
          </div>
        </div>
      </div>

      {/* Learning & Topic Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-500" /> Topic Strength & Weakness Radar
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={topicData}>
                <PolarGrid stroke="#94a3b8" strokeDasharray="3 3" opacity={0.3} />
                <PolarAngleAxis dataKey="topic" tick={{ fill: '#64748b', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="Score" dataKey="score" stroke="#0c8ee9" fill="#0c8ee9" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Exam Submissions & Results */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" /> Exam & Assessment History
          </h3>

          <div className="space-y-3">
            {(data?.results || []).map((resDoc: any) => (
              <div key={resDoc._id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{resDoc.examId?.title || 'Assessment'}</h4>
                  <p className="text-[10px] text-slate-400">Score: {resDoc.score} / {resDoc.totalMarks} Marks</p>
                </div>
                <Badge variant={resDoc.passed ? 'green' : 'red'}>{resDoc.percentage}% ({resDoc.passed ? 'PASSED' : 'FAILED'})</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
