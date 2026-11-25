import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Building, CalendarClock, MapPin, Sparkles, X } from 'lucide-react';
import { api } from '../services/api';
import { LinkedInLogo, isLinkedInJob } from './JobSourceLogo';

// Student opens the site: jobs the placement team posted since they last closed this show up once.
// Closing it (or opening Jobs) marks them seen on the server, so it works on every device.
export const NewJobsPopup: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api
      .get('/placements/jobs/new-for-me')
      .then((res: any) => setJobs(res.data.jobs || []))
      .catch(() => undefined);
  }, []);

  const seen = () => {
    setJobs([]);
    api.post('/placements/jobs/seen', {}).catch(() => undefined);
  };
  const open = () => {
    seen();
    if (location.pathname !== '/student/jobs') navigate('/student/jobs');
  };

  if (!jobs.length) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-jobs-title">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="relative bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-5 text-white">
          <button type="button" onClick={seen} aria-label="Close" className="absolute right-4 top-4 rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white">
            <X className="h-5 w-5" />
          </button>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/80">
            <Sparkles className="h-4 w-4" /> Placement update
          </p>
          <h2 id="new-jobs-title" className="mt-1 text-xl font-black">
            {jobs.length === 1 ? 'New job opening for you' : `${jobs.length} new job openings for you`}
          </h2>
        </div>

        <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {jobs.map((j) => (
            <li key={j._id} className="flex items-start gap-3 px-6 py-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-950/50">
                {isLinkedInJob(j) ? <LinkedInLogo className="h-5 w-5" /> : <Briefcase className="h-4 w-4 text-brand-600" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white">{j.title}</p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Building className="h-3.5 w-3.5" /> {j.companyId?.name || 'Company'}
                  </span>
                  {j.location && j.location !== 'See job details' && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {j.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" /> Apply by {new Date(j.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </span>
                </p>
                {isLinkedInJob(j) && <span className="mt-1 inline-block text-[10px] font-bold text-[#0A66C2]">From LinkedIn</span>}
              </div>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button type="button" onClick={seen} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
            Later
          </button>
          <button type="button" onClick={open} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">
            <Briefcase className="h-4 w-4" /> View jobs
          </button>
        </div>
      </div>
    </div>
  );
};
