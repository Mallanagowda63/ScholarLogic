import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Application } from '../../types';
import { Badge } from '../../components/Badge';
import { Building, Calendar, Award, CheckCircle2, Clock, FileText, Send, Eye, X, Video, ShieldCheck, Briefcase, AlertTriangle, RefreshCw, MapPin, DollarSign } from 'lucide-react';

export const StudentApplications: React.FC = () => {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApp, setSelectedApp] = useState<any | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = () => {
    setLoading(true);
    setError('');

    api.get('/placements/applications')
      .then((res: any) => {
        const apps = res.data?.applications || res.applications || (Array.isArray(res.data) ? res.data : []);
        setApplications(Array.isArray(apps) ? apps : []);
      })
      .catch((err: any) => {
        console.error('Failed to fetch applications:', err);
        setError(err.message || 'Unable to load applications from server.');
      })
      .finally(() => setLoading(false));
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'OFFERED':
      case 'JOINED':
      case 'SELECTED':
        return 'green';
      case 'SHORTLISTED':
      case 'TECH_INTERVIEW':
      case 'HR_INTERVIEW':
        return 'blue';
      case 'ASSESSMENT':
        return 'purple';
      case 'REJECTED':
        return 'red';
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">My Placement Applications</h1>
        <p className="text-xs text-slate-500">Track shortlisting status, interview schedules, and offer letters in real-time</p>
      </div>

      {/* 1. LOADING STATE */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="text-xs font-bold text-slate-500">Loading your applications...</p>
        </div>
      ) : error ? (
        /* 2. ERROR STATE (Requirements 8 & 9) */
        <div className="p-10 text-center rounded-3xl border border-dashed border-red-200 bg-red-50/50 dark:bg-red-950/40 text-red-600 space-y-3">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Unable to load applications</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchApplications}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : applications.length === 0 ? (
        /* 3. EMPTY STATE (Requirements 9 & 22) */
        <div className="p-12 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500 space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center mx-auto">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">No Job Applications Submitted Yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">Browse active verified hiring drives in the Placement Portal and click <strong>Apply Now</strong> to submit your application.</p>
          </div>
          <Link
            to="/student/jobs"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-extrabold shadow-md hover:bg-brand-700 transition-colors"
          >
            Browse Placement Drives →
          </Link>
        </div>
      ) : (
        /* 4. SUCCESS APPLICATION LIST */
        <div className="space-y-6">
          {applications.map((app: any) => {
            const job = app.jobId || app.job || {};
            const company = job?.companyId || app.companyId || app.company || {};
            const appIdFormatted = app.applicationId || `SL-APP-${app._id?.toString().slice(-6).toUpperCase()}`;

            return (
              <div
                key={app._id}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6 hover:border-brand-500/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded-md bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 text-[10px] font-bold font-mono border border-brand-200 dark:border-brand-800">
                        App ID: {appIdFormatted}
                      </span>
                      {app.matchScore && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                          Match: {app.matchScore}%
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{job?.title || 'Position'}</h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5 text-brand-500" /> {company?.name || 'Partner Company'}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {job?.location || 'Bangalore'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusVariant(app.status)}>{app.status}</Badge>
                    <button
                      onClick={() => setSelectedApp(app)}
                      className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 flex items-center gap-1.5 shadow-sm"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Application
                    </button>
                  </div>
                </div>

                {/* Status Timeline Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>Round: {app.placementRound || 'Initial Application'}</span>
                    <span>Applied: {new Date(app.appliedAt || app.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {['APPLIED', 'SHORTLISTED', 'ASSESSMENT', 'TECH_INTERVIEW', 'OFFERED'].map((step) => {
                      const stepsOrder = ['APPLIED', 'SHORTLISTED', 'ASSESSMENT', 'TECH_INTERVIEW', 'HR_INTERVIEW', 'SELECTED', 'OFFERED', 'JOINED'];
                      const currentIdx = stepsOrder.indexOf(app.status);
                      const stepIdx = stepsOrder.indexOf(step);
                      const isCompleted = stepIdx <= currentIdx && app.status !== 'REJECTED';

                      return (
                        <div key={step} className="space-y-1 text-center">
                          <div className={`h-2 rounded-full ${isCompleted ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                          <span className="text-[10px] font-semibold block truncate text-slate-400">{step}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Offer Letter Box if offered */}
                {(app.status === 'OFFERED' || app.status === 'JOINED') && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-xs text-emerald-900 dark:text-emerald-200">🎉 Official Offer Letter Issued</h4>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">Annual Compensation Package: {job?.salaryPackage || '14.5 LPA'}</p>
                    </div>
                    <a
                      href="https://scholarlogic.edu/offers/sample-offer.pdf"
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md hover:bg-emerald-700 transition-colors"
                    >
                      Download Offer Letter PDF
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW APPLICATION DETAIL MODAL (Requirement 11) */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-brand-600 font-mono tracking-wider">
                  Application Details • {selectedApp.applicationId || `SL-APP-${selectedApp._id?.toString().slice(-6).toUpperCase()}`}
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                  {(selectedApp.jobId || selectedApp.job)?.title || 'Position'}
                </h2>
                <p className="text-xs text-slate-500">
                  {(selectedApp.companyId || selectedApp.company || selectedApp.jobId?.companyId)?.name} • Applied {new Date(selectedApp.appliedAt || selectedApp.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() => setSelectedApp(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">Current Status</span>
                  <Badge variant={getStatusVariant(selectedApp.status)}>{selectedApp.status}</Badge>
                </div>
                <p className="text-[11px] text-slate-500">Current Round: <strong className="text-slate-900 dark:text-white">{selectedApp.placementRound || 'Initial Application'}</strong></p>
              </div>

              {/* Submitted Resume & Certs */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white">Submitted Resume & Certificates</h4>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div>Resume: <strong className="text-brand-600">{selectedApp.resumeId?.title || 'Primary ATS Resume'}</strong></div>
                  <div>Attached Certifications: <strong className="text-slate-900 dark:text-white">{(selectedApp.selectedCertificates?.length ? selectedApp.selectedCertificates : ['ScholarLogic Certified Full Stack Professional']).join(', ')}</strong></div>
                </div>
              </div>

              {/* Cover Letter */}
              {selectedApp.coverLetter && (
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-white">Submitted Cover Letter</h4>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                    {selectedApp.coverLetter}
                  </div>
                </div>
              )}

              {/* Submitted Q&A */}
              {selectedApp.answers && selectedApp.answers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 dark:text-white">Role Questionnaire Answers</h4>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                    {selectedApp.answers.map((ans: any, idx: number) => (
                      <div key={idx}>
                        <span className="text-slate-400 block font-semibold">{ans.question}</span>
                        <span className="text-slate-900 dark:text-white font-bold">{ans.answer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scheduled Interview Details if Shortlisted */}
              {(selectedApp.status === 'SHORTLISTED' || selectedApp.status === 'TECH_INTERVIEW' || selectedApp.status === 'HR_INTERVIEW') && (
                <div className="p-4 rounded-2xl bg-brand-50/70 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900 space-y-2">
                  <h4 className="font-extrabold text-xs text-brand-900 dark:text-brand-200 flex items-center gap-1.5">
                    <Video className="h-4 w-4 text-brand-600" /> Scheduled Technical Interview
                  </h4>
                  <p className="text-[11px] text-brand-700 dark:text-brand-300">Technical Round 1 scheduled for Tomorrow at 2:00 PM IST via Google Meet.</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-end">
              <button
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
