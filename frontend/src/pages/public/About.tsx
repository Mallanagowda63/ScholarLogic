import React from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  Target,
  Layers,
  ShieldCheck,
  Lightbulb,
  Users,
  Building2,
  TrendingUp,
  BookOpen,
} from 'lucide-react';

const stats = [
  { label: 'Active Students', value: '2,500+', icon: Users },
  { label: 'Hiring Partners', value: '120+', icon: Building2 },
  { label: 'Placement Rate', value: '94%', icon: TrendingUp },
  { label: 'Courses Available', value: '350+', icon: BookOpen },
];

const values = [
  {
    icon: Target,
    title: 'Student-First',
    description: 'Every feature — from the LMS to placements — is designed around one outcome: your career success.',
  },
  {
    icon: Layers,
    title: 'One Connected Identity',
    description: 'No isolated modules. Your learning, certifications, resume, and applications share a single verified profile.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified & Transparent',
    description: 'Certificates, offer letters, and skill scores are independently verifiable — no inflated claims.',
  },
  {
    icon: Lightbulb,
    title: 'Industry-Aligned',
    description: 'Courses and assessments are built around what hiring partners are actually looking for right now.',
  },
];

export const About: React.FC = () => {
  return (
    <div className="space-y-20 py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-8 sm:p-16 text-white shadow-2xl ring-1 ring-white/10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold">
            <GraduationCap className="h-3.5 w-3.5" /> About ScholarLogic
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Built to Close the Gap Between <br />
            <span className="bg-gradient-to-r from-brand-400 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              Learning and Employment
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light max-w-2xl">
            ScholarLogic is a single platform that connects a student's entire journey — coursework, certification,
            resume building, and placement — under one verified Student ID, so progress in one area never gets lost
            or duplicated in another.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/30 hover:shadow-brand-500/50 hover:-translate-y-0.5 transition-all"
            >
              Join ScholarLogic <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/courses"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              Browse Courses
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

      {/* Mission */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-950/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Our Mission
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Every Skill You Build Should Count Toward a Job
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Too many students finish courses and exams with nothing to show a recruiter beyond a PDF certificate.
              ScholarLogic exists to fix that: course progress, exam scores, and AI-scored resumes all flow into a
              single placement-ready profile that hiring partners can trust and verify instantly.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/25">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Why ScholarLogic Is Different</h3>
            </div>
            <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                One Student ID links your LMS, exams, resume, and applications — nothing lives in a silo.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                Certificates and offer letters are digitally verifiable, not just downloadable PDFs.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-500 shrink-0" />
                AI resume scoring shows exactly which skills to close before you apply.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            What We Stand For
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">Our Values</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div className="h-11 w-11 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">{v.title}</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{v.description}</p>
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
              to="/placement"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors backdrop-blur-md"
            >
              See Placement Drive
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
