import React from 'react';
import { UserAvatar } from '../components/UserAvatar';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  UserCircle,
  UserCheck,
  GalleryHorizontal,
  LayoutDashboard,
  Building,
  Briefcase,
  Send,
} from 'lucide-react';

export const PlacementSidebar: React.FC = () => {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between overflow-y-auto">
      <div>
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-brand-950 text-white border border-brand-500/30 shadow-xl">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} className="h-10 w-10 rounded-xl border border-brand-400/40" />
            <div className="overflow-hidden">
              <h4 className="font-bold text-xs truncate text-white">{user.fullName}</h4>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-brand-500/30 text-brand-300 text-[10px] font-bold uppercase tracking-wider">
                PLACEMENT DIRECTOR
              </span>
            </div>
          </div>
        </div>

        {/* Exclusive Placement Sidebar Navigation Tree */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            PLACEMENT PORTAL
          </p>

          <NavLink
            to="/placement/dashboard"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <LayoutDashboard className="h-4 w-4" /> Placement Overview
          </NavLink>

          <NavLink to="/placement/jobs" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Briefcase className="h-4 w-4 text-emerald-500" /> Job Postings</NavLink>
          <NavLink to="/placement/applications" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Send className="h-4 w-4 text-blue-500" /> Applications</NavLink>
          <NavLink to="/placement/companies" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Building className="h-4 w-4 text-indigo-500" /> Companies</NavLink>
          <NavLink to="/placement/ready-students" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><UserCheck className="h-4 w-4 text-emerald-500" /> Students from Trainers</NavLink>

          <NavLink to="/placement/banners" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><GalleryHorizontal className="h-4 w-4 text-indigo-500" /> Student Banners</NavLink>
          <NavLink to="/placement/profile" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><UserCircle className="h-4 w-4 text-slate-500" /> My Profile</NavLink>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[11px] font-medium text-slate-400">ScholarLogic v1.0 Production</p>
      </div>
    </aside>
  );
};
