import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { GraduationCap, LogIn, Key, UserCheck, ShieldCheck, Briefcase } from 'lucide-react';

export const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res: any = await api.post('/auth/login', { email: email.trim(), password });
      if (res.success && res.data) {
        login(res.data.tokens.accessToken, res.data.user);
        const role = res.data.user.role;
        if (role === 'ADMIN' || role === 'SUPER_ADMIN') navigate('/admin/dashboard');
        else if (role === 'TRAINER') navigate('/trainer/dashboard');
        else if (role === 'PLACEMENT_MANAGER') navigate('/placement/dashboard');
        else navigate('/student/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-500/25">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">ScholarLogic Central Sign In</h2>
          <p className="text-xs text-slate-500">Access LMS, Exams, Resume AI & Placement Portal with one account</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@scholarlogic.edu"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-brand-500/20 hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In to ScholarLogic'}
          </button>

          <div className="pt-2 text-center text-xs text-slate-500">
            Don't have a Student ID yet?{' '}
            <Link to="/register" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              Register here
            </Link>
          </div>
        </form>

        {/* Quick Demo Login Credentials Buttons */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-4 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center">
            ⚡ Quick Demo Accounts (Click to Auto-fill)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDemoLogin('student@scholarlogic.edu', 'Student@123')}
              className="p-2 rounded-xl border border-brand-200 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/40 text-[11px] font-semibold text-brand-700 dark:text-brand-300 text-left hover:bg-brand-100 transition-colors"
            >
              <div className="font-bold flex items-center gap-1"><UserCheck className="h-3 w-3" /> Student Demo</div>
              <div className="text-[10px] opacity-80">SL-2026-00001</div>
            </button>

            <button
              onClick={() => handleDemoLogin('admin@scholarlogic.edu', 'Admin@123')}
              className="p-2 rounded-xl border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/40 text-[11px] font-semibold text-purple-700 dark:text-purple-300 text-left hover:bg-purple-100 transition-colors"
            >
              <div className="font-bold flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Admin Demo</div>
              <div className="text-[10px] opacity-80">Full Platform Access</div>
            </button>

            <button
              onClick={() => handleDemoLogin('trainer@scholarlogic.edu', 'Trainer@123')}
              className="p-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/40 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 text-left hover:bg-emerald-100 transition-colors"
            >
              <div className="font-bold flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Trainer Demo</div>
              <div className="text-[10px] opacity-80">Manage LMS Courses</div>
            </button>

            <button
              onClick={() => handleDemoLogin('placement@scholarlogic.edu', 'Placement@123')}
              className="p-2 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/40 text-[11px] font-semibold text-amber-700 dark:text-amber-300 text-left hover:bg-amber-100 transition-colors"
            >
              <div className="font-bold flex items-center gap-1"><Briefcase className="h-3 w-3" /> Placement Demo</div>
              <div className="text-[10px] opacity-80">Jobs & Shortlisting</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
