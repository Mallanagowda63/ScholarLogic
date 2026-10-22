import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Briefcase, PlusCircle, ExternalLink, Globe, MapPin, Clock, Building, CheckCircle2, Link2, Users } from 'lucide-react';

export const PlacementJobs: React.FC = () => {
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type');

  const [jobs, setJobs] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'SCHOLARLOGIC' | 'OFFICIAL'>(
    typeParam === 'official' ? 'OFFICIAL' : typeParam === 'scholarlogic' ? 'SCHOLARLOGIC' : 'ALL'
  );
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  // Typed company name: matched to an existing company, or added as a new one when the job is published
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Bangalore');
  const [salaryPackage, setSalaryPackage] = useState('12.0 - 15.0 LPA');
  const [postingType, setPostingType] = useState<'SCHOLARLOGIC_POSTING' | 'OFFICIAL_COMPANY_POSTING'>('SCHOLARLOGIC_POSTING');
  const [skillsStr, setSkillsStr] = useState('Python, SQL, React, REST API');
  const [applyUrl, setApplyUrl] = useState('');
  // Add / change the company's application link on an existing job
  const [linkJob, setLinkJob] = useState<any | null>(null);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([api.get('/placements/jobs'), api.get('/placements/companies')])
      .then(([res1, res2]: any) => {
        if (res1.success) setJobs(res1.data.jobs || []);
        if (res2.success) setCompanies(res2.data.companies || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const skillsArray = skillsStr.split(',').map((s) => s.trim()).filter(Boolean);
      const typed = companyName.trim();
      const known = companies.find((c) => c.name.trim().toLowerCase() === typed.toLowerCase());
      await api.post('/placements/jobs', {
        title,
        ...(known ? { companyId: known._id } : { companyName: typed }),
        description,
        location,
        salaryPackage,
        postingType,
        requiredSkills: skillsArray,
        applyUrl: applyUrl.trim(),
      });
      alert('Job posting published successfully!');
      setShowCreateModal(false);
      setTitle('');
      setApplyUrl('');
      setCompanyName('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to publish job');
    }
  };

  const openLinkEditor = (job: any) => {
    setLinkJob(job);
    setLinkValue(job.applyUrl || '');
    setLinkError('');
  };
  const saveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkJob) return;
    setSavingLink(true);
    setLinkError('');
    try {
      await api.put(`/placements/jobs/${linkJob._id}`, { applyUrl: linkValue.trim() });
      setLinkJob(null);
      fetchData();
    } catch (err: any) {
      setLinkError(err.message || 'Could not save the link');
    } finally {
      setSavingLink(false);
    }
  };

  const displayedJobs = activeTab === 'SCHOLARLOGIC'
    ? jobs.filter((j) => j.postingType === 'SCHOLARLOGIC_POSTING')
    : activeTab === 'OFFICIAL'
    ? jobs.filter((j) => j.postingType === 'OFFICIAL_COMPANY_POSTING')
    : jobs;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Job Postings & Official Job Discovery</h1>
          <p className="text-xs text-slate-500">ScholarLogic campus drives and verified official company career job postings</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ALL' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Jobs ({jobs.length})
            </button>
            <button
              onClick={() => setActiveTab('SCHOLARLOGIC')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'SCHOLARLOGIC' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              ScholarLogic Jobs
            </button>
            <button
              onClick={() => setActiveTab('OFFICIAL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'OFFICIAL' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Official Company Jobs
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-colors shadow-md flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" /> + Publish Job
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedJobs.map((j) => (
            <div key={j._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={j.postingType === 'SCHOLARLOGIC_POSTING' ? 'purple' : 'green'}>
                    {j.postingType === 'SCHOLARLOGIC_POSTING' ? 'SCHOLARLOGIC POSTING' : 'OFFICIAL COMPANY POSTING'}
                  </Badge>
                  <span className="text-xs font-bold text-emerald-600">{j.salaryPackage}</span>
                </div>

                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{j.title}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5 font-bold">
                    {(j.companyId as any)?.name || 'Partner Corporate'} • {j.location}
                  </p>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2">{j.description}</p>

                {/* Skill Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {j.requiredSkills.map((sk: string) => (
                    <span key={sk} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-[11px]">
                {j.applyUrl ? (
                  <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span className="shrink-0 font-semibold">Students apply at:</span>
                    <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" className="truncate text-brand-600 hover:underline">
                      {j.applyUrl}
                    </a>
                  </p>
                ) : (
                  <p className="text-slate-500">No company application link. Students apply through the ScholarLogic form.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openLinkEditor(j)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900">
                    <Link2 className="h-3 w-3" /> {j.applyUrl ? 'Edit apply link' : 'Add apply link'}
                  </button>
                  <Link to={`/placement/applications?jobId=${j._id}`} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900">
                    <Users className="h-3 w-3" /> View applicants
                  </Link>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-[10px] text-slate-400 font-mono">
                  Verified: {new Date(j.lastVerifiedAt || Date.now()).toLocaleDateString()}
                </span>

                <a
                  href={(j.companyId as any)?.officialCareersUrl || (j.companyId as any)?.website || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold text-[11px] hover:bg-brand-700 inline-flex items-center gap-1"
                >
                  <Globe className="h-3 w-3" /> Official Careers <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Publish Job */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-bold text-base text-white">Publish Job Posting</h3>
            <form onSubmit={handleCreateJob} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Python Full Stack Engineer"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label htmlFor="job-company" className="block text-slate-300 font-semibold mb-1">Company</label>
                <input
                  id="job-company"
                  type="text"
                  required
                  list="job-company-list"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Type a company name, e.g. TCS"
                  autoComplete="off"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold placeholder:font-normal placeholder:text-slate-500"
                />
                <datalist id="job-company-list">
                  {companies.map((c) => (
                    <option key={c._id} value={c.name} />
                  ))}
                </datalist>
                {companyName.trim() && !companies.some((c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase()) && (
                  <p className="mt-1 text-[10px] text-emerald-400">New company: "{companyName.trim()}" will be added when you publish.</p>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Posting Type Badge</label>
                <select
                  value={postingType}
                  onChange={(e: any) => setPostingType(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                >
                  <option value="SCHOLARLOGIC_POSTING">SCHOLARLOGIC POSTING (Internal Campus Drive)</option>
                  <option value="OFFICIAL_COMPANY_POSTING">OFFICIAL COMPANY POSTING (Discovered from Careers Page)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Salary Package</label>
                  <input
                    type="text"
                    value={salaryPackage}
                    onChange={(e) => setSalaryPackage(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Required Skills (Comma separated)</label>
                <input
                  type="text"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Company application link (optional)</label>
                <input
                  type="url"
                  value={applyUrl}
                  onChange={(e) => setApplyUrl(e.target.value)}
                  placeholder="https://careers.company.com/jobs/12345"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
                <p className="mt-1 text-[10px] text-slate-400">If set, the student's Apply button opens this page and their name is recorded under Applications.</p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Job Description</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Responsibilities & technical requirements..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700">
                  Publish Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {linkJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div>
              <h3 className="font-bold text-base text-white">Company application link</h3>
              <p className="text-xs text-slate-400">
                {linkJob.title} • {(linkJob.companyId as any)?.name || 'Company'}
              </p>
            </div>
            <form onSubmit={saveLink} className="space-y-3 text-xs">
              <input
                id="apply-link"
                type="url"
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                placeholder="https://careers.company.com/jobs/12345"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white"
                autoFocus
              />
              <p className="text-[11px] text-slate-400">
                Students who click Apply go to this page, and their name is saved under Applications. Leave it empty to go back to the ScholarLogic application form.
              </p>
              {linkError && <p className="rounded-lg bg-rose-950/60 p-2 text-rose-300">{linkError}</p>}
              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={() => setLinkJob(null)} className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={savingLink} className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-60">
                  {savingLink ? 'Saving…' : 'Save link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
