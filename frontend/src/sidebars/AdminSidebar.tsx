import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const { user } = useAuth();

  if (!user) return null;

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
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-700 shadow-xl">
          <div className="flex items-center gap-3">
            <img
              src={user.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100'}
              alt={user.fullName}
              className="h-10 w-10 rounded-xl border border-slate-600 object-cover"
            />
            <div className="overflow-hidden">
              <h4 className="font-bold text-xs truncate text-white">{user.fullName}</h4>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-brand-500/30 text-brand-300 text-[10px] font-bold uppercase tracking-wider">
                ADMINISTRATION
              </span>
            </div>
          </div>
        </div>

        {/* Exclusive Admin Sidebar Navigation Tree */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            ADMIN PORTAL
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
                      ? 'bg-brand-600 text-white shadow-md'
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
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[11px] font-medium text-slate-400">ScholarLogic v1.0 Production</p>
      </div>
    </aside>
  );
};
