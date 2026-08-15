import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Briefcase, PlusCircle, ExternalLink, Globe, MapPin, Clock, Building, CheckCircle2 } from 'lucide-react';

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
  const [companyId, setCompanyId] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Bangalore');
  const [salaryPackage, setSalaryPackage] = useState('12.0 - 15.0 LPA');
  const [postingType, setPostingType] = useState<'SCHOLARLOGIC_POSTING' | 'OFFICIAL_COMPANY_POSTING'>('SCHOLARLOGIC_POSTING');
  const [skillsStr, setSkillsStr] = useState('Python, SQL, React, REST API');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    Promise.all([api.get('/placements/jobs'), api.get('/placements/companies')])
      .then(([res1, res2]: any) => {
        if (res1.success) setJobs(res1.data.jobs || []);
        if (res2.success && res2.data.companies.length > 0) {
          setCompanies(res2.data.companies);
          setCompanyId(res2.data.companies[0]._id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const skillsArray = skillsStr.split(',').map((s) => s.trim()).filter(Boolean);
      await api.post('/placements/jobs', {
        title,
        companyId,
        description,
        location,
        salaryPackage,
        postingType,
        requiredSkills: skillsArray,
      });
      alert('Job posting published successfully!');
      setShowCreateModal(false);
      setTitle('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to publish job');
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
                <label className="block text-slate-300 font-semibold mb-1">Company</label>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                >
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
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
    </div>
  );
};
