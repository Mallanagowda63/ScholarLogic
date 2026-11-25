import React, { useState } from 'react';
import { ExternalLink, Handshake, Loader2 } from 'lucide-react';

// Admin → CRM: the separate ScholarLogic CRM app (leads, follow-ups, admissions, fees), shown inside the admin
// portal. It has its own sign-in. Served at scholarlogiclms.in/crm (VITE_CRM_URL can change it).
const CRM_URL = (import.meta.env.VITE_CRM_URL as string | undefined)?.trim() || '/crm/';

export const AdminCrm: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white">
            <Handshake className="h-5 w-5 text-brand-600" /> CRM
          </h1>
          <p className="text-xs text-slate-500">Enquiries, follow-ups, demo classes, admissions and fees. Sign in with your CRM account.</p>
        </div>
        <a
          href={CRM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <ExternalLink className="h-4 w-4" /> Open in new tab
        </a>
      </div>
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" /> Opening the CRM…
            <span className="text-xs">If it does not open, use “Open in new tab”.</span>
          </div>
        )}
        <iframe title="ScholarLogic CRM" src={CRM_URL} className="h-full w-full" onLoad={() => setLoaded(true)} />
      </div>
    </div>
  );
};
