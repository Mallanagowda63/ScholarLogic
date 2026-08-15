import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Exam } from '../../types';
import { Badge } from '../../components/Badge';
import { FileCheck, Clock, Award, ShieldCheck, ArrowRight } from 'lucide-react';

export const StudentExams: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/exams')
      .then((res: any) => {
        if (res.success) setExams(res.data.exams || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">ScholarLogic Assessment Exams</h1>
        <p className="text-xs text-slate-500 font-medium">Take secure proctored certification exams with real-time timers and proctoring controls</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exams.map((exam) => (
            <div
              key={exam._id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="blue">{exam.durationMinutes} Minutes</Badge>
                  <span className="text-xs font-semibold text-slate-500">Attempts: {exam.attemptLimit} Max</span>
                </div>

                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{exam.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{exam.description}</p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="text-xs text-slate-500 font-medium">
                  Passing: <span className="font-bold text-slate-900 dark:text-white">{exam.passingMarks} / {exam.totalMarks} Marks</span>
                </div>

                <Link
                  to={`/student/exams/${exam._id}/instructions`}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-brand-500/20 hover:opacity-95 transition-opacity"
                >
                  <ShieldCheck className="h-4 w-4" /> Start Secure Exam <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
