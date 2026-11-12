import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { ATSAnalysis } from '../../types';
import {
  Briefcase,
  CheckCircle2,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  Printer,
  Save,
  Sparkles,
  Star,
  Target,
  Trash2,
  Upload,
  User,
  Wand2,
  X,
} from 'lucide-react';

// Student → Resume AI Builder: upload a resume (the AI fills every section), edit it with a live A4 preview,
// get an AI review with one-click fixes, match it against a job description, and keep saved versions.

type Template = 'CLASSIC' | 'MODERN' | 'TECHNICAL' | 'MINIMAL';
interface Exp { company: string; role: string; startDate: string; endDate: string; description: string; highlights: string[] }
interface Edu { institution: string; degree: string; fieldOfStudy: string; startDate: string; endDate: string; grade: string }
interface Proj { title: string; description: string; technologies: string[]; link: string }
interface ResumeData {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  linkedInUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  summary: string;
  skills: string[];
  experience: Exp[];
  education: Edu[];
  projects: Proj[];
  certifications: string[];
}
interface Saved { _id: string; versionName: string; title: string; template: Template; isDefault: boolean; updatedAt: string; data: Partial<ResumeData> }
interface Review {
  score: number;
  verdict: string;
  sections: { name: string; score: number; comment: string }[];
  strengths: string[];
  improvements: string[];
  missingSections: string[];
  suggestedSkills: string[];
  improvedSummary: string;
  bulletRewrites: { before: string; after: string }[];
}

const EMPTY: ResumeData = {
  fullName: '', headline: '', email: '', phone: '', location: '', linkedInUrl: '', githubUrl: '', portfolioUrl: '',
  summary: '', skills: [], experience: [], education: [], projects: [], certifications: [],
};
const newExp = (): Exp => ({ company: '', role: '', startDate: '', endDate: '', description: '', highlights: [] });
const newEdu = (): Edu => ({ institution: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', grade: '' });
const newProj = (): Proj => ({ title: '', description: '', technologies: [], link: '' });

// Saved / uploaded data can miss fields: always work with the full shape
const normalize = (d: any): ResumeData => ({
  ...EMPTY,
  ...Object.fromEntries(Object.entries(d || {}).filter(([, v]) => v != null)),
  skills: Array.isArray(d?.skills) ? d.skills : [],
  certifications: Array.isArray(d?.certifications) ? d.certifications : [],
  experience: (d?.experience || []).map((e: any) => ({ ...newExp(), ...e, endDate: e.endDate || (e.current ? 'Present' : ''), highlights: e.highlights || [] })),
  education: (d?.education || []).map((e: any) => ({ ...newEdu(), ...e })),
  projects: (d?.projects || []).map((p: any) => ({ ...newProj(), ...p, technologies: p.technologies || [] })),
});

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';
const labelCls = 'mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500';
const listFromText = (t: string) => t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const csv = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean);
const clean = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

const Section: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ icon: Icon, title, children, action }) => (
  <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
        <Icon className="h-4 w-4 text-brand-500" /> {title}
      </h3>
      {action}
    </div>
    {children}
  </div>
);

