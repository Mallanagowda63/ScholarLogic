import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  BookOpen,
  FileCheck,
  Users,
  Video,
  FileText,
  HelpCircle,
  CheckSquare,
  TrendingUp,
  Bell,
  Calendar as CalendarIcon,
  User,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export const TrainerSidebar: React.FC = () => {
  const { user } = useAuth();
  const [openSubmenu, setOpenSubmenu] = useState(true);

  if (!user) return null;

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between overflow-y-auto">
      <div>
        {/* Trainer Header Card (NO STUDENT FIELDS) */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-brand-950 text-white border border-brand-500/30 shadow-xl">
          <div className="flex items-center gap-3">
            <img
              src={user.avatarUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100'}
              alt={user.fullName}
              className="h-10 w-10 rounded-xl border border-brand-400/40 object-cover"
            />
            <div className="overflow-hidden">
              <h4 className="font-bold text-xs truncate text-white">{user.fullName}</h4>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-brand-500/30 text-brand-300 text-[10px] font-bold uppercase tracking-wider">
                SENIOR INSTRUCTOR
              </span>
            </div>
          </div>
        </div>

        {/* Exclusive Trainer Sidebar Navigation Tree */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            TRAINER PORTAL
          </p>

          <NavLink
            to="/trainer/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </NavLink>

          <NavLink
            to="/trainer/courses"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <BookOpen className="h-4 w-4 text-brand-500" /> My Courses
          </NavLink>

          {/* Course Content Submenu */}
          <div>
            <button
              onClick={() => setOpenSubmenu(!openSubmenu)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <Video className="h-4 w-4 text-emerald-500" /> Course Content
              </div>
              {openSubmenu ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            {openSubmenu && (
              <div className="ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 my-1 space-y-1 text-xs">
                <NavLink to="/trainer/content?tab=videos" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>🎥 Videos</NavLink>
                <NavLink to="/trainer/content?tab=notes" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>📄 Notes</NavLink>
                <NavLink to="/trainer/content?tab=modules" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>Modules</NavLink>
                <NavLink to="/trainer/content?tab=lessons" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>Lessons</NavLink>
              </div>
            )}
          </div>

          <NavLink to="/trainer/students" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Users className="h-4 w-4 text-indigo-500" /> Students</NavLink>
          <NavLink to="/trainer/assignments" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><FileText className="h-4 w-4 text-amber-500" /> Assignments</NavLink>
          <NavLink to="/trainer/exams?tab=quizzes" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><HelpCircle className="h-4 w-4 text-purple-500" /> Quizzes</NavLink>
          <NavLink to="/trainer/exams" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><FileCheck className="h-4 w-4 text-blue-500" /> Exams</NavLink>
          <NavLink to="/trainer/attendance" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><CheckSquare className="h-4 w-4 text-teal-500" /> Attendance</NavLink>
          <NavLink to="/trainer/students?tab=progress" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><TrendingUp className="h-4 w-4 text-rose-500" /> Student Performance</NavLink>
          <NavLink to="/trainer/announcements" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Bell className="h-4 w-4 text-amber-500" /> Announcements</NavLink>
          <NavLink to="/trainer/calendar" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><CalendarIcon className="h-4 w-4 text-brand-500" /> Calendar</NavLink>
          <NavLink to="/trainer/profile" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><User className="h-4 w-4 text-slate-500" /> My Profile</NavLink>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[11px] font-medium text-slate-400">ScholarLogic v1.0 Production</p>
      </div>
    </aside>
  );
};
