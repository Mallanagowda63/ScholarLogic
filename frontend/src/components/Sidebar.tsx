import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  BookOpen,
  FileCheck,
  Award,
  Sparkles,
  Briefcase,
  Send,
  UserCheck,
  Users,
  Building,
  ShieldAlert,
  GraduationCap,
  Calendar as CalendarIcon,
  Bell,
  MessageSquare,
  BarChart3,
  CheckSquare,
  User,
  Settings,
  ChevronDown,
  ChevronRight,
  Video,
  FileText,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { user, studentProfile } = useAuth();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    studentLms: true,
    courseContent: true,
  });

  if (!user) return null;

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const adminLinks = [
    { name: 'Admin Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Manage Students', path: '/admin/students', icon: Users },
    { name: 'Manage Courses', path: '/admin/courses', icon: BookOpen },
    { name: 'Manage Exams', path: '/admin/exams', icon: FileCheck },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: ShieldAlert },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between overflow-y-auto">
      <div>
        {user.role === 'STUDENT' ? (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-xl shadow-brand-500/20">
            <div className="flex items-center gap-3">
              <img
                src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt={user.fullName}
                className="h-10 w-10 rounded-full border-2 border-white/40 object-cover"
              />
              <div className="overflow-hidden">
                <h4 className="font-bold text-sm truncate">{user.fullName}</h4>
                <p className="text-[11px] font-mono text-brand-200">
                  {studentProfile?.studentId || user.studentId || 'SL-2026-00001'}
                </p>
              </div>
            </div>
          </div>
        ) : user.role === 'TRAINER' ? (
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
        ) : null}

        {/* Student Sidebar Tree */}
        {user.role === 'STUDENT' ? (
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              STUDENT LMS
            </p>

            <NavLink
              to="/student/dashboard"
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

            {/* My Learning Submenu */}
            <div>
              <button
                onClick={() => toggleSubmenu('studentLms')}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <BookOpen className="h-4 w-4 text-brand-500" /> My Learning (LMS)
                </div>
                {openSubmenus.studentLms ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>

              {openSubmenus.studentLms && (
                <div className="ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 my-1 space-y-1 text-xs">
                  <NavLink to="/student/courses" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>My Courses</NavLink>
                  <NavLink to="/student/courses?tab=videos" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>🎥 Videos</NavLink>
                  <NavLink to="/student/courses?tab=notes" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>📄 Notes</NavLink>
                  <NavLink to="/student/courses?tab=progress" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>📊 Progress</NavLink>
                </div>
              )}
            </div>

            <NavLink to="/student/exams" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><FileCheck className="h-4 w-4 text-blue-500" /> Exams & Quizzes</NavLink>
            <NavLink to="/student/results" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Award className="h-4 w-4 text-amber-500" /> Exam Results</NavLink>
            <NavLink to="/student/resume" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Sparkles className="h-4 w-4 text-purple-500" /> Resume AI Builder</NavLink>
            <NavLink to="/student/jobs" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Briefcase className="h-4 w-4 text-emerald-500" /> Placement Portal</NavLink>
            <NavLink to="/student/applications" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Send className="h-4 w-4 text-indigo-500" /> My Applications</NavLink>
            <NavLink to="/student/certificates" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><GraduationCap className="h-4 w-4 text-teal-500" /> Certificates</NavLink>
            <NavLink to="/student/profile" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><UserCheck className="h-4 w-4 text-slate-500" /> My Profile</NavLink>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Navigation Menu
            </p>
            {adminLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-brand-500 text-white shadow-md'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[11px] font-medium text-slate-400">ScholarLogic v1.0 Production</p>
      </div>
    </aside>
  );
};
