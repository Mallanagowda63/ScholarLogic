import React from 'react';
import { Badge } from '../../components/Badge';
import { FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';

export const PlacementReports: React.FC = () => {
  const reports = [
    { title: 'Company Hiring Report', desc: 'Partner companies, verified open roles, and hiring statuses', filename: 'company_hiring_report.csv' },
    { title: 'Job Postings Report', desc: 'ScholarLogic vs Official Company Job postings with eligibility criteria', filename: 'job_postings_report.csv' },
    { title: 'Student Application Report', desc: 'All candidate applications, selection rounds, and statuses', filename: 'application_report.csv' },
    { title: 'Campus Placement Summary Report', desc: 'Placement rate %, offers issued, starting CTC packages', filename: 'placement_summary_report.csv' },
    { title: 'Skill Demand Report', desc: 'Aggregated technical skill requirements across corporate partners', filename: 'skill_demand_report.csv' },
    { title: 'Geographic Hiring Report', desc: 'Location analytics and employment hubs breakdown', filename: 'geographic_hiring_report.csv' },
  ];

  const handleDownloadCsv = (filename: string, title: string) => {
    const csvContent = `data:text/csv;charset=utf-8,Report Title,Generated Date,Status\n"${title}",${new Date().toLocaleDateString()},Verified`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Placement Intelligence Reports & CSV Downloads</h1>
          <p className="text-xs text-slate-500">Export verified hiring statistics, student selection pipelines, and corporate partner performance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((r) => (
          <div key={r.title} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="blue">CSV EXPORT</Badge>
                <span className="text-[10px] text-slate-400 font-mono">Updated Today</span>
              </div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" /> {r.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">{r.desc}</p>
            </div>

            <button
              onClick={() => handleDownloadCsv(r.filename, r.title)}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-colors shadow-md flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" /> Download CSV Report
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
