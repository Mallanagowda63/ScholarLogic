import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Result } from '../../types';
import { Badge } from '../../components/Badge';
import { Award, CheckCircle2, XCircle, HelpCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export const ExamResult: React.FC = () => {
  const { id } = useParams();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.get(`/exams/results/${id}`)
        .then((res: any) => {
          if (res.success && res.data) setResult(res.data.result);
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

  if (!result) return <div className="text-center py-12 text-xs">Result report not found.</div>;

  const topicChartData = (result.topicBreakdown || []).map((t) => ({
    topic: t.topic,
    percentage: t.percentage,
  }));

  return (
    <div className="space-y-8 pb-12">
      {/* Result Hero Score Header */}
      <div className={`rounded-3xl p-8 text-white shadow-xl ${
        result.passed
          ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900'
          : 'bg-gradient-to-r from-rose-600 via-pink-600 to-slate-900'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <Badge variant={result.passed ? 'green' : 'red'}>
              {result.passed ? 'PASSED & CERTIFIED' : 'NEEDS REVISION'}
            </Badge>
            <h1 className="text-3xl font-extrabold tracking-tight">{(result.examId as any)?.title || 'Assessment Result'}</h1>
            <p className="text-xs text-white/80">Evaluated for Candidate: {(result.studentId as any)?.studentId || 'SL-2026-00001'}</p>
          </div>

          <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20">
            <div className="text-center">
              <span className="block text-3xl font-black">{result.percentage}%</span>
              <span className="text-[10px] uppercase font-bold text-white/80">Score Percentage</span>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div className="text-center">
              <span className="block text-2xl font-extrabold">{result.score} / {result.totalMarks}</span>
              <span className="text-[10px] uppercase font-bold text-white/80">Marks Obtained</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Correct Answers</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{result.correctCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
          <XCircle className="h-8 w-8 text-rose-500" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Wrong Answers</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{result.wrongCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
          <HelpCircle className="h-8 w-8 text-slate-400" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Unanswered</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{result.unansweredCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-brand-500" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400">Time Spent</span>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{Math.floor(result.timeSpentSeconds / 60)}m {result.timeSpentSeconds % 60}s</p>
          </div>
        </div>
      </div>

      {/* Topic Skill Performance Chart */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-500" /> Topic Strength & Weakness Breakdown
          </h3>
          <span className="text-xs text-slate-500">Skill Score % per Topic</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topicChartData}>
              <XAxis dataKey="topic" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                {topicChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.percentage >= 70 ? '#10b981' : '#f59e0b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Link
          to="/student/exams"
          className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Back to Exams
        </Link>
        <Link
          to="/student/resume"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 hover:bg-brand-700"
        >
          Add Verified Score to AI Resume <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};
