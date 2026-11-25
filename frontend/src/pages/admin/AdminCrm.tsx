import React from 'react';
import { ExternalLink, Handshake } from 'lucide-react';

// Admin → CRM: the separate ScholarLogic CRM app opens in its own browser tab (scholarlogiclms.in/crm).
// This page only shows if someone goes to /admin/crm directly.
const CRM_URL = (import.meta.env.VITE_CRM_URL as string | undefined)?.trim() || '/crm';

export const AdminCrm: React.FC = () => (
  <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
    <Handshake className="mx-auto h-10 w-10 text-brand-600" />
    <h1 className="mt-3 text-xl font-extrabold text-slate-900 dark:text-white">CRM</h1>
    <p className="mt-1 text-sm text-slate-500">Enquiries, follow-ups, admissions and fees. The CRM opens in its own tab.</p>
    <a
      href={CRM_URL}
      target="_blank"
      rel="noopener"
      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
    >
      <ExternalLink className="h-4 w-4" /> Open CRM
    </a>
  </div>
);
