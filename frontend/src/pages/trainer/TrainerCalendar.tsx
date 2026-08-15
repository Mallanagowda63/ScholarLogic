import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Calendar as CalendarIcon, Clock, Video, FileCheck, FileText } from 'lucide-react';

export const TrainerCalendar: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK' | 'DAY'>('WEEK');

  useEffect(() => {
    api.get('/trainer/calendar')
      .then((res: any) => {
        if (res.success && res.data) {
          const sessions = res.data.sessions || [];
          setEvents(sessions);
        }
      })
      .catch(console.error);
  }, []);

  const scheduleEntries = [
    { time: '09:00 AM', title: 'Python Full Stack — Lesson 4 OOP Concepts', type: 'LECTURE' },
    { time: '11:30 AM', title: 'AWS Cloud Architecture — Doubt Clearing Session', type: 'DOUBT_CLEARING' },
    { time: '02:00 PM', title: 'DevOps Assessment Exam Review', type: 'ASSESSMENT' },
    { time: '04:30 PM', title: 'Assignment 2 Submission Review', type: 'ASSIGNMENT' },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Teaching Calendar & Schedule</h1>
          <p className="text-xs text-slate-500">View live classes, exam schedules, assignment deadlines, and doubt clearing sessions</p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          {(['MONTH', 'WEEK', 'DAY'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === mode ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-brand-500" /> Upcoming Teaching Timetable ({viewMode} View)
          </h3>

          <div className="space-y-3">
            {scheduleEntries.map((item, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-brand-600 dark:text-brand-400">{item.time}</span>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">{item.title}</h4>
                    <span className="text-[10px] text-slate-400">Assigned Trainer Session</span>
                  </div>
                </div>
                <Badge variant="blue">{item.type}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
