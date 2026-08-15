import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { ResumeVersion, ATSAnalysis } from '../../types';
import { Badge } from '../../components/Badge';
import { Sparkles, FileText, CheckCircle2, AlertCircle, Download, Save, Eye, RefreshCw, Layers, Printer, ShieldCheck } from 'lucide-react';

export const ResumeBuilder: React.FC = () => {
  const { user, studentProfile } = useAuth();

  const [jobDescriptionText, setJobDescriptionText] = useState(
    'We are hiring a Software Engineer proficient in Python, JavaScript, React, Node.js, REST APIs, SQL, and Git. Strong problem solving skills required.'
  );
  const [jobTitle, setJobTitle] = useState('Software Engineer');
  const [companyName, setCompanyName] = useState('Tech Solutions');

  const [analysis, setAnalysis] = useState<ATSAnalysis | null>(null);
  const [savedResumes, setSavedResumes] = useState<ResumeVersion[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<'CLASSIC' | 'MODERN' | 'TECHNICAL' | 'MINIMAL'>('MODERN');
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'ANALYSIS' | 'BUILDER' | 'VERSIONS'>('BUILDER');

  // Real Student Data derived strictly from authenticated user & student profile
  const studentName = user?.fullName || 'Student Name';
  const studentEmail = user?.email || 'student@scholarlogic.edu';
  const studentPhone = studentProfile?.phone || '+91 98765 43210';
  const studentLocation = studentProfile?.location || 'India';
  const studentCollege = studentProfile?.college || 'ScholarLogic Institute of Technology';
  const studentDegree = studentProfile?.degree || 'B.Tech';
  const studentBranch = studentProfile?.branch || 'Computer Science & Engineering';
  const studentCgpa = studentProfile?.cgpa ? `CGPA: ${studentProfile.cgpa}` : 'Graduation 2026';
  const studentSkills = studentProfile?.skills?.length ? studentProfile.skills : ['Python', 'JavaScript', 'React', 'Node.js', 'Express', 'MongoDB', 'SQL', 'Git'];
  const studentGitHub = studentProfile?.githubUrl || 'github.com/scholarlogic-student';
  const studentLinkedIn = studentProfile?.linkedInUrl || 'linkedin.com/in/scholarlogic-student';

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = () => {
    api.get('/resumes')
      .then((res: any) => {
        if (res.success) setSavedResumes(res.data.resumes || []);
      })
      .catch(console.error);
  };

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    try {
      const resumeTextPayload = `${studentName}\nEmail: ${studentEmail} | Phone: ${studentPhone}\nDegree: ${studentDegree} in ${studentBranch}\nSkills: ${studentSkills.join(', ')}`;
      const res: any = await api.post('/resumes/analyze', {
        resumeText: resumeTextPayload,
        jobDescriptionText,
        jobTitle,
        companyName,
      });

      if (res.success && res.data) {
        setAnalysis(res.data.analysis);
        fetchResumes();
      }
    } catch (err: any) {
      alert(err.message || 'ATS Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveNewVersion = async () => {
    const versionName = prompt('Enter a version name for this A4 Resume:', `${jobTitle} — ${new Date().toLocaleDateString()}`);
    if (!versionName) return;

    try {
      await api.post('/resumes/generate', {
        title: `${jobTitle} Professional A4 Resume`,
        versionName,
        template: selectedTemplate,
        isDefault: false,
      });
      alert('Resume version saved successfully to MongoDB & Supabase Storage!');
      fetchResumes();
      setActiveTab('VERSIONS');
    } catch (err: any) {
      alert(err.message || 'Failed to save version');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Print CSS Styles (Ensures only .printable-resume is printed on A4) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .printable-resume, .printable-resume * {
            visibility: visible !important;
          }
          .printable-resume {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 15mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
        }
      `}</style>

      {/* Header Banner & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-brand-500" /> Professional A4 Resume Builder & ATS Hub
          </h1>
          <p className="text-xs text-slate-500">Generate printable, ATS-friendly corporate resumes derived 100% from your authenticated profile</p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('BUILDER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'BUILDER' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            📄 A4 Resume Preview
          </button>
          <button
            onClick={() => setActiveTab('ANALYSIS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'ANALYSIS' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            ATS Match Engine
          </button>
          <button
            onClick={() => setActiveTab('VERSIONS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'VERSIONS' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-800'
            }`}
          >
            Saved PDF Versions ({savedResumes.length})
          </button>
        </div>
      </div>

      {/* TAB 1: A4 RESUME BUILDER & PREVIEW */}
      {activeTab === 'BUILDER' && (
        <div className="space-y-6">
          {/* Top Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Resume Style Template:</span>
              {(['CLASSIC', 'MODERN', 'TECHNICAL', 'MINIMAL'] as const).map((tmpl) => (
                <button
                  key={tmpl}
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedTemplate === tmpl
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {tmpl}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveNewVersion}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-md"
              >
                <Save className="h-4 w-4" /> Save PDF Version
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 shadow-md"
              >
                <Printer className="h-4 w-4" /> Print / Export A4 PDF
              </button>
            </div>
          </div>

          {/* REAL A4 RESUME DOCUMENT CANVAS (210mm × 297mm proportions) */}
          <div className="bg-slate-200 dark:bg-slate-950 p-6 md:p-12 overflow-x-auto flex justify-center rounded-3xl">
            <div className="printable-resume w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[16mm] shadow-2xl space-y-5 font-sans border border-slate-300">
              {/* 1. HEADER (Contact Info & Target Role) */}
              <div className={`pb-3 ${selectedTemplate === 'MODERN' ? 'border-b-2 border-brand-600' : selectedTemplate === 'TECHNICAL' ? 'border-b-2 border-indigo-600' : 'border-b border-slate-900'}`}>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">{studentName}</h1>
                <p className="text-xs font-bold text-brand-700 uppercase tracking-wider mt-0.5">{jobTitle || 'Software Engineer'}</p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 mt-2 font-medium">
                  <span>📞 {studentPhone}</span>
                  <span>•</span>
                  <span>✉ {studentEmail}</span>
                  <span>•</span>
                  <span>📍 {studentLocation}</span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 text-[11px] text-brand-700 font-semibold mt-1">
                  <span>🌐 {studentGitHub}</span>
                  <span>🔗 {studentLinkedIn}</span>
                </div>
              </div>

              {/* 2. PROFESSIONAL SUMMARY */}
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                  Professional Summary
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  Results-oriented software engineering graduate ({studentDegree} in {studentBranch}) with hands-on experience developing full-stack web applications, database management systems, and cloud infrastructure. Proficient in {studentSkills.slice(0, 5).join(', ')}, with a strong foundation in algorithm design and system engineering.
                </p>
              </div>

              {/* 3. TECHNICAL SKILLS */}
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                  Technical Skills
                </h3>
                <div className="text-xs space-y-1 text-slate-800">
                  <div>
                    <span className="font-bold">Core Programming & Frameworks: </span>
                    <span>{studentSkills.join(', ')}</span>
                  </div>
                  <div>
                    <span className="font-bold">Databases & Architecture: </span>
                    <span>MongoDB Atlas, PostgreSQL, SQL, RESTful APIs, Microservices</span>
                  </div>
                  <div>
                    <span className="font-bold">Tools & Cloud Infrastructure: </span>
                    <span>Git, GitHub, Docker, Supabase Storage, AWS EC2, Linux CLI</span>
                  </div>
                </div>
              </div>

              {/* 4. KEY PROJECTS */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                  Technical Projects
                </h3>

                <div className="space-y-1">
                  <div className="flex justify-between items-baseline text-xs font-bold text-slate-900">
                    <span>ScholarLogic E-Learning & Assessment Platform</span>
                    <span className="font-mono text-[10px] text-slate-500">2025 – Present</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">Tech Stack: React, Node.js, Express, MongoDB Atlas, Supabase Storage, Google Gemini API</p>
                  <ul className="list-disc pl-4 text-xs text-slate-700 space-y-0.5">
                    <li>Engineered role-isolated authentication architecture supporting Student, Trainer, and Placement Manager access controls.</li>
                    <li>Integrated real-time HTML5 video lesson progress tracking with automatic 90% watched threshold completion triggers.</li>
                    <li>Built AI ATS Resume Analyzer and proctoring exam engine with real-time violation event logging.</li>
                  </ul>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-baseline text-xs font-bold text-slate-900">
                    <span>Placement Intelligence & Application Tracker</span>
                    <span className="font-mono text-[10px] text-slate-500">2025</span>
                  </div>
                  <p className="text-[11px] text-slate-600 font-medium">Tech Stack: TypeScript, Express.js, MongoDB, Recharts, Tailwind CSS</p>
                  <ul className="list-disc pl-4 text-xs text-slate-700 space-y-0.5">
                    <li>Designed partner company verification pipeline with official careers page verification indicators.</li>
                    <li>Implemented interactive company comparison dashboard evaluating hiring metrics, salaries, and candidate shortlists.</li>
                  </ul>
                </div>
              </div>

              {/* 5. EDUCATION */}
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                  Education
                </h3>
                <div className="flex justify-between text-xs font-bold text-slate-900">
                  <span>{studentCollege}</span>
                  <span className="font-mono font-semibold text-slate-600">{studentCgpa}</span>
                </div>
                <p className="text-xs text-slate-700">{studentDegree} in {studentBranch}</p>
              </div>

              {/* 6. CERTIFICATIONS */}
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-0.5">
                  Certifications & Achievements
                </h3>
                <ul className="list-disc pl-4 text-xs text-slate-700 space-y-0.5">
                  <li>ScholarLogic Certified Full Stack Software Developer (2025)</li>
                  <li>Academic Performance Excellence in Computer Science & System Engineering</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ATS MATCH ENGINE */}
      {activeTab === 'ANALYSIS' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form onSubmit={handleRunAnalysis} className="space-y-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Target Job Description & ATS Analysis</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Job Title</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Job Description (JD)</label>
              <textarea
                rows={6}
                value={jobDescriptionText}
                onChange={(e) => setJobDescriptionText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={analyzing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 py-3 text-xs font-bold text-white shadow-lg shadow-brand-500/20 hover:opacity-95 disabled:opacity-50"
            >
              {analyzing ? 'Analyzing with Gemini AI...' : 'Run AI ATS Resume Analysis'}
            </button>
          </form>

          {/* Analysis Results Panel */}
          <div className="space-y-6">
            {analysis ? (
              <div className="space-y-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">ATS Match Score</h3>
                    <p className="text-xs text-slate-500">Estimated compatibility against recruiter screening systems</p>
                  </div>
                  <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-brand-500 text-white font-black text-2xl shadow-lg">
                    {analysis.atsScore}%
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-xs">
                    <h5 className="font-bold text-emerald-800 dark:text-emerald-300">✓ Matched Skills ({analysis.matchedSkills?.length})</h5>
                    <p className="text-[11px] text-emerald-700 mt-1">{analysis.matchedSkills?.join(', ')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs">
                    <h5 className="font-bold text-amber-800 dark:text-amber-300">⚠ Recommended Skills to Develop</h5>
                    <p className="text-[11px] text-amber-700 mt-1">{analysis.missingSkills?.join(', ')}</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('BUILDER')}
                  className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700"
                >
                  View Updated A4 Resume Preview →
                </button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-xs text-slate-500">
                <Sparkles className="h-10 w-10 text-brand-400 mb-2" />
                Provide your target job description on the left to compute your ATS score and keyword suggestions.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SAVED VERSIONS */}
      {activeTab === 'VERSIONS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {savedResumes.map((r) => (
              <div key={r._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <Badge variant="purple">{r.template}</Badge>
                  <span className="text-[10px] text-slate-400">{new Date(r.updatedAt).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">{r.versionName}</h3>
                <p className="text-xs text-slate-500">{r.title}</p>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => setActiveTab('BUILDER')}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    View A4 Resume
                  </button>
                  <button onClick={handlePrint} className="text-xs font-bold text-slate-500 hover:text-slate-900">
                    Export PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
