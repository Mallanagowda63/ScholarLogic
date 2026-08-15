import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Bell, LogOut, User, GraduationCap, ShieldCheck, Briefcase } from 'lucide-react';
import { api } from '../services/api';
import { NotificationItem } from '../types';

export const Navbar: React.FC<{ isDashboard?: boolean }> = ({ isDashboard = false }) => {
  const { user, studentProfile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    if (user) {
      api.get('/notifications')
        .then((res: any) => {
          if (res.success && res.data) {
            setNotifications(res.data.notifications || []);
            setUnreadCount(res.data.unreadCount || 0);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const markRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {}
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return '/admin/dashboard';
      case 'TRAINER':
        return '/trainer/dashboard';
      case 'PLACEMENT_MANAGER':
        return '/placement/dashboard';
      default:
        return '/student/dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-transform">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Scholar<span className="text-brand-600 dark:text-brand-400">Logic</span>
              </span>
              <span className="block text-[10px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Career & Learning Hub
              </span>
            </div>
          </Link>
        </div>

        {/* Public Navigation Links */}
        {!isDashboard && (
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link to="/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Home</Link>
            <Link to="/courses" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Courses</Link>
            <Link to="/placement" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">Placement Drive</Link>
            <Link to="/about" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">About Us</Link>
          </nav>
        )}

        {/* Right Action Icons & Controls */}
        <div className="flex items-center gap-3">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {user ? (
            <>
              {/* Student ID Badge */}
              {user.role === 'STUDENT' && (studentProfile?.studentId || user.studentId) && (
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-xs font-semibold text-brand-700 dark:text-brand-300">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                  <span>ID: {studentProfile?.studentId || user.studentId}</span>
                </div>
              )}

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xl z-50">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Notifications</h4>
                      <span className="text-xs text-slate-500">{unreadCount} unread</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-4">No notifications yet</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n._id}
                            onClick={() => markRead(n._id)}
                            className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                              n.read
                                ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                : 'bg-brand-50/70 dark:bg-brand-950/40 border-brand-200 dark:border-brand-900 text-slate-900 dark:text-slate-100 font-medium'
                            }`}
                          >
                            <p className="font-semibold text-slate-900 dark:text-white">{n.title}</p>
                            <p className="mt-0.5 text-[11px] leading-relaxed">{n.message}</p>
                            <span className="mt-1 block text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-2 rounded-xl p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <img
                    src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={user.fullName}
                    className="h-9 w-9 rounded-xl object-cover ring-2 ring-brand-500/30"
                  />
                  <div className="hidden lg:block text-left text-xs">
                    <p className="font-semibold text-slate-900 dark:text-white leading-tight">{user.fullName}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-brand-600 dark:text-brand-400">{user.role}</p>
                  </div>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xl z-50 text-sm">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="font-semibold text-slate-900 dark:text-white">{user.fullName}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>

                    <div className="py-1">
                      <Link
                        to={getDashboardPath()}
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <User className="h-4 w-4" /> My Dashboard
                      </Link>

                      {user.role === 'STUDENT' && (
                        <Link
                          to="/student/profile"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                        >
                          <ShieldCheck className="h-4 w-4" /> Student Profile
                        </Link>
                      )}
                    </div>

                    <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          logout();
                          navigate('/login');
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                      >
                        <LogOut className="h-4 w-4" /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-brand-500/20 hover:opacity-95 transition-opacity"
              >
                Join ScholarLogic
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
