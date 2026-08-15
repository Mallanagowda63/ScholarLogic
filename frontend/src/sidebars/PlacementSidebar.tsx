import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building,
  Briefcase,
  Send,
  TrendingUp,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export const PlacementSidebar: React.FC = () => {
  const { user } = useAuth();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({
    placementCompanies: true,
    placementJobs: true,
    placementHiring: true,
  });

  if (!user) return null;

  const toggleSubmenu = (key: string) => {
    setOpenSubmenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between overflow-y-auto">
      <div>
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-brand-950 text-white border border-brand-500/30 shadow-xl">
          <div className="flex items-center gap-3">
            <img
              src={user.avatarUrl || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100'}
              alt={user.fullName}
              className="h-10 w-10 rounded-xl border border-brand-400/40 object-cover"
            />
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

          {/* Companies Submenu */}
          <div>
            <button
              onClick={() => toggleSubmenu('placementCompanies')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-indigo-500" /> Companies
              </div>
              {openSubmenus.placementCompanies ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            {openSubmenus.placementCompanies && (
              <div className="ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 my-1 space-y-1 text-xs">
                <NavLink to="/placement/companies" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>All Companies</NavLink>
                <NavLink to="/placement/companies?filter=hiring" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>🔥 Hiring Now</NavLink>
                <NavLink to="/placement/comparison" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>Company Comparison</NavLink>
              </div>
            )}
          </div>

          {/* Job Postings Submenu */}
          <div>
            <button
              onClick={() => toggleSubmenu('placementJobs')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-emerald-500" /> Job Postings
              </div>
              {openSubmenus.placementJobs ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            {openSubmenus.placementJobs && (
              <div className="ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 my-1 space-y-1 text-xs">
                <NavLink to="/placement/jobs" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>ScholarLogic Jobs</NavLink>
                <NavLink to="/placement/jobs/official" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>Official Company Jobs</NavLink>
              </div>
            )}
          </div>

          <NavLink to="/placement/applications" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><Send className="h-4 w-4 text-blue-500" /> Applications</NavLink>

          {/* Hiring Intelligence Submenu */}
          <div>
            <button
              onClick={() => toggleSubmenu('placementHiring')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-amber-500" /> Hiring Intelligence
              </div>
              {openSubmenus.placementHiring ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            {openSubmenus.placementHiring && (
              <div className="ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 my-1 space-y-1 text-xs">
                <NavLink to="/placement/hiring-intelligence/trends" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>Hiring Trends</NavLink>
                <NavLink to="/placement/hiring-intelligence/skills" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>Skills in Demand</NavLink>
                <NavLink to="/placement/hiring-intelligence/locations" className={({ isActive }) => `block py-1.5 font-medium ${isActive ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-900'}`}>Hiring Locations</NavLink>
              </div>
            )}
          </div>

          <NavLink to="/placement/reports" className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold ${isActive ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'}`}><FileSpreadsheet className="h-4 w-4 text-teal-500" /> Reports & Analytics</NavLink>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[11px] font-medium text-slate-400">ScholarLogic v1.0 Production</p>
      </div>
    </aside>
  );
};