// The printable A4 page
const ResumePaper: React.FC<{ d: ResumeData; template: Template }> = ({ d, template }) => {
  const accent = template === 'MODERN' ? 'text-brand-700' : template === 'TECHNICAL' ? 'text-indigo-700' : 'text-slate-700';
  const rule = template === 'MODERN' ? 'border-b-2 border-brand-600' : template === 'TECHNICAL' ? 'border-b-2 border-indigo-600' : template === 'MINIMAL' ? 'border-b border-slate-200' : 'border-b border-slate-900';
  const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className={`border-b border-slate-200 pb-0.5 text-xs font-black uppercase tracking-wider ${template === 'MINIMAL' ? 'text-slate-600' : 'text-slate-900'}`}>{children}</h3>
  );
  const contact = [d.phone, d.email, d.location].filter(Boolean);
  const links = [d.linkedInUrl, d.githubUrl, d.portfolioUrl].filter(Boolean);
  return (
    <div className={`printable-resume w-[210mm] min-h-[297mm] space-y-4 border border-slate-300 bg-white p-[16mm] text-slate-900 shadow-2xl ${template === 'CLASSIC' ? 'font-serif' : 'font-sans'}`}>
      <div className={`pb-3 ${rule} ${template === 'CLASSIC' ? 'text-center' : ''}`}>
        <h1 className="text-2xl font-black uppercase tracking-tight">{d.fullName || 'Your Name'}</h1>
        {d.headline && <p className={`mt-0.5 text-xs font-bold uppercase tracking-wider ${accent}`}>{d.headline}</p>}
        {contact.length > 0 && <p className="mt-2 text-[11px] font-medium text-slate-600">{contact.join('  •  ')}</p>}
        {links.length > 0 && <p className={`mt-1 text-[11px] font-semibold ${accent}`}>{links.map(clean).join('  •  ')}</p>}
      </div>
      {d.summary && (
        <div className="space-y-1">
          <H>Professional Summary</H>
          <p className="text-xs leading-relaxed text-slate-700">{d.summary}</p>
        </div>
      )}
      {d.skills.length > 0 && (
        <div className="space-y-1">
          <H>Skills</H>
          <p className="text-xs text-slate-800">{d.skills.join('  •  ')}</p>
        </div>
      )}
      {d.experience.some((e) => e.role || e.company) && (
        <div className="space-y-2.5">
          <H>Experience</H>
          {d.experience.filter((e) => e.role || e.company).map((e, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-baseline justify-between text-xs font-bold">
                <span>{[e.role, e.company].filter(Boolean).join(' — ')}</span>
                <span className="font-mono text-[10px] text-slate-500">{[e.startDate, e.endDate].filter(Boolean).join(' – ')}</span>
              </div>
              {e.description && <p className="text-[11px] text-slate-600">{e.description}</p>}
              {e.highlights.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                  {e.highlights.map((h, j) => (
                    <li key={j}>{h}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {d.projects.some((p) => p.title) && (
        <div className="space-y-2.5">
          <H>Projects</H>
          {d.projects.filter((p) => p.title).map((p, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-baseline justify-between text-xs font-bold">
                <span>{p.title}</span>
                {p.link && <span className={`text-[10px] font-semibold ${accent}`}>{clean(p.link)}</span>}
              </div>
              {p.technologies.length > 0 && <p className="text-[11px] font-medium text-slate-600">Tech: {p.technologies.join(', ')}</p>}
              {p.description && <p className="text-xs text-slate-700">{p.description}</p>}
            </div>
          ))}
        </div>
      )}
      {d.education.some((e) => e.institution || e.degree) && (
        <div className="space-y-2">
          <H>Education</H>
          {d.education.filter((e) => e.institution || e.degree).map((e, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs font-bold">
                <span>{e.institution}</span>
                <span className="font-mono font-semibold text-slate-600">{e.grade}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-700">
                <span>{[e.degree, e.fieldOfStudy].filter(Boolean).join(' in ')}</span>
                <span className="font-mono text-[10px] text-slate-500">{[e.startDate, e.endDate].filter(Boolean).join(' – ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {d.certifications.length > 0 && (
        <div className="space-y-1">
          <H>Certifications</H>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700">
            {d.certifications.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-100 dark:text-slate-800" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${score} 100`} style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-slate-900 dark:text-white">{score}</span>
        <span className="text-[9px] font-bold uppercase text-slate-400">of 100</span>
      </span>
    </div>
  );
};

export const ResumeBuilder: React.FC = () => {
  const [data, setData] = useState<ResumeData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<Template>('MODERN');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [versionName, setVersionName] = useState('');
  const [saved, setSaved] = useState<Saved[]>([]);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<'EDIT' | 'REVIEW' | 'VERSIONS'>('EDIT');
  const [busy, setBusy] = useState<'' | 'upload' | 'save' | 'review' | 'match'>('');
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [job, setJob] = useState({ title: '', company: '', text: '' });
  const [match, setMatch] = useState<ATSAnalysis | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Saved | null>(null);
  const [skillDraft, setSkillDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const say = (text: string, ok = true) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 4000);
  };
  const update = (patch: Partial<ResumeData>) => {
    setData((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setItem = <K extends 'experience' | 'education' | 'projects'>(key: K, i: number, patch: Partial<ResumeData[K][number]>) =>
    update({ [key]: (data[key] as any[]).map((x, j) => (j === i ? { ...x, ...patch } : x)) } as any);
  const removeItem = (key: 'experience' | 'education' | 'projects', i: number) => update({ [key]: (data[key] as any[]).filter((_, j) => j !== i) } as any);

  const openVersion = (r: Saved) => {
    setData(normalize(r.data));
    setTemplate(r.template || 'MODERN');
    setCurrentId(r._id);
    setVersionName(r.versionName);
    setDirty(false);
    setReview(null);
    setMatch(null);
    setTargetRole(r.data?.headline || '');
    setTab('EDIT');
  };

  const loadSaved = () =>
    api.get('/resumes').then((res: any) => {
      const list: Saved[] = res.data.resumes || [];
      setSaved(list);
      return list;
    });

  useEffect(() => {
    loadSaved()
      .then(async (list) => {
        const start = list.find((r) => r.isDefault) || list[0];
        if (start) return openVersion(start);
        const res: any = await api.get('/resumes/starter');
        setData(normalize(res.data.resume));
        setTargetRole(res.data.resume.headline || '');
      })
      .catch((e: any) => say(e.message, false))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return say('The file is bigger than 5 MB', false);
    setBusy('upload');
    try {
      const form = new FormData();
      form.append('file', file);
      const res: any = await api.post('/resumes/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const d = normalize(res.data.resume);
      setData(d);
      setTargetRole(d.headline);
      setCurrentId(null);
      setVersionName(file.name.replace(/\.[^.]+$/, ''));
      setDirty(true);
      setReview(null);
      setTab('EDIT');
      say('Your resume was read by the AI. Check the details, then press Save.');
    } catch (e: any) {
      say(e.message, false);
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (asNew: boolean) => {
    if (!data.fullName.trim()) return say('Add your name first', false);
    setBusy('save');
    try {
      const name = versionName.trim() || `${data.headline || 'My'} resume`;
      const body = { data, template, versionName: name, title: `${data.fullName} - Resume` };
      const res: any =
        currentId && !asNew ? await api.put(`/resumes/${currentId}`, body) : await api.post('/resumes/generate', { ...body, isDefault: saved.length === 0 });
      setCurrentId(res.data.resume._id);
      setVersionName(res.data.resume.versionName);
      setDirty(false);
      await loadSaved();
      say(asNew || !currentId ? 'Saved as a new version' : 'Changes saved');
    } catch (e: any) {
      say(e.message, false);
    } finally {
      setBusy('');
    }
  };

  const runReview = async () => {
    setBusy('review');
    setReview(null);
    try {
      const res: any = await api.post('/resumes/review', { data, targetRole });
      setReview(res.data.review);
    } catch (e: any) {
      say(e.message, false);
    } finally {
      setBusy('');
    }
  };

  const runMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('match');
    setMatch(null);
    try {
      const res: any = await api.post('/resumes/analyze', { data, resumeId: currentId, jobDescriptionText: job.text, jobTitle: job.title, companyName: job.company });
      setMatch(res.data.analysis);
    } catch (err: any) {
      say(err.message, false);
    } finally {
      setBusy('');
    }
  };

  // One-click fixes from the AI review
  const addSkill = (s: string) => {
    if (data.skills.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    update({ skills: [...data.skills, s] });
    say(`Added “${s}” to your skills`);
  };
  const applyRewrite = (before: string, after: string) => {
    const swap = (t: string) => (t.includes(before) ? t.split(before).join(after) : t);
    const next: ResumeData = {
      ...data,
      summary: swap(data.summary),
      experience: data.experience.map((e) => ({ ...e, description: swap(e.description), highlights: e.highlights.map((h) => (h.trim() === before.trim() ? after : swap(h))) })),
      projects: data.projects.map((p) => ({ ...p, description: swap(p.description) })),
    };
    if (JSON.stringify(next) === JSON.stringify(data)) return say('That line was already changed. Edit it by hand if you still want it.', false);
    setData(next);
    setDirty(true);
    say('Line updated in your resume');
  };

  const removeVersion = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/resumes/${confirmDelete._id}`);
      if (confirmDelete._id === currentId) {
        setCurrentId(null);
        setDirty(true);
      }
      setConfirmDelete(null);
      await loadSaved();
      say('Version deleted');
    } catch (e: any) {
      say(e.message, false);
    }
  };
  const makeDefault = async (r: Saved) => {
    try {
      await api.put(`/resumes/${r._id}`, { isDefault: true });
      await loadSaved();
      say(`“${r.versionName}” is now your main resume`);
    } catch (e: any) {
      say(e.message, false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const tabBtn = (k: typeof tab, label: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setTab(k)}
      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${tab === k ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 pb-12">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .printable-resume, .printable-resume * { visibility: visible !important; }
          .printable-resume { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; min-height: 297mm !important;
            padding: 15mm !important; margin: 0 !important; box-shadow: none !important; border: none !important; background: #fff !important; color: #0f172a !important; transform: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            <Sparkles className="h-6 w-6 text-brand-500" /> Resume AI Builder
          </h1>
          <p className="text-xs text-slate-500">Upload your resume or fill it in, edit it with a live A4 preview, and let the AI review it.</p>
        </div>
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
          {tabBtn('EDIT', <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Edit & preview</span>)}
          {tabBtn('REVIEW', <span className="flex items-center gap-1.5"><Wand2 className="h-3.5 w-3.5" /> AI analysis</span>)}
          {tabBtn('VERSIONS', <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> Saved ({saved.length})</span>)}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy === 'upload'}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-brand-600 px-4 py-2 text-xs font-bold text-white shadow-md disabled:opacity-60"
          >
            {busy === 'upload' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy === 'upload' ? 'AI is reading your resume…' : 'Upload my resume (PDF / Word)'}
          </button>
          <span className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
          {(['CLASSIC', 'MODERN', 'TECHNICAL', 'MINIMAL'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTemplate(t);
                setDirty(true);
              }}
              className={`rounded-xl px-3 py-1.5 text-[11px] font-bold ${template === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'}`}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${inputCls} !w-44`} value={versionName} onChange={(e) => setVersionName(e.target.value)} placeholder="Version name" aria-label="Version name" />
          {dirty && <span className="text-[11px] font-semibold text-amber-600">Unsaved changes</span>}
          <button type="button" onClick={() => save(false)} disabled={busy === 'save'} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60">
            <Save className="h-4 w-4" /> {currentId ? 'Save' : 'Save resume'}
          </button>
          {currentId && (
            <button type="button" onClick={() => save(true)} disabled={busy === 'save'} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
              Save as new
            </button>
          )}
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-brand-700">
            <Printer className="h-4 w-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* EDIT + PREVIEW */}
      <div className={tab === 'EDIT' ? 'grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(380px,460px)_1fr]' : 'hidden'}>
        <div className="space-y-4">
          <Section icon={User} title="Personal details">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="rb-name">Full name</label>
                <input id="rb-name" className={inputCls} value={data.fullName} onChange={(e) => update({ fullName: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls} htmlFor="rb-headline">Role you want (headline)</label>
                <input id="rb-headline" className={inputCls} value={data.headline} onChange={(e) => update({ headline: e.target.value })} placeholder="e.g. Data Analyst" />
              </div>
              {(
                [
                  ['email', 'Email', 'you@gmail.com'],
                  ['phone', 'Phone', '98xxxxxxxx'],
                  ['location', 'City', 'Bengaluru'],
                  ['linkedInUrl', 'LinkedIn', 'linkedin.com/in/…'],
                  ['githubUrl', 'GitHub', 'github.com/…'],
                  ['portfolioUrl', 'Portfolio / website', 'optional'],
                ] as const
              ).map(([k, l, ph]) => (
                <div key={k}>
                  <label className={labelCls} htmlFor={`rb-${k}`}>{l}</label>
                  <input id={`rb-${k}`} className={inputCls} value={data[k]} onChange={(e) => update({ [k]: e.target.value } as any)} placeholder={ph} />
                </div>
              ))}
            </div>
          </Section>

          <Section icon={FileText} title="Professional summary">
            <textarea rows={4} className={inputCls} value={data.summary} onChange={(e) => update({ summary: e.target.value })} placeholder="2–3 sentences about you, your skills and the role you want. Tip: the AI analysis writes one for you." />
          </Section>

          <Section icon={Star} title="Skills">
            <div className="flex flex-wrap gap-1.5">
              {data.skills.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                  {s}
                  <button type="button" aria-label={`Remove ${s}`} onClick={() => update({ skills: data.skills.filter((x) => x !== s) })} className="rounded-full hover:text-rose-600">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {data.skills.length === 0 && <span className="text-[11px] text-slate-400">No skills yet</span>}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const add = csv(skillDraft).filter((s) => !data.skills.some((x) => x.toLowerCase() === s.toLowerCase()));
                if (add.length) update({ skills: [...data.skills, ...add] });
                setSkillDraft('');
              }}
            >
              <input className={inputCls} value={skillDraft} onChange={(e) => setSkillDraft(e.target.value)} placeholder="Type a skill and press Enter (or several, separated by commas)" aria-label="Add skill" />
              <button type="submit" className="rounded-xl bg-brand-600 px-3 text-xs font-bold text-white">
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </Section>

          <Section
            icon={Briefcase}
            title="Experience / internships"
            action={
              <button type="button" onClick={() => update({ experience: [...data.experience, newExp()] })} className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            }
          >
            {data.experience.length === 0 && <p className="text-[11px] text-slate-400">Freshers can skip this, or add internships and training.</p>}
            {data.experience.map((e, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} value={e.role} onChange={(ev) => setItem('experience', i, { role: ev.target.value })} placeholder="Role" aria-label="Role" />
                  <input className={inputCls} value={e.company} onChange={(ev) => setItem('experience', i, { company: ev.target.value })} placeholder="Company" aria-label="Company" />
                  <input className={inputCls} value={e.startDate} onChange={(ev) => setItem('experience', i, { startDate: ev.target.value })} placeholder="From (Jun 2024)" aria-label="From" />
                  <input className={inputCls} value={e.endDate} onChange={(ev) => setItem('experience', i, { endDate: ev.target.value })} placeholder="To (Present)" aria-label="To" />
                </div>
                <input className={inputCls} value={e.description} onChange={(ev) => setItem('experience', i, { description: ev.target.value })} placeholder="One line about the work" aria-label="Description" />
                <textarea rows={3} className={inputCls} value={e.highlights.join('\n')} onChange={(ev) => setItem('experience', i, { highlights: ev.target.value.split(/\r?\n/) })} onBlur={(ev) => setItem('experience', i, { highlights: listFromText(ev.target.value) })} placeholder="Achievements, one per line" aria-label="Achievements" />
                <button type="button" onClick={() => removeItem('experience', i)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            ))}
          </Section>

          <Section
            icon={FolderOpen}
            title="Projects"
            action={
              <button type="button" onClick={() => update({ projects: [...data.projects, newProj()] })} className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            }
          >
            {data.projects.length === 0 && <p className="text-[11px] text-slate-400">Add the projects you built during training.</p>}
            {data.projects.map((p, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <input className={inputCls} value={p.title} onChange={(ev) => setItem('projects', i, { title: ev.target.value })} placeholder="Project title" aria-label="Project title" />
                <input className={inputCls} value={p.technologies.join(', ')} onChange={(ev) => setItem('projects', i, { technologies: csv(ev.target.value) })} placeholder="Tools used, separated by commas" aria-label="Tools used" />
                <input className={inputCls} value={p.link} onChange={(ev) => setItem('projects', i, { link: ev.target.value })} placeholder="Link (GitHub / dashboard), optional" aria-label="Project link" />
                <textarea rows={2} className={inputCls} value={p.description} onChange={(ev) => setItem('projects', i, { description: ev.target.value })} placeholder="What it does and what you did" aria-label="Project description" />
                <button type="button" onClick={() => removeItem('projects', i)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            ))}
          </Section>

          <Section
            icon={GraduationCap}
            title="Education"
            action={
              <button type="button" onClick={() => update({ education: [...data.education, newEdu()] })} className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600">
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            }
          >
            {data.education.map((e, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <input className={inputCls} value={e.institution} onChange={(ev) => setItem('education', i, { institution: ev.target.value })} placeholder="College / university" aria-label="College" />
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputCls} value={e.degree} onChange={(ev) => setItem('education', i, { degree: ev.target.value })} placeholder="Degree (B.Tech)" aria-label="Degree" />
                  <input className={inputCls} value={e.fieldOfStudy} onChange={(ev) => setItem('education', i, { fieldOfStudy: ev.target.value })} placeholder="Branch (CSE)" aria-label="Branch" />
                  <input className={inputCls} value={e.startDate} onChange={(ev) => setItem('education', i, { startDate: ev.target.value })} placeholder="From (2021)" aria-label="From year" />
                  <input className={inputCls} value={e.endDate} onChange={(ev) => setItem('education', i, { endDate: ev.target.value })} placeholder="To (2025)" aria-label="To year" />
                </div>
                <input className={inputCls} value={e.grade} onChange={(ev) => setItem('education', i, { grade: ev.target.value })} placeholder="CGPA / percentage" aria-label="Grade" />
                <button type="button" onClick={() => removeItem('education', i)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
              </div>
            ))}
          </Section>

          <Section icon={CheckCircle2} title="Certifications">
            <textarea rows={3} className={inputCls} value={data.certifications.join('\n')} onChange={(e) => update({ certifications: e.target.value.split(/\r?\n/) })} onBlur={(e) => update({ certifications: listFromText(e.target.value) })} placeholder="One per line, e.g. ScholarLogic Data Analytics (2026)" aria-label="Certifications" />
          </Section>
        </div>

        <div className="overflow-x-auto rounded-3xl bg-slate-200 p-4 dark:bg-slate-950 md:p-8">
          <div className="flex justify-center">
            <ResumePaper d={data} template={template} />
          </div>
        </div>
      </div>

      {/* AI ANALYSIS */}
      {tab === 'REVIEW' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <Wand2 className="h-5 w-5 text-violet-500" /> AI resume review
              </h3>
              <p className="text-xs text-slate-500">The AI reads your resume like a recruiter: a score, what's good, what to fix, and changes you can apply in one click.</p>
              <div className="flex gap-2">
                <input className={inputCls} value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Role you are applying for (e.g. Data Analyst)" aria-label="Target role" />
                <button type="button" onClick={runReview} disabled={busy === 'review'} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-brand-600 px-4 text-xs font-bold text-white shadow-md disabled:opacity-60">
                  {busy === 'review' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {busy === 'review' ? 'Reviewing…' : 'Analyse my resume'}
                </button>
              </div>
            </div>

            {busy === 'review' && (
              <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300">
                <Loader2 className="h-5 w-5 animate-spin" /> The AI is reading your resume. This takes about 15 seconds…
              </div>
            )}

            {review && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-4">
                  <ScoreRing score={review.score} />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">Resume score</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{review.verdict}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {review.sections.map((s) => (
                    <div key={s.name} className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
                      <div className="flex justify-between text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        <span>{s.name}</span>
                        <span>{s.score}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className={`h-full rounded-full ${s.score >= 75 ? 'bg-emerald-500' : s.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${s.score}%` }} />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">{s.comment}</p>
                    </div>
                  ))}
                </div>
                {review.strengths.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">What's good</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-700 dark:text-slate-300">
                      {review.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">What to fix</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-700 dark:text-slate-300">
                    {review.improvements.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  {review.missingSections.length > 0 && <p className="mt-2 text-[11px] text-rose-600">Missing: {review.missingSections.join(', ')}</p>}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {review && (
              <div className="space-y-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-brand-50 p-5 dark:border-violet-900 dark:from-violet-950/30 dark:to-brand-950/20">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Sparkles className="h-4 w-4 text-violet-500" /> One-click improvements
                </p>
                {review.improvedSummary && (
                  <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Better summary</p>
                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">{review.improvedSummary}</p>
                    <button
                      type="button"
                      onClick={() => {
                        update({ summary: review.improvedSummary });
                        say('Summary updated');
                      }}
                      className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white"
                    >
                      Use this summary
                    </button>
                  </div>
                )}
                {review.bulletRewrites.map((b, i) => (
                  <div key={i} className="rounded-xl bg-white p-3 dark:bg-slate-900">
                    <p className="text-[11px] text-slate-400 line-through">{b.before}</p>
                    <p className="mt-1 text-xs font-medium text-slate-800 dark:text-slate-200">{b.after}</p>
                    <button type="button" onClick={() => applyRewrite(b.before, b.after)} className="mt-2 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white">
                      Apply
                    </button>
                  </div>
                ))}
                {review.suggestedSkills.length > 0 && (
                  <div className="rounded-xl bg-white p-3 dark:bg-slate-900">
                    <p className="text-[10px] font-bold uppercase text-slate-500">Skills worth adding (only if you know them)</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {review.suggestedSkills.map((s) => (
                        <button key={s} type="button" onClick={() => addSkill(s)} className="inline-flex items-center gap-1 rounded-full border border-violet-200 px-2.5 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300">
                          <Plus className="h-3 w-3" /> {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500">Changes go into your resume on the Edit tab. Press Save to keep them.</p>
              </div>
            )}

            <form onSubmit={runMatch} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <Target className="h-5 w-5 text-brand-500" /> Match with a job (ATS)
              </h3>
              <p className="text-xs text-slate-500">Paste a job description to see how well your resume matches it.</p>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} value={job.title} onChange={(e) => setJob({ ...job, title: e.target.value })} placeholder="Job title" aria-label="Job title" />
                <input className={inputCls} value={job.company} onChange={(e) => setJob({ ...job, company: e.target.value })} placeholder="Company" aria-label="Company" />
              </div>
              <textarea rows={5} className={inputCls} value={job.text} onChange={(e) => setJob({ ...job, text: e.target.value })} placeholder="Paste the job description here" aria-label="Job description" required />
              <button type="submit" disabled={busy === 'match'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white disabled:opacity-60">
                {busy === 'match' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                {busy === 'match' ? 'Matching…' : 'Check my match'}
              </button>
              {match && (
                <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <ScoreRing score={match.atsScore} />
                    <p className="text-xs text-slate-600 dark:text-slate-300">Match with {job.title || 'this job'}{job.company ? ` at ${job.company}` : ''}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
                      <p className="font-bold text-emerald-800 dark:text-emerald-300">You have ({match.matchedSkills?.length || 0})</p>
                      <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">{match.matchedSkills?.join(', ') || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
                      <p className="font-bold text-amber-800 dark:text-amber-300">Missing ({match.missingSkills?.length || 0})</p>
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">{match.missingSkills?.join(', ') || '—'}</p>
                    </div>
                  </div>
                  {match.contentImprovements?.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-700 dark:text-slate-300">
                      {match.contentImprovements.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* SAVED VERSIONS */}
      {tab === 'VERSIONS' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {saved.length === 0 && <p className="text-sm text-slate-500">No saved versions yet. Press “Save resume” on the Edit tab.</p>}
          {saved.map((r) => (
            <div key={r._id} className={`space-y-3 rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${r._id === currentId ? 'border-brand-400' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">{r.template}</span>
                <span className="text-[10px] text-slate-400">{new Date(r.updatedAt).toLocaleDateString('en-IN')}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{r.versionName}</h3>
                <p className="text-xs text-slate-500">{r.data?.headline || r.title}</p>
                {r.isDefault && <p className="mt-1 text-[11px] font-bold text-emerald-600">★ Main resume</p>}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button type="button" onClick={() => openVersion(r)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white">
                  Open & edit
                </button>
                {!r.isDefault && (
                  <button type="button" onClick={() => makeDefault(r)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    Make main
                  </button>
                )}
                <button type="button" onClick={() => setConfirmDelete(r)} className="ml-auto rounded-lg px-2 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Print source when another tab is open */}
      {tab !== 'EDIT' && (
        <div className="hidden print:block">
          <ResumePaper d={data} template={template} />
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={() => setConfirmDelete(null)}>
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900" onMouseDown={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-slate-900 dark:text-white">Delete “{confirmDelete.versionName}”?</p>
            <p className="mt-1 text-xs text-slate-500">This saved version is removed for good.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                Keep it
              </button>
              <button type="button" onClick={removeVersion} className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-xl ${toast.ok ? 'bg-slate-900' : 'bg-rose-600'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
};
