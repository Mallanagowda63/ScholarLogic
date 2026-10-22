import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Job } from '../../types';
import { Badge } from '../../components/Badge';
import {
  Briefcase,
  Building,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Send,
  Globe,
  Sparkles,
  ArrowRight,
  X,
  Search,
  Zap,
  Ban,
  Wallet,
  GraduationCap,
  CalendarDays,
  CalendarClock,
} from 'lucide-react';

type DriveTab = 'all' | 'fulltime' | 'internship' | 'applied';

const DRIVE_TABS: { key: DriveTab; label: string }[] = [
  { key: 'all', label: 'All drives' },
  { key: 'fulltime', label: 'Full-time' },
  { key: 'internship', label: 'Internships' },
  { key: 'applied', label: 'Applied drives' },
];

const JOB_TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Full-time',
  INTERNSHIP: 'Internship',
  CONTRACT: 'Contract',
};

const driveCode = (id: string) => `SL-JOB-${String(id).slice(-5).toUpperCase()}`;

const isDriveOpen = (job: any, now: number) => job.status === 'OPEN' && new Date(job.deadline).getTime() > now;

const pad = (n: number) => String(n).padStart(2, '0');

// "Ends in 05:12:09" inside the last day, "Ends in 3 days" before that, "Expired 2 hours ago" after
const deadlineLabel = (job: any, now: number) => {
  const diff = new Date(job.deadline).getTime() - now;
  const abs = Math.abs(diff);
  const minutes = Math.floor(abs / 60000);
  const hours = Math.floor(abs / 3600000);
  const days = Math.floor(abs / 86400000);

  if (isDriveOpen(job, now)) {
    if (diff < 86400000) {
      return `Ends in ${pad(hours)}:${pad(Math.floor((abs % 3600000) / 60000))}:${pad(Math.floor((abs % 60000) / 1000))}`;
    }
    return `Ends in ${days} ${days === 1 ? 'day' : 'days'}`;
  }
  if (diff > 0) return 'Closed early';
  if (minutes < 60) return `Expired ${Math.max(1, minutes)} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  if (hours < 24) return `Expired ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return `Expired ${days} ${days === 1 ? 'day' : 'days'} ago`;
};

const DriveFact: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode }> = ({ icon: Icon, label, value }) => (
  <div className="flex min-w-0 gap-2.5">
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
    </span>
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 line-clamp-3 text-xs font-semibold text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  </div>
);

