import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { GraduationCap } from 'lucide-react';

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
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email, Student ID or machine code</label>
            <input
              type="text"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. SCLR245, DA-001 or student@scholarlogic.edu"
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
            New student? Your login is given by the ScholarLogic team. Call{' '}
            <a href="tel:+919008625716" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              +91 90086 25716
            </a>
          </div>
        </form>

      </div>
    </div>
  );
};
