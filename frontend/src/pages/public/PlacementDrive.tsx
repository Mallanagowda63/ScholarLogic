import React from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Sparkles,
  ArrowRight,
  Users,
  TrendingUp,
  Building2,
  Award,
  FileCheck,
  Handshake,
  Code2,
  Cloud,
  BarChart3,
  Megaphone,
  Server,
} from 'lucide-react';

const stats = [
  { label: 'Students Placed', value: '2,500+', icon: Users },
  { label: 'Hiring Partners', value: '120+', icon: Building2 },
  { label: 'Placement Rate', value: '94%', icon: TrendingUp },
  { label: 'Avg. Package Hike', value: '38%', icon: Award },
];

const steps = [
  { icon: FileCheck, title: 'Build Your Profile', description: 'Complete your ScholarLogic Student ID with verified certificates, skills, and project history.' },
  { icon: Sparkles, title: 'AI Resume Match', description: 'Our AI scores your resume against live job descriptions and flags missing keywords.' },
  { icon: Briefcase, title: 'Apply to Verified Roles', description: 'One-click apply to roles from vetted hiring partners with real-time eligibility checks.' },
  { icon: Handshake, title: 'Interview & Offer', description: 'Track interview stages and receive verified, digitally signed offer letters.' },
];

const industries = [
  { icon: Code2, label: 'Software & Product Engineering' },
  { icon: Cloud, label: 'Cloud & DevOps' },
  { icon: BarChart3, label: 'Data & Analytics' },
  { icon: Server, label: 'IT Services & Consulting' },
  { icon: Megaphone, label: 'Digital Marketing' },
  { icon: Building2, label: 'Startups & Enterprises' },
];

export const PlacementDrive: React.FC = () => {
  return (
    <div className="space-y-20 py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-8 sm:p-16 text-white shadow-2xl ring-1 ring-white/10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold">
            <Briefcase className="h-3.5 w-3.5" /> Placement Drive
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            From Classroom to <br />
            <span className="bg-gradient-to-r from-brand-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              Career Offer
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light max-w-2xl">
            Every course, certificate, and project you complete on ScholarLogic feeds directly into your placement
            profile — matched against live openings from our hiring partners with AI-driven skill scoring.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:-translate-y-0.5 transition-all"
            >
              Get Placement Ready <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              Sign In to View Open Roles
            </Link>
          </div>
        </div>

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

      {/* How Placement Works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            The Process
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            How the Placement Drive Works
          </h2>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
          {steps.map((step, i) => (
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

      {/* Industries Hiring */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Where You'll Land
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Industries Actively Hiring ScholarLogic Graduates
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {industries.map((ind) => (
            <div
              key={ind.label}
              className="flex h-[148px] flex-col items-center justify-center text-center gap-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="h-10 w-10 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <ind.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight">{ind.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-indigo-700 p-8 sm:p-12 text-center text-white shadow-2xl">
          <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <h2 className="relative z-10 text-2xl sm:text-3xl font-extrabold">
            Ready to enter this placement cycle?
          </h2>
          <p className="relative z-10 mt-3 text-sm text-brand-100 max-w-xl mx-auto">
            Register your ScholarLogic Student ID today and start matching with verified hiring partners.
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
              Browse Courses First
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
