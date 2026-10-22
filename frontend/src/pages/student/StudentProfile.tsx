import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import {
  User,
  GraduationCap,
  FolderKanban,
  BriefcaseBusiness,
  Award,
  Copy,
  Check,
  BadgeCheck,
  Mail,
  Phone,
  MapPin,
  Github,
  Linkedin,
  Globe,
  Save,
  Plus,
  Trash2,
  X,
  FileText,
  ExternalLink,
  Download,
  ShieldCheck,
  ArrowRight,
  Send,
  Mic,
  ClipboardCheck,
  AlertCircle,
} from 'lucide-react';

type TabKey = 'personal' | 'education' | 'projects' | 'experiences' | 'certificates';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'personal', label: 'Personal info', icon: User },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'projects', label: 'Projects', icon: FolderKanban },
  { key: 'experiences', label: 'Experiences', icon: BriefcaseBusiness },
  { key: 'certificates', label: 'Certificates', icon: Award },
];

interface ProjectForm {
  title: string;
  description: string;
  technologies: string;
  link: string;
}

interface ExperienceForm {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  description: string;
}

interface CertificationForm {
  name: string;
  issuer: string;
  issueDate: string;
  credentialId: string;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 disabled:cursor-not-allowed dark:[color-scheme:dark] transition';

const Field: React.FC<{ label: string; required?: boolean; icon?: React.ElementType; children: React.ReactNode; hint?: string }> = ({
  label,
  required,
  icon: Icon,
  children,
  hint,
}) => (
  <label className="block">
    <span className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
      {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
      {label}
      {required && <span className="text-red-500">*</span>}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
  </label>
);

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm ${className}`}>
    {children}
  </div>
);

const ProgressRing: React.FC<{ value: number; label: string; to: string; color: string }> = ({ value, label, to, color }) => {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <Link to={to} className="group flex flex-col items-center gap-2 rounded-xl p-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          <circle cx="36" cy="36" r={radius} fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-slate-800" />
          <circle
            cx="36"
            cy="36"
            r={radius}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-base font-extrabold text-slate-900 dark:text-white">
          {pct}%
        </span>
      </div>
      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-brand-600 dark:group-hover:text-brand-400">
        {label}
      </span>
    </Link>
  );
};

const EmptyState: React.FC<{ icon: React.ElementType; title: string; text: string; action?: React.ReactNode }> = ({
  icon: Icon,
  title,
  text,
  action,
}) => (
  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
    <Icon className="mx-auto mb-2 h-9 w-9 text-slate-300 dark:text-slate-600" />
    <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
    <p className="mt-0.5 text-xs text-slate-500">{text}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const addButtonClass =
  'inline-flex items-center gap-1.5 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/50 px-3 py-2 text-xs font-bold text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors';

const removeButtonClass =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors';

// Soft layered waves for the profile banner
const BannerWaves: React.FC = () => (
  <svg viewBox="0 0 1200 240" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
    <defs>
      <linearGradient id="pf-sky" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#5b8fd6" />
        <stop offset="45%" stopColor="#b9d3f2" />
        <stop offset="75%" stopColor="#d9d3f5" />
        <stop offset="100%" stopColor="#f6d9b8" />
      </linearGradient>
      <linearGradient id="pf-wave1" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#3f6fb8" stopOpacity="0.9" />
        <stop offset="60%" stopColor="#8fb3e6" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#c7b8f0" stopOpacity="0.4" />
      </linearGradient>
      <linearGradient id="pf-wave2" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#c8b8f2" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#f7b267" stopOpacity="0.85" />
      </linearGradient>
    </defs>
    <rect width="1200" height="240" fill="url(#pf-sky)" />
    <path d="M0,150 C200,90 380,210 620,140 C820,85 980,120 1200,60 L1200,240 L0,240 Z" fill="url(#pf-wave1)" />
    <path d="M500,240 C650,170 820,210 950,150 C1060,100 1130,130 1200,110 L1200,240 Z" fill="url(#pf-wave2)" />
    <path d="M0,200 C180,160 320,230 520,200 C700,175 760,230 900,240 L0,240 Z" fill="#2f5da8" fillOpacity="0.55" />
    <g fill="#ffffff" fillOpacity="0.35">
      {Array.from({ length: 18 }).map((_, i) => (
        <circle key={i} cx={380 + (i % 6) * 22} cy={70 + Math.floor(i / 6) * 22} r="2.5" />
      ))}
    </g>
  </svg>
);

export const StudentProfile: React.FC = () => {
  const { user, studentProfile, refreshUserData } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = TABS.some((t) => t.key === requestedTab) ? (requestedTab as TabKey) : 'personal';

  // Personal
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [location, setLocation] = useState('');
  const [preferredRole, setPreferredRole] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedInUrl, setLinkedInUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  // Education
  const [college, setCollege] = useState('');
  const [degree, setDegree] = useState('');
  const [branch, setBranch] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [tenthPercentage, setTenthPercentage] = useState('');
  const [twelfthPercentage, setTwelfthPercentage] = useState('');
  // Lists
  const [projects, setProjects] = useState<ProjectForm[]>([]);
  const [experiences, setExperiences] = useState<ExperienceForm[]>([]);
  const [certifications, setCertifications] = useState<CertificationForm[]>([]);

  // Linked data from other modules
  const [learningProgress, setLearningProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [resumes, setResumes] = useState<any[]>([]);
  const [earnedCertificates, setEarnedCertificates] = useState<any[]>([]);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Hydrate the form whenever the stored profile changes
  useEffect(() => {
    const p = studentProfile;
    setFullName(user?.fullName || '');
    if (!p) return;
    setGender(p.gender || '');
    setPhone(p.phone || '');
    setDateOfBirth(p.dateOfBirth || '');
    setLocation(p.location || '');
    setPreferredRole(p.preferredRole || '');
    setPreferredLocation(p.preferredLocation || '');
    setGithubUrl(p.githubUrl || '');
    setLinkedInUrl(p.linkedInUrl || '');
    setPortfolioUrl(p.portfolioUrl || '');
    setSkills(p.skills || []);
    setCollege(p.college || '');
    setDegree(p.degree || '');
    setBranch(p.branch || '');
    setGraduationYear(p.graduationYear ? String(p.graduationYear) : '');
    setCgpa(p.cgpa !== undefined && p.cgpa !== null ? String(p.cgpa) : '');
    setTenthPercentage(p.tenthPercentage !== undefined ? String(p.tenthPercentage) : '');
    setTwelfthPercentage(p.twelfthPercentage !== undefined ? String(p.twelfthPercentage) : '');
    setProjects(
      (p.projects || []).map((pr) => ({
        title: pr.title || '',
        description: pr.description || '',
        technologies: (pr.technologies || []).join(', '),
        link: pr.link || '',
      }))
    );
    setExperiences(
      (p.experiences || []).map((ex) => ({
        company: ex.company || '',
        role: ex.role || '',
        startDate: ex.startDate || '',
        endDate: ex.endDate || '',
        currentlyWorking: Boolean(ex.currentlyWorking),
        description: ex.description || '',
      }))
    );
    setCertifications(
      (p.certifications || []).map((c) => ({
        name: c.name || '',
        issuer: c.issuer || '',
        issueDate: c.issueDate || '',
        credentialId: c.credentialId || '',
      }))
    );
  }, [studentProfile, user?.fullName]);

  useEffect(() => {
    Promise.allSettled([
      api.get('/students/dashboard'),
      api.get('/exams/results/me'),
      api.get('/resumes'),
      api.get('/certificates/me'),
    ]).then(([dash, res, resm, certs]) => {
      if (dash.status === 'fulfilled') setLearningProgress((dash.value as any)?.data?.metrics?.learningProgressPct || 0);
      if (res.status === 'fulfilled') setResults((res.value as any)?.data?.results || []);
      if (resm.status === 'fulfilled') setResumes((resm.value as any)?.data?.resumes || []);
      if (certs.status === 'fulfilled') setEarnedCertificates((certs.value as any)?.data?.certificates || []);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const examAverage = useMemo(() => {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length;
  }, [results]);
  const latestResult = results[0];

  const completion = useMemo(() => {
    const checks = [
      fullName,
      phone,
      gender,
      dateOfBirth,
      location,
      college,
      degree,
      branch,
      cgpa,
      skills.length > 0,
      projects.length > 0,
      githubUrl || linkedInUrl,
      resumes.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [fullName, phone, gender, dateOfBirth, location, college, degree, branch, cgpa, skills, projects, githubUrl, linkedInUrl, resumes]);

  const setTab = (tab: TabKey) => setSearchParams(tab === 'personal' ? {} : { tab }, { replace: true });

  const copyStudentId = async () => {
    if (!studentProfile?.studentId) return;
    try {
      await navigator.clipboard.writeText(studentProfile.studentId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — nothing else to do
    }
  };

  const addSkill = () => {
    const parts = skillInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setSkills((prev) => Array.from(new Set([...prev, ...parts])));
    setSkillInput('');
  };

  const toNumber = (v: string) => (v.trim() === '' ? undefined : Number(v));

  const handleSave = async () => {
    if (!fullName.trim()) {
      setTab('personal');
      setToast({ type: 'error', text: 'Name is required.' });
      return;
    }
    if (!phone.trim()) {
      setTab('personal');
      setToast({ type: 'error', text: 'Mobile number is required.' });
      return;
    }

    setSaving(true);
    try {
      await api.put('/students/me', {
        fullName: fullName.trim(),
        gender,
        phone: phone.trim(),
        dateOfBirth,
        location,
        preferredRole,
        preferredLocation,
        githubUrl,
        linkedInUrl,
        portfolioUrl,
        skills,
        college,
        degree,
        branch,
        graduationYear: toNumber(graduationYear),
        cgpa: toNumber(cgpa),
        tenthPercentage: toNumber(tenthPercentage),
        twelfthPercentage: toNumber(twelfthPercentage),
        projects: projects
          .filter((p) => p.title.trim())
          .map((p) => ({
            title: p.title.trim(),
            description: p.description.trim(),
            technologies: p.technologies.split(',').map((t) => t.trim()).filter(Boolean),
            link: p.link.trim(),
          })),
        experiences: experiences
          .filter((e) => e.company.trim() || e.role.trim())
          .map((e) => ({ ...e, endDate: e.currentlyWorking ? '' : e.endDate })),
        certifications: certifications.filter((c) => c.name.trim()),
      });
      await refreshUserData();
      setToast({ type: 'success', text: 'Profile saved successfully.' });
    } catch (err: any) {
      setToast({ type: 'error', text: err?.message || 'Could not save your profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const updateAt = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, patch: Partial<T>) =>
    setter((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const removeAt = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number) =>
    setter((prev) => prev.filter((_, i) => i !== index));

  const displayName = fullName || user?.fullName || 'Student';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const isActive = (studentProfile as any)?.accountStatus !== 'INACTIVE' && (studentProfile as any)?.accountStatus !== 'SUSPENDED';

  const saveBar = (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800 pt-5">
      <span className="text-[11px] text-slate-400">Changes are shared with LMS, Exams, Resume Builder and Placement Portal.</span>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-600/20 hover:bg-brand-700 disabled:opacity-60 transition-colors"
      >
        <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Profile</h1>

      {/* Banner + identity */}
      <Card className="overflow-hidden">
        <div className="relative h-40 sm:h-52">
          <BannerWaves />
          <button
            type="button"
            onClick={copyStudentId}
            title="Copy Student ID"
            className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/85 dark:bg-slate-900/80 px-4 py-2 text-xs shadow-md backdrop-blur hover:bg-white dark:hover:bg-slate-900 transition-colors"
          >
            <span className="font-semibold uppercase tracking-wider text-slate-500">Student ID</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">{studentProfile?.studentId || '—'}</span>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          <h2 className="absolute bottom-4 left-36 right-4 hidden truncate text-2xl font-extrabold text-white drop-shadow-[0_2px_6px_rgba(15,23,42,0.45)] sm:left-48 sm:block sm:text-3xl">
            {displayName}
          </h2>
        </div>

        <div className="relative flex flex-col gap-4 px-5 pb-2 sm:flex-row sm:items-end sm:px-8">
          <div className="-mt-14 shrink-0 sm:-mt-20">
            <div className="relative h-28 w-28 sm:h-36 sm:w-36">
              <div className="h-full w-full rounded-full bg-gradient-to-br from-emerald-400 to-brand-500 p-1 shadow-xl">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover ring-4 ring-white dark:ring-slate-900" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-3xl font-black text-slate-600 dark:text-slate-200 ring-4 ring-white dark:ring-slate-900">
                    {initials || 'S'}
                  </div>
                )}
              </div>
              {isActive && (
                <span title="Verified student" className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900">
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 sm:hidden">
            <h2 className="truncate text-xl font-extrabold text-slate-900 dark:text-white">{displayName}</h2>
          </div>

          {/* Tabs */}
          <nav className="-mx-5 flex flex-1 gap-1 overflow-x-auto px-5 sm:mx-0 sm:justify-end sm:px-0" aria-label="Profile sections">
            {TABS.map(({ key, label, icon: Icon }) => {
              const active = key === activeTab;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`relative flex shrink-0 items-center gap-2 px-3 py-3.5 text-sm font-semibold transition-colors ${
                    active ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-brand-500' : ''}`} />
                  {label}
                  <span
                    className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-500 transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}
                  />
                </button>
              );
            })}
          </nav>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left summary column */}
        <aside className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isActive ? 'bg-emerald-50 dark:bg-emerald-950/50' : 'bg-amber-50 dark:bg-amber-950/50'}`}>
                {isActive ? <BadgeCheck className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5 text-amber-500" />}
              </span>
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  Account
                  <span className={`text-xs font-bold ${isActive ? 'text-emerald-500' : 'text-amber-500'}`}>{isActive ? 'Verified' : 'Pending'}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {isActive ? 'Your student identity is verified by the ScholarLogic team.' : 'Your account is awaiting verification.'}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Profile completion</span>
                <span className="font-bold text-slate-900 dark:text-white">{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-[width] duration-700"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <ProgressRing value={learningProgress} label="Course progress" to="/student/courses" color="#0c8ee9" />
              <ProgressRing
                value={examAverage}
                label="Exam average"
                to={latestResult ? `/student/results/${latestResult._id}` : '/student/exams'}
                color="#10b981"
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Resumes</h4>
              <span className="text-xs font-semibold text-slate-400">{resumes.length}</span>
            </div>
            {resumes.length === 0 ? (
              <p className="text-xs text-slate-500">No resumes yet.</p>
            ) : (
              <ul className="space-y-2">
                {resumes.slice(0, 4).map((r) => (
                  <li key={r._id}>
                    <Link
                      to="/student/resume"
                      className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 p-2.5 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-brand-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{r.title}</span>
                        <span className="block truncate text-[10px] text-slate-400">
                          {r.versionName}
                          {r.isDefault ? ' • Default' : ''}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/student/resume" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">
              Open Resume Builder <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>

          <Card className="p-2">
            {[
              { to: '/student/exams', label: 'Exams & Quizzes', icon: ClipboardCheck },
              { to: '/student/applications', label: 'My Applications', icon: Send },
              { to: '/student/certificates', label: 'Certificates', icon: Award },
              { to: '/student/mock-interview', label: 'AI Mock Interview', icon: Mic },
            ].map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <Icon className="h-4 w-4 text-slate-400" />
                <span className="flex-1">{label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
              </Link>
            ))}
          </Card>
        </aside>

        {/* Tab content */}
        <Card className="p-5 sm:p-7 lg:col-span-2">
          {activeTab === 'personal' && (
            <>
              <SectionHeader title="About you" subtitle="Basic details used across your applications and resume." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name" required icon={User}>
                  <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
                </Field>
                <Field label="Gender">
                  <select className={inputClass} value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </Field>
                <Field label="Email" required icon={Mail} hint="Your login email can't be changed here.">
                  <input className={inputClass} value={user?.email || ''} disabled />
                </Field>
                <Field label="Mobile" required icon={Phone}>
                  <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
                </Field>
                <Field label="Date of birth">
                  <input type="date" className={inputClass} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                </Field>
                <Field label="Location" icon={MapPin}>
                  <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, State" />
                </Field>
              </div>

              <h4 className="mb-3 mt-8 text-sm font-bold text-slate-900 dark:text-white">Career preferences</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Preferred role">
                  <input className={inputClass} value={preferredRole} onChange={(e) => setPreferredRole(e.target.value)} placeholder="e.g. Full Stack Developer" />
                </Field>
                <Field label="Preferred location">
                  <input className={inputClass} value={preferredLocation} onChange={(e) => setPreferredLocation(e.target.value)} placeholder="e.g. Bangalore / Remote" />
                </Field>
              </div>

              <h4 className="mb-3 mt-8 text-sm font-bold text-slate-900 dark:text-white">Skills</h4>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/50 py-1 pl-3 pr-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                      aria-label={`Remove ${skill}`}
                      className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {skills.length === 0 && <span className="text-xs text-slate-400">No skills added yet.</span>}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className={inputClass}
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Type a skill and press Enter (e.g. Python, React)"
                />
                <button type="button" onClick={addSkill} className={addButtonClass}>
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>

              <h4 className="mb-3 mt-8 text-sm font-bold text-slate-900 dark:text-white">Online presence</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="GitHub" icon={Github}>
                  <input className={inputClass} value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="github.com/username" />
                </Field>
                <Field label="LinkedIn" icon={Linkedin}>
                  <input className={inputClass} value={linkedInUrl} onChange={(e) => setLinkedInUrl(e.target.value)} placeholder="linkedin.com/in/username" />
                </Field>
                <Field label="Portfolio" icon={Globe}>
                  <input className={inputClass} value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="yourname.dev" />
                </Field>
              </div>
              {saveBar}
            </>
          )}

          {activeTab === 'education' && (
            <>
              <SectionHeader title="Education" subtitle="Used to check eligibility for placement drives." />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="College / Institute">
                    <input className={inputClass} value={college} onChange={(e) => setCollege(e.target.value)} placeholder="Your college name" />
                  </Field>
                </div>
                <Field label="Degree">
                  <input className={inputClass} value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="e.g. B.Tech" />
                </Field>
                <Field label="Branch / Specialization">
                  <input className={inputClass} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="e.g. Information Technology" />
                </Field>
                <Field label="Graduation year">
                  <input type="number" className={inputClass} value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} placeholder="2026" />
                </Field>
                <Field label="CGPA">
                  <input type="number" step="0.01" min="0" max="10" className={inputClass} value={cgpa} onChange={(e) => setCgpa(e.target.value)} placeholder="8.5" />
                </Field>
                <Field label="10th percentage">
                  <input type="number" step="0.1" min="0" max="100" className={inputClass} value={tenthPercentage} onChange={(e) => setTenthPercentage(e.target.value)} />
                </Field>
                <Field label="12th / Diploma percentage">
                  <input type="number" step="0.1" min="0" max="100" className={inputClass} value={twelfthPercentage} onChange={(e) => setTwelfthPercentage(e.target.value)} />
                </Field>
              </div>
              {saveBar}
            </>
          )}

          {activeTab === 'projects' && (
            <>
              <SectionHeader
                title="Projects"
                subtitle="Showcase what you've built. Projects appear on your resume."
                action={
                  <button
                    type="button"
                    className={addButtonClass}
                    onClick={() => setProjects((prev) => [...prev, { title: '', description: '', technologies: '', link: '' }])}
                  >
                    <Plus className="h-4 w-4" /> Add project
                  </button>
                }
              />
              {projects.length === 0 ? (
                <EmptyState icon={FolderKanban} title="No projects yet" text="Add your first project to strengthen your profile." />
              ) : (
                <div className="space-y-4">
                  {projects.map((p, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Project {i + 1}</span>
                        <button type="button" className={removeButtonClass} onClick={() => removeAt(setProjects, i)}>
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Title" required>
                          <input className={inputClass} value={p.title} onChange={(e) => updateAt(setProjects, i, { title: e.target.value })} />
                        </Field>
                        <Field label="Link" icon={ExternalLink}>
                          <input className={inputClass} value={p.link} onChange={(e) => updateAt(setProjects, i, { link: e.target.value })} placeholder="github.com/you/project" />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Technologies" hint="Separate with commas">
                            <input className={inputClass} value={p.technologies} onChange={(e) => updateAt(setProjects, i, { technologies: e.target.value })} placeholder="React, Node.js, MongoDB" />
                          </Field>
                        </div>
                        <div className="sm:col-span-2">
                          <Field label="Description">
                            <textarea rows={3} className={inputClass} value={p.description} onChange={(e) => updateAt(setProjects, i, { description: e.target.value })} />
                          </Field>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {saveBar}
            </>
          )}

          {activeTab === 'experiences' && (
            <>
              <SectionHeader
                title="Experiences"
                subtitle="Internships, jobs and freelance work."
                action={
                  <button
                    type="button"
                    className={addButtonClass}
                    onClick={() =>
                      setExperiences((prev) => [
                        ...prev,
                        { company: '', role: '', startDate: '', endDate: '', currentlyWorking: false, description: '' },
                      ])
                    }
                  >
                    <Plus className="h-4 w-4" /> Add experience
                  </button>
                }
              />
              {experiences.length === 0 ? (
                <EmptyState icon={BriefcaseBusiness} title="No experience added" text="Add internships or work experience — freshers can skip this." />
              ) : (
                <div className="space-y-4">
                  {experiences.map((ex, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Experience {i + 1}</span>
                        <button type="button" className={removeButtonClass} onClick={() => removeAt(setExperiences, i)}>
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Company" required>
                          <input className={inputClass} value={ex.company} onChange={(e) => updateAt(setExperiences, i, { company: e.target.value })} />
                        </Field>
                        <Field label="Role" required>
                          <input className={inputClass} value={ex.role} onChange={(e) => updateAt(setExperiences, i, { role: e.target.value })} placeholder="e.g. Software Intern" />
                        </Field>
                        <Field label="Start date">
                          <input type="month" className={inputClass} value={ex.startDate} onChange={(e) => updateAt(setExperiences, i, { startDate: e.target.value })} />
                        </Field>
                        <Field label="End date">
                          <input
                            type="month"
                            className={inputClass}
                            value={ex.currentlyWorking ? '' : ex.endDate}
                            disabled={ex.currentlyWorking}
                            onChange={(e) => updateAt(setExperiences, i, { endDate: e.target.value })}
                          />
                        </Field>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={ex.currentlyWorking}
                            onChange={(e) => updateAt(setExperiences, i, { currentlyWorking: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          I currently work here
                        </label>
                        <div className="sm:col-span-2">
                          <Field label="Description">
                            <textarea rows={3} className={inputClass} value={ex.description} onChange={(e) => updateAt(setExperiences, i, { description: e.target.value })} placeholder="What did you work on?" />
                          </Field>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {saveBar}
            </>
          )}

          {activeTab === 'certificates' && (
            <>
              <SectionHeader
                title="ScholarLogic certificates"
                subtitle="Issued automatically when you complete a course."
                action={
                  <Link to="/student/certificates" className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              {earnedCertificates.length === 0 ? (
                <EmptyState
                  icon={Award}
                  title="No certificates earned yet"
                  text="Complete a course to earn a verifiable certificate."
                  action={
                    <Link to="/student/courses" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">
                      Browse my courses <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {earnedCertificates.map((c) => (
                    <div key={c._id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/50">
                          <Award className="h-5 w-5 text-amber-500" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{c.courseId?.title || 'Course certificate'}</p>
                          <p className="font-mono text-[11px] text-slate-400">{c.certificateId}</p>
                          <p className="text-[11px] text-slate-500">Issued {new Date(c.issueDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Link
                          to={`/verify/${c.certificateId}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Verify
                        </Link>
                        <a
                          href={`/api/certificates/${c.certificateId}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-700"
                        >
                          <Download className="h-3.5 w-3.5" /> Download PDF
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-8">
                <SectionHeader
                  title="Other certifications"
                  subtitle="Certifications from other platforms (Coursera, AWS, NPTEL…)."
                  action={
                    <button
                      type="button"
                      className={addButtonClass}
                      onClick={() => setCertifications((prev) => [...prev, { name: '', issuer: '', issueDate: '', credentialId: '' }])}
                    >
                      <Plus className="h-4 w-4" /> Add certification
                    </button>
                  }
                />
                {certifications.length === 0 ? (
                  <p className="text-xs text-slate-500">No external certifications added.</p>
                ) : (
                  <div className="space-y-4">
                    {certifications.map((c, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Certification {i + 1}</span>
                          <button type="button" className={removeButtonClass} onClick={() => removeAt(setCertifications, i)}>
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Field label="Name" required>
                            <input className={inputClass} value={c.name} onChange={(e) => updateAt(setCertifications, i, { name: e.target.value })} />
                          </Field>
                          <Field label="Issuer">
                            <input className={inputClass} value={c.issuer} onChange={(e) => updateAt(setCertifications, i, { issuer: e.target.value })} placeholder="e.g. AWS" />
                          </Field>
                          <Field label="Issue date">
                            <input type="month" className={inputClass} value={c.issueDate} onChange={(e) => updateAt(setCertifications, i, { issueDate: e.target.value })} />
                          </Field>
                          <Field label="Credential ID">
                            <input className={inputClass} value={c.credentialId} onChange={(e) => updateAt(setCertifications, i, { credentialId: e.target.value })} />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {saveBar}
            </>
          )}
        </Card>
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl motion-safe:animate-lb-slide ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.text}
        </div>
      )}
    </div>
  );
};
