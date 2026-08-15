import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Sparkles, Award, Briefcase, CheckCircle2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export const Home: React.FC = () => {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-brand-950 p-8 sm:p-16 text-white shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" /> Empowering Next-Gen Software Engineers
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            ScholarLogic <br />
            <span className="bg-gradient-to-r from-brand-400 to-indigo-300 bg-clip-text text-transparent">
              Career & Learning Hub
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-light">
            One unified platform connecting your complete student journey: Centralized Student ID, interactive LMS learning, online assessment certification, AI resume engineering, and direct enterprise placement matching.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/30 hover:opacity-95 transition-opacity"
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
        </div>

        {/* Decorative Grid */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
      </section>

      {/* Feature Highlights Grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Everything Connected Under One Student Identity
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            No isolated modules. All course progress, exam scores, AI ATS resumes, and placement applications link directly to your central ScholarLogic Student ID.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center mb-4">
              <BookOpen className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Central LMS & Videos</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Watch video lessons with progress tracking, read notes, submit assignments, and take topic quizzes.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-4">
              <Award className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Online Exam Engine</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Timers, progress auto-saving, negative marking, server-side grading, and topic skill analytics.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center mb-4">
              <Sparkles className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">AI Resume ATS Builder</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Upload resumes, match with Job Descriptions, get ATS scores, missing keywords, and export PDF.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mb-4">
              <Briefcase className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Placement Portal</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Dynamic skill-matching %, one-click application, interview tracking, and verified offer letters.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

function BookOpen(props: any) {
  return <GraduationCap {...props} />;
}
