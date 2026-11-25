import React, { useEffect, useState } from 'react';
import { BookOpen, Briefcase, GraduationCap, Rocket, Trophy } from 'lucide-react';

// Shown while a page's code is still loading: the ScholarLogic logo with short lines about learning and jobs.
// It only appears for as long as loading really takes; nothing here slows the page down.
const STEPS = [
  { icon: GraduationCap, text: 'Preparing your learning hub…' },
  { icon: BookOpen, text: 'Getting your courses ready…' },
  { icon: Briefcase, text: 'Finding the latest job openings…' },
  { icon: Trophy, text: 'Lining up placement drives…' },
  { icon: Rocket, text: 'Connecting students to careers…' },
];

export const BrandLoader: React.FC<{ fullScreen?: boolean }> = ({ fullScreen }) => {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Very quick loads finish before the animation would flash on screen
    const show = setTimeout(() => setVisible(true), 120);
    const tick = setInterval(() => setI((n) => (n + 1) % STEPS.length), 1400);
    return () => {
      clearTimeout(show);
      clearInterval(tick);
    };
  }, []);
  const Step = STEPS[i];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-5 px-6 transition-opacity duration-300 ${fullScreen ? 'min-h-screen' : 'min-h-[55vh]'} ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span className="sl-orbit absolute inset-0 rounded-full border-2 border-dashed border-brand-300/70 dark:border-brand-700/70" />
        <span className="absolute inset-3 rounded-full bg-gradient-to-br from-brand-50 to-indigo-50 shadow-inner dark:from-brand-950/60 dark:to-indigo-950/40" />
        <span className="sl-orbit-dot absolute inset-0">
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-gradient-to-br from-brand-400 to-indigo-500 shadow-md shadow-brand-500/40" />
        </span>
        <span key={i} className="sl-pop relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-lg shadow-brand-500/30">
          <Step.icon className="h-7 w-7" />
        </span>
      </div>

      <img src="/logo.png" alt="ScholarLogic" className="h-9 w-auto dark:brightness-0 dark:invert" />

      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <span className="sl-bar block h-full w-1/3 rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-brand-600" />
      </div>

      <p key={`t${i}`} className="sl-fade text-sm font-semibold text-slate-600 dark:text-slate-300">
        {Step.text}
      </p>
    </div>
  );
};
