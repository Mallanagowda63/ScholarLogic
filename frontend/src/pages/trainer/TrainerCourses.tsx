import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Course } from '../../types';
import { Badge } from '../../components/Badge';
import { BookOpen, Users, Clock, Edit, PlusCircle, ArrowRight } from 'lucide-react';

export const TrainerCourses: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trainer/courses')
      .then((res: any) => {
        if (res.success) setCourses(res.data.courses || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Assigned Courses & Content Management</h1>
          <p className="text-xs text-slate-500">Manage modules, lesson videos, notes, assignments, and curriculum hierarchy for assigned courses</p>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map((c) => (
            <div
              key={c._id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="blue">{c.category}</Badge>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">72% Completed</span>
                </div>

                <div className="flex gap-4">
                  <img
                    src={c.thumbnailUrl || 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=200'}
                    alt={c.title}
                    className="h-20 w-24 rounded-xl object-cover"
                  />
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{c.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.description}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs border-t border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Students</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">45</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Modules</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">8</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Duration</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{c.durationHours}h</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Link
                  to={`/trainer/content?courseId=${c._id}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-md hover:bg-brand-700 transition-colors"
                >
                  <Edit className="h-4 w-4" /> Manage Course Content & Curriculum
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
