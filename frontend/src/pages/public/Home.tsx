import React from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Sparkles,
  Award,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Users,
  TrendingUp,
  Building2,
} from 'lucide-react';

const stats = [
  { label: 'Active Students', value: '2,500+', icon: Users },
  { label: 'Hiring Partners', value: '120+', icon: Building2 },
  { label: 'Placement Rate', value: '94%', icon: TrendingUp },
  { label: 'Courses Available', value: '350+', icon: BookOpen },
];

const features = [
  {
    icon: BookOpen,
    accent: 'from-brand-500 to-sky-400',
    iconBg: 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400',
    title: 'Central LMS & Videos',
    description:
      'Watch video lessons with progress tracking, read notes, submit assignments, and take topic quizzes.',
    points: ['Progress-tracked video lessons', 'Assignments & topic quizzes'],
  },
  {
    icon: Award,
    accent: 'from-emerald-500 to-teal-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400',
    title: 'Online Exam Engine',
    description:
      'Timers, progress auto-saving, negative marking, server-side grading, and topic skill analytics.',
    points: ['Auto-saving timed exams', 'Skill-level analytics'],
  },
  {
    icon: Sparkles,
    accent: 'from-purple-500 to-fuchsia-400',
    iconBg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400',
    title: 'AI Resume ATS Builder',
    description:
      'Upload resumes, match with job descriptions, get ATS scores, missing keywords, and export PDF.',
    points: ['ATS scoring against JDs', 'One-click PDF export'],
  },
  {
    icon: Briefcase,
    accent: 'from-amber-500 to-orange-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400',
    title: 'Placement Portal',
    description:
      'Dynamic skill-matching %, one-click application, interview tracking, and verified offer letters.',
    points: ['Skill-match scoring', 'Verified digital offer letters'],
  },
];

const journey = [
  { icon: GraduationCap, title: 'Get Your Student ID', description: 'Register once and receive a verified ScholarLogic Student ID linked to every module.' },
  { icon: BookOpen, title: 'Learn on the LMS', description: 'Progress through video lessons, assignments, and quizzes at your own pace.' },
  { icon: Award, title: 'Certify Your Skills', description: 'Sit proctored exams and earn verifiable certificates recognized by hiring partners.' },
  { icon: Briefcase, title: 'Get Placed', description: 'Match with roles via AI resume scoring and apply directly through the placement portal.' },
];

export const Home: React.FC = () => {
  return (
    <div className="space-y-20 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-8 sm:p-16 text-white shadow-2xl ring-1 ring-white/10">
        {/* Decorative glow orbs */}
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> Empowering Next-Gen Software Engineers
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            ScholarLogic <br />
            <span className="bg-gradient-to-r from-brand-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              Career & Learning Hub
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light max-w-2xl">
            One unified platform connecting your complete student journey: centralized Student ID, interactive
            LMS learning, online assessment certification, AI resume engineering, and direct enterprise placement
            matching.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:-translate-y-0.5 transition-all"
            >
              Get Your ScholarLogic ID <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              Student & Admin Sign In
            </Link>
          </div>

          <div className="flex items-center gap-2 pt-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Verified certificates trusted by 120+ hiring partners
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative z-10 mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4 border-t border-white/10 pt-8">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-300">
                <stat.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl sm:text-2xl font-extrabold text-white leading-none">{stat.value}</p>
                <p className="mt-1 text-[11px] sm:text-xs font-medium text-slate-400">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Platform
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Everything Connected Under One Student Identity
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            No isolated modules. All course progress, exam scores, AI ATS resumes, and placement applications
            link directly to your central ScholarLogic Student ID.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${feature.accent}`} />

              <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-4 ${feature.iconBg}`}>
                <feature.icon className="h-5 w-5" />
              </div>

              <h3 className="font-bold text-base text-slate-900 dark:text-white">{feature.title}</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {feature.description}
              </p>

              <ul className="mt-4 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-4">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            The Journey
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            From Enrollment to Employment
          </h2>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
          {journey.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center gap-2">
              <span className="block h-4 text-[10px] font-black tracking-widest text-brand-500 dark:text-brand-400">
                STEP {String(i + 1).padStart(2, '0')}
              </span>
              <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-500/25">
                <step.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white pt-1">{step.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[220px]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-indigo-700 p-8 sm:p-12 text-center text-white shadow-2xl">
          <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <h2 className="relative z-10 text-2xl sm:text-3xl font-extrabold">
            Ready to build your career with ScholarLogic?
          </h2>
          <p className="relative z-10 mt-3 text-sm text-brand-100 max-w-xl mx-auto">
            Join thousands of students learning, certifying, and getting placed through one connected platform.
          </p>
          <div className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-lg hover:-translate-y-0.5 transition-transform"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              Browse Courses
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
