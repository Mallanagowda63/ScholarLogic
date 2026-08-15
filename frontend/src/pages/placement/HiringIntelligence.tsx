import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { TrendingUp, Sparkles, MapPin, Building, BarChart3, CheckCircle2, AlertTriangle, Layers, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

export const HiringIntelligence: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<'TRENDS' | 'SKILLS' | 'LOCATIONS'>(
    tabParam === 'skills' ? 'SKILLS' : tabParam === 'locations' ? 'LOCATIONS' : 'TRENDS'
  );

  const [skillsData, setSkillsData] = useState<any>(null);
  const [locationsData, setLocationsData] = useState<any>(null);
  const [trendsData, setTrendsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tabParam === 'skills') setActiveTab('SKILLS');
    else if (tabParam === 'locations') setActiveTab('LOCATIONS');
    else if (tabParam === 'trends') setActiveTab('TRENDS');
  }, [tabParam]);

  useEffect(() => {
    fetchIntelligenceData();
  }, [activeTab]);

  const fetchIntelligenceData = () => {
    setLoading(true);
    setError('');

    let endpoint = '/placements/hiring-intelligence/trends';
    if (activeTab === 'SKILLS') endpoint = '/placements/hiring-intelligence/skills';
    if (activeTab === 'LOCATIONS') endpoint = '/placements/hiring-intelligence/locations';

    api.get(endpoint)
      .then((res: any) => {
        if (res.success && res.data) {
          if (activeTab === 'SKILLS') setSkillsData(res.data);
          else if (activeTab === 'LOCATIONS') setLocationsData(res.data);
          else setTrendsData(res.data);
        }
      })
      .catch((err: any) => {
        console.error(err);
        setError('Unable to load hiring intelligence. Please verify database connection.');
      })
      .finally(() => setLoading(false));
  };

  const handleTabChange = (tab: 'TRENDS' | 'SKILLS' | 'LOCATIONS') => {
    setActiveTab(tab);
    setSearchParams({ tab: tab.toLowerCase() });
  };

  const COLORS = ['#0c8ee9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Corporate Hiring Intelligence & Analytics</h1>
          <p className="text-xs text-slate-500">Live analytics calculated dynamically from verified MongoDB Atlas placement job records</p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => handleTabChange('TRENDS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'TRENDS' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Hiring Trends
          </button>
          <button
            onClick={() => handleTabChange('SKILLS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'SKILLS' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Skills in Demand
          </button>
          <button
            onClick={() => handleTabChange('LOCATIONS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'LOCATIONS' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Hiring Locations
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-3xl border border-dashed border-red-200 bg-red-50/50 dark:bg-red-950/40 text-red-600 space-y-3">
          <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
          <p className="text-xs font-bold">{error}</p>
          <button
            onClick={fetchIntelligenceData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold shadow hover:bg-red-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      ) : (
        <div>
          {/* TAB 1: SKILLS IN DEMAND */}
          {activeTab === 'SKILLS' && skillsData && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" /> Market Required Skills Ranking
                    </h3>
                    <span className="text-xs font-bold text-slate-400 font-mono">Total Drives: {skillsData.totalJobs}</span>
                  </div>

                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={skillsData.skills || []}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="skill" tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="jobCount" name="Jobs Requiring Skill" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Personalization Match */}
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Your Skills vs Market Demand
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-bold text-emerald-600 block mb-1">High Demand Skills You Possess</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(skillsData.studentPersonalization?.matchedSkills || []).map((sk: string) => (
                          <span key={sk} className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> {sk}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-xs font-bold text-amber-600 block mb-1">Recommended Skills to Develop</span>
                      <div className="flex flex-wrap gap-1.5">
                        {(skillsData.studentPersonalization?.recommendedSkills || []).map((sk: string) => (
                          <span key={sk} className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Skills Table */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Normalized Skill Analytics Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-mono">
                        <th className="pb-3 font-bold">Skill Name</th>
                        <th className="pb-3 font-bold">Matching Job Drives</th>
                        <th className="pb-3 font-bold">Market Share %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(skillsData.skills || []).map((item: any) => (
                        <tr key={item.skill}>
                          <td className="py-3 font-extrabold text-slate-900 dark:text-white">{item.skill}</td>
                          <td className="py-3 font-bold font-mono text-brand-600">{item.jobCount} Jobs</td>
                          <td className="py-3 font-bold text-slate-600 dark:text-slate-300">{item.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HIRING LOCATIONS */}
          {activeTab === 'LOCATIONS' && locationsData && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-emerald-500" /> Regional Hiring Distribution
                  </h3>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={locationsData.locations || []}
                          dataKey="jobCount"
                          nameKey="canonicalLocation"
                          cx="50%"
                          cy="50%"
                          outerRadius={85}
                          label
                        >
                          {(locationsData.locations || []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="h-5 w-5 text-brand-500" /> Work Mode Breakdown by Hub
                  </h3>

                  <div className="space-y-3">
                    {(locationsData.locations || []).map((loc: any) => (
                      <div key={loc.canonicalLocation} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                        <div className="flex justify-between items-center font-extrabold text-slate-900 dark:text-white">
                          <span>📍 {loc.canonicalLocation}</span>
                          <span className="font-mono text-brand-600">{loc.jobCount} Openings ({loc.percentage}%)</span>
                        </div>
                        <div className="flex gap-3 text-[11px] text-slate-500">
                          <span>🏢 On-site: <strong>{loc.workModes?.onSite || 0}</strong></span>
                          <span>🏡 Hybrid: <strong>{loc.workModes?.hybrid || 0}</strong></span>
                          <span>🌐 Remote: <strong>{loc.workModes?.remote || 0}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HIRING TRENDS */}
          {activeTab === 'TRENDS' && trendsData && (
            <div className="space-y-6">
              {!trendsData.hasData ? (
                <div className="p-12 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500 space-y-2">
                  <BarChart3 className="h-8 w-8 mx-auto text-slate-400" />
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Insufficient Historical Data</h4>
                  <p>{trendsData.message || 'Not enough historical data to calculate hiring trends.'}</p>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-brand-500" /> Monthly Job Postings Trend
                  </h3>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendsData.trends || []}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" name="Job Drives Published" fill="#0c8ee9" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
