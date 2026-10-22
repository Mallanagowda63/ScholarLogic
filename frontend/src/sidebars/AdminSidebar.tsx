import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  QrCode,
  UserCircle,
  KeyRound,
  GalleryHorizontal,
  LayoutDashboard,
  Users,
  BookOpen,
  FileCheck,
  ShieldAlert,
  Layers,
  CalendarClock,
  CalendarRange,
  ListOrdered,
  UserCog,
  CheckSquare,
  History,
  PlaySquare,
  UserPlus,
  Fingerprint,
  IdCard,
} from 'lucide-react';

export const AdminSidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const onSubjectsTab = location.pathname === '/admin/courses' && location.search.includes('tab=subjects');
  const [pendingRegistrations, setPendingRegistrations] = useState(0);

  // Refresh the badge on navigation so new Google Form responses show up without a reload
  useEffect(() => {
    if (!user) return;
    api
      .get('/tracking/registrations')
      .then((r: any) => setPendingRegistrations(r.data?.counts?.PENDING || 0))
      .catch(() => {});
  }, [user, location.pathname]);

  if (!user) return null;

  const adminLinks = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Students', path: '/admin/students', icon: Users },
    { name: 'New Registrations', path: '/admin/registrations', icon: UserPlus },
    { name: 'Banners', path: '/admin/banners', icon: GalleryHorizontal },
    { name: 'Batches', path: '/admin/batches', icon: Layers },
    { name: 'Next Allocations', path: '/admin/next-allocations', icon: CalendarClock },
    { name: 'Monthly Planning', path: '/admin/planning', icon: CalendarRange },
    { name: 'Courses', path: '/admin/courses', icon: BookOpen },
    { name: 'Subjects', path: '/admin/courses?tab=subjects', icon: ListOrdered },
    { name: 'Trainers', path: '/admin/trainers', icon: UserCog },
    { name: 'Staff Access', path: '/admin/staff', icon: KeyRound },
    { name: 'My Profile', path: '/admin/profile', icon: UserCircle },
    { name: 'Login & Password', path: '/admin/account', icon: KeyRound },
    { name: 'Attendance', path: '/admin/attendance', icon: CheckSquare },
    { name: 'Online Attendance', path: '/admin/online-attendance', icon: QrCode },
    { name: 'Biometric Live', path: '/admin/biometric', icon: Fingerprint },
    { name: 'eSSL Integration', path: '/admin/essl', icon: IdCard },
    { name: 'History', path: '/admin/history', icon: History },
  ];

  // Existing platform modules stay available
  const platformLinks = [
    { name: 'LMS Content', path: '/admin/lms', icon: PlaySquare },
    { name: 'Exams', path: '/admin/exams', icon: FileCheck },
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

          {[...adminLinks, null, ...platformLinks].map((item, i) => {
            if (!item) {
              return (
                <p key={`sep-${i}`} className="px-3 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  PLATFORM
                </p>
              );
            }
            const Icon = item.icon;
            // "Courses" and "Subjects" share a route; highlight by tab
            const isSubjects = item.path.includes('tab=subjects');
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin/courses'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    (isSubjects ? onSubjectsTab : item.path === '/admin/courses' ? isActive && !onSubjectsTab : isActive)
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.name}</span>
                {item.path === '/admin/registrations' && pendingRegistrations > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-bold leading-4 text-white">{pendingRegistrations}</span>
                )}
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