export const StudentJobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DriveTab>('all');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());

  // Tick every second so countdowns and open/closed status stay live
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Modals state
  const [viewJdJob, setViewJdJob] = useState<any | null>(null);
  const [applyJob, setApplyJob] = useState<any | null>(null);

  // Application Wizard Steps: 1: ELIGIBILITY, 2: DETAILS, 3: RESUME_CERTS, 4: COVER_LETTER, 5: REVIEW, 6: SUCCESS
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [eligibilityData, setEligibilityData] = useState<any | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Form State
  const [userResumes, setUserResumes] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [coverLetter, setCoverLetter] = useState('');
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [relocateAnswer, setRelocateAnswer] = useState('Yes');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedApplication, setSubmittedApplication] = useState<any | null>(null);

  useEffect(() => {
    fetchJobs();
    fetchUserResumes();
  }, []);

  const fetchJobs = () => {
    setLoading(true);
    api.get('/placements/jobs')
      .then((res: any) => {
        if (res.success) setJobs(res.data.jobs || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchUserResumes = () => {
    api.get('/resumes')
      .then((res: any) => {
        if (res.success && res.data.resumes?.length > 0) {
          setUserResumes(res.data.resumes);
          setSelectedResumeId(res.data.resumes[0]._id);
        }
      })
      .catch(console.error);
  };

  const openViewJd = (job: any) => {
    setViewJdJob(job);
  };

  // Jobs with the company's own application link: record the application, then send the student there
  const [externalNote, setExternalNote] = useState<{ job: any; url: string; popupBlocked: boolean } | null>(null);
  const applyOnCompanySite = async (job: any) => {
    // Open the tab inside the click so the browser doesn't block it; fill it once the application is recorded
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const res: any = await api.post(`/placements/jobs/${job._id}/apply-external`, {});
      const url = res.data.applyUrl;
      if (tab) tab.location.href = url;
      setViewJdJob(null);
      setExternalNote({ job, url, popupBlocked: !tab });
      fetchJobs();
    } catch (err: any) {
      tab?.close();
      alert(err.message || 'Could not record your application. Please try again.');
    }
  };

  const openApplyWizard = async (job: any) => {
    setApplyJob(job);
    setWizardStep(1);
    setCheckingEligibility(true);
    setEligibilityData(null);
    setSubmittedApplication(null);

    try {
      const res: any = await api.get(`/placements/jobs/${job._id}/eligibility`);
      if (res.success) {
        setEligibilityData(res.data);
        if (res.data.studentSummary?.certifications?.length > 0) {
          setSelectedCerts(res.data.studentSummary.certifications.map((c: any) => c.name || c));
        }
      }
    } catch (err: any) {
      alert(err.message || 'Could not verify eligibility');
    } finally {
      setCheckingEligibility(false);
    }
  };

  const toggleCert = (certName: string) => {
    if (selectedCerts.includes(certName)) {
      setSelectedCerts(selectedCerts.filter((c) => c !== certName));
    } else {
      setSelectedCerts([...selectedCerts, certName]);
    }
  };

  const handleGenerateAiCoverLetter = () => {
    if (!applyJob) return;
    setCoverLetter(
      `Dear Hiring Manager at ${applyJob.companyId?.name || 'Company'},\n\nI am writing to express my strong interest in the ${applyJob.title} position. As a high-performing student with expertise in ${applyJob.requiredSkills?.join(', ')}, I have built production-grade applications during my curriculum at ScholarLogic Academy. I am eager to bring my technical background and problem-solving skills to your team.\n\nThank you for considering my application.\n\nSincerely,\n${eligibilityData?.studentSummary?.fullName || 'Applicant'}`
    );
  };

  const handleSubmitApplication = async () => {
    if (!applyJob) return;
    setSubmitting(true);

    try {
      const res: any = await api.post(`/placements/jobs/${applyJob._id}/apply`, {
        resumeId: selectedResumeId || undefined,
        coverLetter,
        selectedCertificates: selectedCerts,
        answers: [
          { question: 'Willing to relocate?', answer: relocateAnswer },
          { question: 'Expected Salary / Package?', answer: expectedSalary || applyJob.salaryPackage },
        ],
      });

      if (res.success && res.data) {
        setSubmittedApplication(res.data);
        setWizardStep(6); // Success Step
        fetchJobs();
      }
    } catch (err: any) {
      alert(err.message || 'Application submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const drives = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs
      .filter((job: any) => {
        if (activeTab === 'fulltime' && job.type !== 'FULL_TIME') return false;
        if (activeTab === 'internship' && job.type !== 'INTERNSHIP') return false;
        if (activeTab === 'applied' && !job.appliedStatus) return false;
        if (!q) return true;
        return [job.title, job.companyId?.name, job.location, ...(job.requiredSkills || [])]
          .filter(Boolean)
          .some((v: string) => v.toLowerCase().includes(q));
      })
      .sort((a: any, b: any) => {
        const aOpen = isDriveOpen(a, now);
        const bOpen = isDriveOpen(b, now);
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        const aTime = new Date(a.deadline).getTime();
        const bTime = new Date(b.deadline).getTime();
        // Open drives: closing soonest first. Closed drives: most recently closed first.
        return aOpen ? aTime - bTime : bTime - aTime;
      });
  }, [jobs, activeTab, search, now]);

  const tabCounts: Record<DriveTab, number> = {
    all: jobs.length,
    fulltime: jobs.filter((j: any) => j.type === 'FULL_TIME').length,
    internship: jobs.filter((j: any) => j.type === 'INTERNSHIP').length,
    applied: jobs.filter((j: any) => j.appliedStatus).length,
  };
  const openCount = jobs.filter((j: any) => isDriveOpen(j, now)).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Jobs</h1>
          <p className="text-xs text-slate-500">Placement drives matched against your CGPA, certificates and resume.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
          <Zap className="h-3.5 w-3.5" /> {openCount} open {openCount === 1 ? 'drive' : 'drives'}
        </span>
      </div>

      {/* Tabs */}
      <nav className="flex gap-6 overflow-x-auto border-b border-slate-200 dark:border-slate-800" aria-label="Drive categories">
        {DRIVE_TABS.map(({ key, label }) => {
          const active = key === activeTab;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`relative shrink-0 pb-3 text-sm font-semibold transition-colors ${
                active ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs font-medium text-slate-400">{tabCounts[key]}</span>
              <span className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500 transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          );
        })}
      </nav>

      {/* Search */}
      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by role, company, location or skill"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </label>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : drives.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
          <Briefcase className="mx-auto mb-2 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {activeTab === 'applied' ? "You haven't applied to any drives yet" : 'No drives found'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {search ? 'Try a different search term.' : 'New placement drives will appear here as soon as they are posted.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {drives.map((job: any) => {
            const open = isDriveOpen(job, now);
            const deadline = new Date(job.deadline).getTime();
            const branches: string[] = job.eligibilityCriteria?.allowedBranches || [];
            const years: number[] = job.eligibilityCriteria?.passoutYears || [];
            const endsSoon = open && deadline - now < 24 * 60 * 60 * 1000;

            return (
              <article
                key={job._id}
                className={`flex flex-col rounded-2xl border bg-white dark:bg-slate-900 p-5 transition-all ${
                  open
                    ? 'border-slate-200 dark:border-slate-700 shadow-md hover:-translate-y-0.5 hover:shadow-lg'
                    : 'border-slate-100 dark:border-slate-800 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-400">{driveCode(job._id)}</span>
                  {job.appliedStatus ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950/50 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-700 dark:text-brand-300">
                      <CheckCircle2 className="h-3 w-3" /> {job.appliedStatus.replace(/_/g, ' ')}
                    </span>
                  ) : open ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" /> Open
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 dark:border-rose-900 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-500">
                      <Ban className="h-3 w-3" /> Closed
                    </span>
                  )}
                </div>

                <h3 className={`mt-1.5 text-base font-bold ${open ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                  {job.title}
                </h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <Building className="h-3.5 w-3.5" /> {job.companyId?.name || 'Partner Company'}
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  {JOB_TYPE_LABEL[job.type] || job.type}
                </p>

                <dl className="mt-5 grid flex-1 grid-cols-2 gap-x-4 gap-y-4">
                  <DriveFact icon={MapPin} label="Location" value={job.location || '—'} />
                  <DriveFact icon={Wallet} label="Salary" value={job.salaryPackage || '—'} />
                  <DriveFact
                    icon={GraduationCap}
                    label="Eligibility"
                    value={
                      <>
                        Min CGPA {job.eligibilityCriteria?.minCgpa ?? 6}
                        {branches.length > 0 && <span className="block text-slate-500 dark:text-slate-400">{branches.join(', ')}</span>}
                      </>
                    }
                  />
                  <DriveFact icon={CalendarDays} label="Passing year" value={years.length ? years.join(', ') : 'Any'} />
                </dl>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      !open ? 'text-slate-500' : endsSoon ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <CalendarClock className="h-4 w-4" />
                    {deadlineLabel(job, now)}
                  </span>
                  <button
                    type="button"
                    onClick={() => openViewJd(job)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-700 transition-colors"
                  >
                    Know more <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {externalNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Application recorded</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              The placement team can now see that you applied for <b>{externalNote.job.title}</b> at <b>{externalNote.job.companyId?.name || 'the company'}</b>.
              {externalNote.popupBlocked
                ? ' Your browser blocked the new tab, so open the company page with the button below and finish your application there.'
                : ' The company page opened in a new tab. Finish your application there.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setExternalNote(null)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                Close
              </button>
              <a
                href={externalNote.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-extrabold hover:bg-brand-700 inline-flex items-center gap-1.5"
              >
                <Globe className="h-3.5 w-3.5" /> Open company page
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 1. VIEW JD MODAL */}
      {viewJdJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-brand-600 font-mono tracking-wider">
                  {viewJdJob.postingType || 'OFFICIAL_CAREERS_PAGE'} • VERIFIED LISTING
                </span>
                <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">{viewJdJob.title}</h2>
                <p className="text-xs font-semibold text-slate-500 flex items-center gap-3 mt-1">
                  <span>🏢 {viewJdJob.companyId?.name || 'Partner Company'}</span>
                  <span>📍 {viewJdJob.location}</span>
                  <span>💰 {viewJdJob.salaryPackage}</span>
                </p>
              </div>

              <button
                onClick={() => setViewJdJob(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Official Source Badge */}
            <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-900 flex items-center justify-between text-xs font-semibold text-brand-800 dark:text-brand-300">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-brand-600" />
                <span>Source: Official Company Careers Page</span>
              </div>
              {viewJdJob.companyId?.officialCareersUrl && (
                <a
                  href={viewJdJob.companyId.officialCareersUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  Visit Official Careers Page →
                </a>
              )}
            </div>

            {/* Role Breakdown Sections */}
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed max-h-[50vh] overflow-y-auto pr-2">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-1">About The Role</h4>
                <p>{viewJdJob.description}</p>
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-1">Required Technical Skills</h4>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(viewJdJob.requiredSkills || []).map((sk: string) => (
                    <span key={sk} className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs">
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-1">Eligibility Criteria</h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li>Minimum CGPA Required: <strong className="text-slate-900 dark:text-white">{viewJdJob.eligibilityCriteria?.minCgpa || 6.0}</strong></li>
                  <li>Eligible Branches: <strong className="text-slate-900 dark:text-white">{(viewJdJob.eligibilityCriteria?.allowedBranches || ['CSE', 'ECE']).join(', ')}</strong></li>
                  <li>Eligible Passout Years: <strong className="text-slate-900 dark:text-white">{(viewJdJob.eligibilityCriteria?.passoutYears || [2026]).join(', ')}</strong></li>
                </ul>
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider mb-1">Hiring & Selection Rounds</h4>
                <p>Initial Profile Screening → Technical Online Assessment → Technical Interview (Round 1) → HR Interview → Official Offer Letter.</p>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">Deadline: {new Date(viewJdJob.deadline).toLocaleDateString()}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewJdJob(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
                {viewJdJob.applyUrl ? (
                  viewJdJob.appliedStatus ? (
                    <a
                      href={viewJdJob.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2 rounded-xl border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-xs font-extrabold hover:bg-brand-50 dark:hover:bg-brand-950/40 flex items-center gap-1.5"
                    >
                      <Globe className="h-3.5 w-3.5" /> Open company application page
                    </a>
                  ) : (
                    <button
                      onClick={() => applyOnCompanySite(viewJdJob)}
                      className="px-5 py-2 rounded-xl bg-brand-600 text-white text-xs font-extrabold hover:bg-brand-700 flex items-center gap-1.5"
                    >
                      <Globe className="h-3.5 w-3.5" /> Apply on {viewJdJob.companyId?.name || 'company'} website
                    </button>
                  )
                ) : (
                  !viewJdJob.appliedStatus && (
                    <button
                      onClick={() => {
                        const j = viewJdJob;
                        setViewJdJob(null);
                        openApplyWizard(j);
                      }}
                      className="px-5 py-2 rounded-xl bg-brand-600 text-white text-xs font-extrabold hover:bg-brand-700 flex items-center gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5" /> Apply Now
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. APPLY NOW MULTI-STEP WIZARD MODAL */}
      {applyJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 space-y-6 shadow-2xl my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-brand-600 font-mono tracking-wider">
                  Placement Application Wizard • Step {wizardStep} of 5
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{applyJob.title}</h2>
                <p className="text-xs text-slate-500">{applyJob.companyId?.name || 'Partner Company'} • {applyJob.location}</p>
              </div>

              <button
                onClick={() => setApplyJob(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* STEP 1: ELIGIBILITY CHECK */}
            {wizardStep === 1 && (
              <div className="space-y-5">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Step 1: Automated Eligibility Check</h3>

                {checkingEligibility ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  </div>
                ) : eligibilityData ? (
                  <div className="space-y-4">
                    {/* Eligibility Badge Status */}
                    {eligibilityData.eligible ? (
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 space-y-1">
                        <div className="flex items-center gap-2 font-extrabold text-sm text-emerald-700 dark:text-emerald-200">
                          <CheckCircle2 className="h-5 w-5" /> ✓ You are eligible to apply for this job posting.
                        </div>
                        <p className="text-[11px] opacity-90">Your profile CGPA ({eligibilityData.studentSummary?.cgpa}) satisfies the minimum threshold of {applyJob.eligibilityCriteria?.minCgpa || 6.0}.</p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-800 dark:text-red-300 space-y-2">
                        <div className="flex items-center gap-2 font-extrabold text-sm text-red-700 dark:text-red-200">
                          <AlertTriangle className="h-5 w-5" /> ❌ You are not eligible to apply.
                        </div>
                        <ul className="list-disc pl-4 space-y-1">
                          {eligibilityData.reasons?.map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Applicant Profile Summary */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                      <h4 className="font-bold text-slate-900 dark:text-white">Applicant Identity Record</h4>
                      <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                        <div>Name: <span className="font-bold text-slate-900 dark:text-white">{eligibilityData.studentSummary?.fullName}</span></div>
                        <div>Student ID: <span className="font-mono font-bold text-slate-900 dark:text-white">{eligibilityData.studentSummary?.studentId}</span></div>
                        <div>Degree & Branch: <span className="font-bold text-slate-900 dark:text-white">{eligibilityData.studentSummary?.degree} ({eligibilityData.studentSummary?.branch})</span></div>
                        <div>CGPA: <span className="font-bold text-slate-900 dark:text-white">{eligibilityData.studentSummary?.cgpa}</span></div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setApplyJob(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!eligibilityData?.eligible}
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2 rounded-xl bg-brand-600 text-white text-xs font-extrabold disabled:opacity-50 hover:bg-brand-700"
                  >
                    Continue to Details →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: REQUIRED DETAILS & RESUME SELECTION */}
            {wizardStep === 2 && (
              <div className="space-y-5 text-xs">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Step 2: Resume & Document Selection</h3>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Resume Version to Submit</label>
                  {userResumes.length > 0 ? (
                    <select
                      value={selectedResumeId}
                      onChange={(e) => setSelectedResumeId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white font-bold"
                    >
                      {userResumes.map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.title || r.versionName} ({r.template} Template)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs">
                      Default ScholarLogic Profile Resume will be attached automatically.
                    </div>
                  )}
                </div>

                {/* Certifications Attachment */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">Attach Verified Profile Certifications</label>
                  <div className="space-y-2">
                    {['ScholarLogic Certified Full Stack Professional', 'AWS Cloud Architect', 'Python Advanced Analytics'].map((cert) => (
                      <label key={cert} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCerts.includes(cert)}
                          onChange={() => toggleCert(cert)}
                          className="rounded text-brand-600 focus:ring-brand-500"
                        />
                        <span className="font-semibold text-slate-900 dark:text-white">{cert}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setWizardStep(1)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold">
                    ← Back
                  </button>
                  <button onClick={() => setWizardStep(3)} className="px-5 py-2 rounded-xl bg-brand-600 text-white font-bold">
                    Continue to Cover Letter →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: COVER LETTER & QUESTIONS */}
            {wizardStep === 3 && (
              <div className="space-y-5 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Step 3: Cover Letter & Role Questions</h3>
                  <button
                    onClick={handleGenerateAiCoverLetter}
                    className="px-3 py-1 rounded-xl bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 flex items-center gap-1"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Generate with Gemini AI
                  </button>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Cover Letter (Optional)</label>
                  <textarea
                    rows={5}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Express your background, key technical achievements, and interest in this role..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Are you willing to relocate?</label>
                    <select
                      value={relocateAnswer}
                      onChange={(e) => setRelocateAnswer(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="Yes">Yes, willing to relocate</option>
                      <option value="No">No, local / remote only</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Expected Package / Remarks</label>
                    <input
                      type="text"
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(e.target.value)}
                      placeholder={applyJob.salaryPackage}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setWizardStep(2)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold">
                    ← Back
                  </button>
                  <button onClick={() => setWizardStep(4)} className="px-5 py-2 rounded-xl bg-brand-600 text-white font-bold">
                    Review Application →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: APPLICATION REVIEW */}
            {wizardStep === 4 && (
              <div className="space-y-5 text-xs">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Step 4: Final Application Review</h3>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                    <div>
                      <span className="text-[10px] font-bold text-brand-600 uppercase">Target Job</span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{applyJob.title}</h4>
                      <p className="text-[11px] text-slate-500">{applyJob.companyId?.name} • {applyJob.salaryPackage}</p>
                    </div>
                    <Badge variant="green">Verified Eligible</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div>Applicant Name: <span className="font-bold text-slate-900 dark:text-white">{eligibilityData?.studentSummary?.fullName}</span></div>
                    <div>Student ID: <span className="font-mono font-bold text-slate-900 dark:text-white">{eligibilityData?.studentSummary?.studentId}</span></div>
                    <div>CGPA: <span className="font-bold text-slate-900 dark:text-white">{eligibilityData?.studentSummary?.cgpa}</span></div>
                    <div>Certifications: <span className="font-bold text-slate-900 dark:text-white">{selectedCerts.length} Attached</span></div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setWizardStep(3)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold">
                    ← Back to Edit
                  </button>
                  <button
                    onClick={handleSubmitApplication}
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold shadow-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send className="h-4 w-4" /> {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: SUCCESS CONFIRMATION SCREEN */}
            {wizardStep === 6 && submittedApplication && (
              <div className="text-center space-y-5 py-4">
                <div className="h-16 w-16 rounded-3xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xl">
                  <CheckCircle2 className="h-10 w-10" />
                </div>

                <div className="space-y-1">
                  <h3 className="font-black text-xl text-slate-900 dark:text-white">🎉 APPLICATION SUBMITTED!</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Application Reference ID: <strong className="text-brand-600">{submittedApplication.data?.applicationId || 'SL-APP-2026'}</strong>
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 max-w-md mx-auto text-xs text-left space-y-1">
                  <div>Company: <strong className="text-slate-900 dark:text-white">{applyJob.companyId?.name}</strong></div>
                  <div>Role: <strong className="text-slate-900 dark:text-white">{applyJob.title}</strong></div>
                  <div>Status: <span className="font-bold text-emerald-600">APPLIED</span></div>
                </div>

                <div className="flex items-center justify-center gap-4 pt-2">
                  <Link
                    to="/student/applications"
                    className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-extrabold shadow-md hover:bg-brand-700"
                  >
                    View My Applications →
                  </Link>
                  <button
                    onClick={() => setApplyJob(null)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
