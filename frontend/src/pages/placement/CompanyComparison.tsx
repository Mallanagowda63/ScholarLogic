import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Columns, Building, Globe, ExternalLink, Award, Users } from 'lucide-react';

export const CompanyComparison: React.FC = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<any[]>([]);

  useEffect(() => {
    api.get('/placements/companies')
      .then((res: any) => {
        if (res.success && res.data.companies) {
          setCompanies(res.data.companies);
          if (res.data.companies.length >= 2) {
            const initialIds = [res.data.companies[0]._id, res.data.companies[1]._id];
            setSelectedIds(initialIds);
            fetchComparison(initialIds);
          }
        }
      })
      .catch(console.error);
  }, []);

  const fetchComparison = (ids: string[]) => {
    api.get(`/placements/company-comparison?ids=${ids.join(',')}`)
      .then((res: any) => {
        if (res.success) setComparison(res.data.comparison || []);
      })
      .catch(console.error);
  };

  const handleToggleCompany = (id: string) => {
    let updated: string[];
    if (selectedIds.includes(id)) {
      updated = selectedIds.filter((item) => item !== id);
    } else {
      if (selectedIds.length >= 3) return alert('You can compare a maximum of 3 companies at once.');
      updated = [...selectedIds, id];
    }
    setSelectedIds(updated);
    if (updated.length > 0) fetchComparison(updated);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Corporate Partner Comparison Matrix</h1>
          <p className="text-xs text-slate-500">Compare hiring statuses, open positions, and student applications side-by-side</p>
        </div>
      </div>

      {/* Select Companies Checklist */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-xs text-slate-500 uppercase tracking-wider">Select Up to 3 Companies to Compare</h3>
        <div className="flex flex-wrap gap-2">
          {companies.map((c) => (
            <button
              key={c._id}
              onClick={() => handleToggleCompany(c._id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                selectedIds.includes(c._id)
                  ? 'bg-brand-600 text-white border-brand-500 shadow-md'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Grid Table */}
      {comparison.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4 w-1/4">Comparison Metric</th>
                {comparison.map((comp) => (
                  <th key={comp._id} className="p-4 font-black text-slate-900 dark:text-white text-sm">
                    {comp.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr>
                <td className="p-4 font-bold text-slate-500">Hiring Status</td>
                {comparison.map((comp) => (
                  <td key={comp._id} className="p-4">
                    <Badge variant={comp.hiringStatus === 'HIRING_NOW' ? 'amber' : 'green'}>{comp.hiringStatus}</Badge>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold text-slate-500">Industry</td>
                {comparison.map((comp) => (
                  <td key={comp._id} className="p-4 font-semibold">{comp.industry}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold text-slate-500">Primary Location</td>
                {comparison.map((comp) => (
                  <td key={comp._id} className="p-4 font-semibold">{comp.location}</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold text-slate-500">Verified Open Roles</td>
                {comparison.map((comp) => (
                  <td key={comp._id} className="p-4 font-black text-brand-600">{comp.openRoles} Positions</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold text-slate-500">ScholarLogic Applications</td>
                {comparison.map((comp) => (
                  <td key={comp._id} className="p-4 font-black text-purple-600">{comp.scholarlogicApplications} Candidates</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold text-slate-500">Offers Issued</td>
                {comparison.map((comp) => (
                  <td key={comp._id} className="p-4 font-black text-emerald-600">{comp.offersIssued} Accepted Offers</td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-bold text-slate-500">Official Careers Page</td>
                {comparison.map((comp) => (
                  <td key={comp._id} className="p-4">
                    <a
                      href={comp.officialCareersUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:underline font-mono text-[11px] inline-flex items-center gap-1"
                    >
                      Visit Careers Portal <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
