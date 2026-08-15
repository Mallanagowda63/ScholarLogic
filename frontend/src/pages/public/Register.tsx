import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { GraduationCap, ShieldCheck, BookOpen, AlertTriangle, LogIn } from 'lucide-react';

export const Register: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [college, setCollege] = useState('ScholarLogic Institute of Technology');
  const [degree, setDegree] = useState('B.Tech');
  const [branch, setBranch] = useState('Computer Science & Engineering');
  const [preferredTrack, setPreferredTrack] = useState('Software Engineering');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
  
    try {
      const res: any = await api.post('/auth/register', {
        fullName,
        email: email.trim(),
        password,
        role: 'STUDENT',
        college,
        degree,
        branch,
        preferredRole: preferredTrack,
      });

      if (res.success && res.data) {
        login(res.data.tokens.accessToken, res.data.user);
        navigate('/student/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-500/25">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">ScholarLogic Student Registration</h2>
          <p className="text-xs text-slate-500">Receive your permanent ScholarLogic Student ID upon registration</p>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-xs font-semibold text-amber-800 dark:text-amber-300 space-y-3">
            <div className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
            {error.toLowerCase().includes('already exists') && (
              <div className="pt-1">
                <Link
                  to={`/login?email=${encodeURIComponent(email)}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold text-xs shadow-md hover:opacity-95 transition-opacity"
                >
                  <LogIn className="h-3.5 w-3.5" /> Sign In with {email || 'your email'} →
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Degree</label>
              <input
                type="text"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Primary Course / Track Interest</label>
              <select
                value={preferredTrack}
                onChange={(e) => setPreferredTrack(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="Software Engineering">Software Engineering</option>
                <option value="Cloud Computing">Cloud Computing</option>
                <option value="DevOps & Infrastructure">DevOps & Infrastructure</option>
                <option value="Data Science & Analytics">Data Science & Analytics</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-900 flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-600" />
            <span>Automatic Permanent Student ID format: SL-2026-XXXXX will be generated upon creation.</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-brand-500/20 hover:opacity-95 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Creating Student Profile...' : 'Complete Registration'}
          </button>

          <div className="pt-2 text-center text-xs text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
