import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Building, Globe, ExternalLink, RefreshCw, PlusCircle, CheckCircle2, MapPin, Search } from 'lucide-react';

export const PlacementCompanies: React.FC = () => {
  const [searchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');

  const [companies, setCompanies] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'HIRING'>(filterParam === 'hiring' ? 'HIRING' : 'ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Modal Form
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [officialCareersUrl, setOfficialCareersUrl] = useState('');
  const [industry, setIndustry] = useState('Technology');
  const [location, setLocation] = useState('Bangalore');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = () => {
    setLoading(true);
    api.get('/placements/companies')
      .then((res: any) => {
        if (res.success) setCompanies(res.data.companies || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleVerifyCompany = async (compId: string) => {
    try {
      await api.post(`/placements/companies/${compId}/verify`);
      alert('Official company hiring status verified!');
      fetchCompanies();
    } catch (err: any) {
      alert(err.message || 'Verification failed');
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/placements/companies', {
        name,
        website,
        officialCareersUrl,
        industry,
        location,
        description,
        contactEmail,
      });
      alert('Company registered and added to placement database!');
      setShowAddModal(false);
      setName('');
      setWebsite('');
      fetchCompanies();
    } catch (err: any) {
      alert(err.message || 'Failed to add company');
    }
  };

  const displayedCompanies = activeTab === 'HIRING'
    ? companies.filter((c) => c.hiringStatus === 'HIRING_NOW' || c.hiringStatus === 'ACTIVE')
    : companies;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Partner Companies & Company Intelligence</h1>
          <p className="text-xs text-slate-500">Corporate hiring partners, verified official careers links, and student application pipelines</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ALL' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              All Companies ({companies.length})
            </button>
            <button
              onClick={() => setActiveTab('HIRING')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'HIRING' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              🔥 Hiring Now
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-colors shadow-md flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" /> + Add Partner Company
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedCompanies.map((c) => (
            <div key={c._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={c.hiringStatus === 'HIRING_NOW' ? 'amber' : 'green'}>{c.hiringStatus}</Badge>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Last verified: {new Date(c.lastVerifiedAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex gap-4">
                  <img
                    src={c.logoUrl || 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=100'}
                    alt={c.name}
                    className="h-14 w-14 rounded-2xl object-cover bg-white p-1 border border-slate-200"
                  />
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{c.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{c.industry} • {c.location}</p>
                  </div>
                </div>

                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{c.description}</p>
              </div>

              {/* ScholarLogic Internal Data Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs border-t border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Open Roles</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{c.openPositionsCount || 1}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Applications</span>
                  <span className="font-extrabold text-brand-600">{c.scholarlogicApplicationsCount || 1}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Offers</span>
                  <span className="font-extrabold text-emerald-600">{c.offersCount || 1}</span>
                </div>
              </div>

              {/* Official Links & Actions */}
              <div className="flex items-center justify-between pt-2">
                <a
                  href={c.officialCareersUrl || c.website || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  <Globe className="h-3.5 w-3.5" /> Official Careers <ExternalLink className="h-3 w-3" />
                </a>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerifyCompany(c._id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200"
                  >
                    Verify Status
                  </button>

                  <Link
                    to={`/placement/companies?id=${c._id}`}
                    className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-[11px] font-bold hover:bg-brand-700"
                  >
                    View Intelligence
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Partner Company */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-bold text-base text-white">Add Corporate Partner Company</h3>
            <form onSubmit={handleAddCompany} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Amazon Web Services"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Official Website URL</label>
                <input
                  type="url"
                  required
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://aws.amazon.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Official Careers Portal URL</label>
                <input
                  type="url"
                  value={officialCareersUrl}
                  onChange={(e) => setOfficialCareersUrl(e.target.value)}
                  placeholder="https://amazon.jobs"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Industry</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="university-recruiting@amazon.com"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Global cloud platform pioneer..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700">
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
