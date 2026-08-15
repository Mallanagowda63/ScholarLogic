import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ShieldCheck, User, Save, Building, Award, Code, Globe } from 'lucide-react';

export const StudentProfile: React.FC = () => {
  const { studentProfile, refreshUserData } = useAuth();

  const [phone, setPhone] = useState(studentProfile?.phone || '');
  const [college, setCollege] = useState(studentProfile?.college || '');
  const [degree, setDegree] = useState(studentProfile?.degree || '');
  const [branch, setBranch] = useState(studentProfile?.branch || '');
  const [cgpa, setCgpa] = useState(studentProfile?.cgpa || 8.8);
  const [skills, setSkills] = useState(studentProfile?.skills ? studentProfile.skills.join(', ') : 'Python, SQL, React');
  const [githubUrl, setGithubUrl] = useState(studentProfile?.githubUrl || '');
  const [linkedInUrl, setLinkedInUrl] = useState(studentProfile?.linkedInUrl || '');
  const [preferredRole, setPreferredRole] = useState(studentProfile?.preferredRole || 'Python Full Stack Developer');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');

    try {
      await api.put('/students/me', {
        phone,
        college,
        degree,
        branch,
        cgpa: Number(cgpa),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        githubUrl,
        linkedInUrl,
        preferredRole,
      });

      await refreshUserData();
      setSuccess('Student profile updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Central Student Profile</h1>
        <p className="text-xs text-slate-500">Shared student record across LMS, Online Exams, AI Resume Engine, and Placement Portal</p>
      </div>

      {/* Identity Card Header */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-indigo-950 p-6 text-white shadow-xl flex items-center gap-5">
        <div className="h-16 w-16 rounded-2xl bg-brand-500 text-white flex items-center justify-center font-black text-2xl shadow-lg">
          {studentProfile?.studentId?.slice(-3) || '001'}
        </div>
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-300 uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> Permanent ScholarLogic Identity
          </span>
          <h2 className="text-xl font-bold">{studentProfile?.studentId || 'SL-2026-00001'}</h2>
          <p className="text-xs text-slate-300 font-mono">Batch: {studentProfile?.batch || 'Batch 2026'}</p>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-semibold">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6 shadow-sm">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">Academic & Personal Information</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">College / Institute</label>
            <input
              type="text"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Degree</label>
            <input
              type="text"
              value={degree}
              onChange={(e) => setDegree(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Branch / Specialization</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cumulative CGPA</label>
            <input
              type="number"
              step="0.1"
              value={cgpa}
              onChange={(e) => setCgpa(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Preferred Role</label>
            <input
              type="text"
              value={preferredRole}
              onChange={(e) => setPreferredRole(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">Technical Skills & Career Links</h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Verified Technical Skills (Comma-separated)</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Python, React, Node.js, SQL, AWS, Git"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GitHub Portfolio URL</label>
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/alexmorgan"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">LinkedIn Profile URL</label>
              <input
                type="text"
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
                placeholder="https://linkedin.com/in/alexmorgan"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-md hover:bg-brand-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Profile Changes'}
        </button>
      </form>
    </div>
  );
};
