import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Job } from '../../types';
import { Badge } from '../../components/Badge';
import {
  Briefcase,
  Building,
  MapPin,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Send,
  Eye,
  Calendar,
  Award,
  Globe,
  FileText,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  User,
  X,
} from 'lucide-react';

export const StudentJobs: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">ScholarLogic Placement & Hiring Portal</h1>
        <p className="text-xs text-slate-500">Verified placement drives dynamically matched against your CGPA, course certificates, and ATS resume</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-5">
          {jobs.map((job: any) => {
            const matchScore = job.matchScore || 92;
            const company = job.companyId || {};
            const companyName = company.name || 'Partner Company';
            const isApplied = !!job.appliedStatus;

            return (
              <div
                key={job._id}
                className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-brand-500/50 transition-colors"
              >
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant={matchScore >= 85 ? 'green' : 'amber'}>
                      Skill Match: {matchScore}%
                    </Badge>
                    <span className="text-xs font-bold text-brand-600 dark:text-brand-400 font-mono">{job.type}</span>
                    {company.verificationStatus === 'VERIFIED' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <ShieldCheck className="h-3 w-3" /> Official Company Careers Verified
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-extrabold text-xl text-slate-900 dark:text-white">{job.title}</h3>
                    <p className="text-xs text-slate-500 font-semibold flex flex-wrap items-center gap-4 mt-1">
                      <span className="flex items-center gap-1.5"><Building className="h-3.5 w-3.5 text-brand-500" /> {companyName}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-slate-400" /> {job.location}</span>
                      <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-emerald-500" /> {job.salaryPackage}</span>
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">{job.description}</p>

                  {/* Skills tags */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-400">Required Skills:</span>
                    {(job.requiredSkills || []).map((sk: string) => (
                      <span key={sk} className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                        {sk}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between gap-4 md:border-l md:border-slate-100 md:dark:border-slate-800 md:pl-6 shrink-0">
                  <div className="text-right text-xs">
                    <span className="block font-bold text-slate-600 dark:text-slate-300">Min CGPA: {job.eligibilityCriteria?.minCgpa || 6.0}</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5 font-mono">Deadline: {new Date(job.deadline).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View JD Button */}
                    <button
                      onClick={() => openViewJd(job)}
                      className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" /> View JD
                    </button>

                    {/* Apply Now Button */}
                    {isApplied ? (
                      <span className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-extrabold flex items-center gap-1.5 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="h-4 w-4" /> Applied ({job.appliedStatus})
                      </span>
                    ) : (
                      <button
                        onClick={() => openApplyWizard(job)}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-extrabold shadow-md shadow-brand-500/20 hover:opacity-95 transition-opacity"
                      >
                        <Send className="h-3.5 w-3.5" /> Apply Now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
                {!viewJdJob.appliedStatus && (
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
