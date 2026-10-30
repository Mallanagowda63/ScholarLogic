import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { CheckCircle2, ClipboardPaste, Link2, MousePointerClick, Pencil, PlusCircle, Search, Send, Trash2, Users, XCircle } from 'lucide-react';
import { Card, ErrorNote, Field, Modal, PageHeader, Spinner, inputClass, primaryBtn, secondaryBtn, useToast } from '../admin/tracking/shared';
import { parseJobPost } from './jobPostParser';
import { LinkedInLogo, ScholarLogicLogo, isLinkedInJob } from '../../components/JobSourceLogo';

// Placement team: post a job by pasting the whole post; see who opened the company link and who finished applying

const toDateInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const isOpen = (j: any) => j.status === 'OPEN' && new Date(j.deadline).getTime() > Date.now();

type Source = 'SCHOLARLOGIC' | 'LINKEDIN';
type Form = { post: string; companyName: string; title: string; applyUrl: string; deadline: string; source: Source };
const EMPTY: Form = { post: '', companyName: '', title: '', applyUrl: '', deadline: '', source: 'SCHOLARLOGIC' };

export const PlacementJobs: React.FC = () => {
  const toast = useToast();
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [q, setQ] = useState('');

  // New job
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Edit / delete an existing job
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', applyUrl: '', deadline: '', status: 'OPEN', source: 'SCHOLARLOGIC' as Source });
  const [deleting, setDeleting] = useState<any | null>(null);

  const load = () =>
    Promise.all([api.get('/placements/jobs'), api.get('/placements/companies')])
      .then(([j, c]: any) => {
        setJobs(j.data.jobs || []);
        setCompanies(c.data.companies || []);
      })
      .catch((e: any) => toast.show(e.message));
  useEffect(() => {
    load();
  }, []);

  const found = useMemo(() => parseJobPost(form.post), [form.post]);

  // Pasting fills every box the placement team hasn't typed in themselves
  const onPost = (post: string) => {
    const p = parseJobPost(post);
    setForm((f) => ({
      post,
      companyName: touched.companyName ? f.companyName : p.companyName,
      title: touched.title ? f.title : p.title,
      applyUrl: touched.applyUrl ? f.applyUrl : p.applyUrl,
      deadline: touched.deadline ? f.deadline : p.deadline,
      source: touched.source ? f.source : /linkedin\.com/i.test(post) ? 'LINKEDIN' : 'SCHOLARLOGIC',
    }));
  };
  const setField = (key: keyof Form, value: string) => {
    setTouched((t) => ({ ...t, [key]: true }));
    setForm((f) => ({ ...f, [key]: value }));
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const typed = form.companyName.trim();
      const known = companies.find((c) => c.name.trim().toLowerCase() === typed.toLowerCase());
      await api.post('/placements/jobs', {
        title: form.title.trim(),
        ...(known ? { companyId: known._id } : { companyName: typed }),
        description: form.post.trim(),
        applyUrl: form.applyUrl.trim(),
        ...(form.deadline ? { deadline: `${form.deadline}T23:59:59` } : {}),
        location: found.location,
        salaryPackage: found.salaryPackage,
        requiredSkills: found.requiredSkills,
        type: found.type,
        source: form.source,
      });
      setPosting(false);
      setForm(EMPTY);
      setTouched({});
      toast.show('Job posted. Students can see it now.');
      load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (j: any) => {
    setEditing(j);
    setEditForm({ title: j.title, description: j.description, applyUrl: j.applyUrl || '', deadline: toDateInput(j.deadline), status: j.status === 'OPEN' ? 'OPEN' : 'CLOSED', source: isLinkedInJob(j) ? 'LINKEDIN' : 'SCHOLARLOGIC' });
    setFormError('');
  };
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError('');
    try {
      await api.put(`/placements/jobs/${editing._id}`, {
        title: editForm.title,
        description: editForm.description,
        applyUrl: editForm.applyUrl.trim(),
        status: editForm.status,
        source: editForm.source,
        ...(editForm.deadline ? { deadline: `${editForm.deadline}T23:59:59` } : {}),
      });
      setEditing(null);
      toast.show('Job updated');
      load();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res: any = await api.delete(`/placements/jobs/${deleting._id}`);
      setJobs((list) => (list || []).filter((j) => j._id !== deleting._id));
      setDeleting(null);
      toast.show(res.message);
    } catch (err: any) {
      toast.show(err.message);
    } finally {
      setBusy(false);
    }
  };

  const term = q.trim().toLowerCase();
  const visible = (jobs || []).filter((j) => !term || `${j.title} ${j.companyId?.name || ''}`.toLowerCase().includes(term));
  const newCompany = form.companyName.trim() && !companies.some((c) => c.name.trim().toLowerCase() === form.companyName.trim().toLowerCase());

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Job Postings"
        subtitle="Paste a job post to publish it. For company-website and Google Form links you see who opened the link and who finished applying."
        action={
          <button type="button" className={primaryBtn} onClick={() => setPosting(true)}>
            <PlusCircle className="h-4 w-4" /> Post a job
          </button>
        }
      />

      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="job-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search job or company" />
      </label>

      {!jobs ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">{jobs.length ? 'No job matches your search.' : 'No jobs yet. Click "Post a job" and paste the job post.'}</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((j) => {
            const s = j.linkStats || { clicks: 0, students: 0, completed: 0, notCompleted: 0, portal: 0 };
            const open = isOpen(j);
            return (
              <Card key={j._id} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {isLinkedInJob(j) ? (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[#0A66C2]/10 px-2 py-0.5 text-[10px] font-bold text-[#0A66C2]">
                        <LinkedInLogo className="h-3.5 w-3.5" /> From LinkedIn
                      </span>
                    ) : (
                      <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                        <ScholarLogicLogo className="h-3.5 w-3.5" /> ScholarLogic
                      </span>
                    )}
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{j.title}</h3>
                    <p className="text-xs font-semibold text-slate-500">{j.companyId?.name || 'Company'}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      open ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                    }`}
                  >
                    {open ? `Open till ${new Date(j.deadline).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : 'Closed'}
                  </span>
                </div>

                {j.applyUrl ? (
                  <>
                    <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" className="truncate text-brand-600 hover:underline">
                        {j.applyUrl}
                      </a>
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-sky-50 p-2 dark:bg-sky-950/40">
                        <MousePointerClick className="mx-auto h-4 w-4 text-sky-600" />
                        <p className="font-extrabold text-sky-700 dark:text-sky-300">{s.students}</p>
                        <p className="text-[10px] font-semibold text-slate-500">opened link{s.clicks > s.students ? ` (${s.clicks} clicks)` : ''}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 p-2 dark:bg-emerald-950/40">
                        <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                        <p className="font-extrabold text-emerald-700 dark:text-emerald-300">{s.completed}</p>
                        <p className="text-[10px] font-semibold text-slate-500">completed</p>
                      </div>
                      <div className="rounded-xl bg-amber-50 p-2 dark:bg-amber-950/40">
                        <XCircle className="mx-auto h-4 w-4 text-amber-600" />
                        <p className="font-extrabold text-amber-700 dark:text-amber-300">{s.notCompleted}</p>
                        <p className="text-[10px] font-semibold text-slate-500">not completed</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="flex items-center gap-1.5 rounded-xl bg-slate-50 p-2 text-[11px] text-slate-500 dark:bg-slate-800/60">
                    <Send className="h-3.5 w-3.5 text-brand-600" /> Students apply through the ScholarLogic form • <b>{s.portal}</b> applied
                  </p>
                )}

                <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Link to={`/placement/applications?jobId=${j._id}`} className={`${secondaryBtn} !px-2.5 !py-1 text-xs`}>
                    <Users className="h-3.5 w-3.5" /> Students
                  </Link>
                  <button type="button" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`} onClick={() => openEdit(j)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${j.title}`}
                    onClick={() => setDeleting(j)}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-600 hover:text-white dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {posting && (
        <Modal title="Post a job" subtitle="Copy the whole job post (WhatsApp, LinkedIn, email, careers page) and paste it below." onClose={() => setPosting(false)} wide>
          <ErrorNote text={formError} />
          <form onSubmit={publish} className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">Where is this job from?</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['SCHOLARLOGIC', 'ScholarLogic', <ScholarLogicLogo key="s" className="h-5 w-5" />],
                  ['LINKEDIN', 'LinkedIn', <LinkedInLogo key="l" className="h-5 w-5" />],
                ] as const).map(([value, label, logo]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setField('source', value)}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${
                      form.source === value
                        ? value === 'LINKEDIN'
                          ? 'border-[#0A66C2] bg-[#0A66C2]/10 text-[#0A66C2]'
                          : 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {logo} {label}
                  </button>
                ))}
              </div>
              {form.source === 'LINKEDIN' && <p className="mt-1 text-[11px] text-slate-500">Students see it under the "From LinkedIn" tab.</p>}
            </div>
            <Field label="Paste the full job post" required>
              <textarea
                id="job-post"
                rows={9}
                className={inputClass}
                value={form.post}
                onChange={(e) => onPost(e.target.value)}
                placeholder={'Example:\nThe Wedding Company is hiring – Backend Engineering Intern\nLocation: Bangalore\nStipend: 25,000/month\nLast date: 5 Nov 2026\nApply: https://forms.gle/...'}
                required
                autoFocus
              />
            </Field>

            {form.post.trim() && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
                <ClipboardPaste className="h-3.5 w-3.5" /> Filled from your post. Check these and correct anything that's wrong:
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Company" required hint={newCompany ? 'New company, added when you post' : undefined}>
                <input id="job-company" list="job-company-list" className={inputClass} value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} autoComplete="off" required />
                <datalist id="job-company-list">
                  {companies.map((c) => (
                    <option key={c._id} value={c.name} />
                  ))}
                </datalist>
              </Field>
              <Field label="Job title" required>
                <input id="job-title" className={inputClass} value={form.title} onChange={(e) => setField('title', e.target.value)} required />
              </Field>
              <Field label="Apply link" hint="Company website or Google Form. Empty = ScholarLogic form">
                <input id="job-link" className={inputClass} value={form.applyUrl} onChange={(e) => setField('applyUrl', e.target.value)} placeholder="https://" />
              </Field>
              <Field label="Last date to apply" hint="Empty = 30 days from today">
                <input id="job-deadline" type="date" className={inputClass} value={form.deadline} onChange={(e) => setField('deadline', e.target.value)} />
              </Field>
            </div>
            {(found.location || found.salaryPackage || found.type === 'INTERNSHIP') && (
              <p className="text-[11px] text-slate-500">
                Also found:{' '}
                {[found.type === 'INTERNSHIP' && 'Internship', found.location && `📍 ${found.location}`, found.salaryPackage && `💰 ${found.salaryPackage}`].filter(Boolean).join('  •  ')}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryBtn} onClick={() => setPosting(false)}>
                Cancel
              </button>
              <button type="submit" className={primaryBtn} disabled={busy}>
                {busy ? 'Posting…' : 'Post job'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title="Edit job" subtitle={editing.companyId?.name} onClose={() => setEditing(null)} wide>
          <ErrorNote text={formError} />
          <form onSubmit={saveEdit} className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">Where is this job from?</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['SCHOLARLOGIC', 'ScholarLogic', <ScholarLogicLogo key="s" className="h-5 w-5" />],
                  ['LINKEDIN', 'LinkedIn', <LinkedInLogo key="l" className="h-5 w-5" />],
                ] as const).map(([value, label, logo]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, source: value }))}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${
                      editForm.source === value
                        ? value === 'LINKEDIN'
                          ? 'border-[#0A66C2] bg-[#0A66C2]/10 text-[#0A66C2]'
                          : 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {logo} {label}
                  </button>
                ))}
              </div>
              {editForm.source === 'LINKEDIN' && <p className="mt-1 text-[11px] text-slate-500">Students see it under the "From LinkedIn" tab.</p>}
            </div>
            <Field label="Job title" required>
              <input id="edit-title" className={inputClass} value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Apply link" hint="Empty = ScholarLogic form">
                <input id="edit-link" className={inputClass} value={editForm.applyUrl} onChange={(e) => setEditForm((f) => ({ ...f, applyUrl: e.target.value }))} />
              </Field>
              <Field label="Last date to apply">
                <input id="edit-deadline" type="date" className={inputClass} value={editForm.deadline} onChange={(e) => setEditForm((f) => ({ ...f, deadline: e.target.value }))} />
              </Field>
              <Field label="Status">
                <select id="edit-status" className={inputClass} value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="OPEN">Open</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </Field>
            </div>
            <Field label="Job post" required>
              <textarea id="edit-post" rows={8} className={inputClass} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} required />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryBtn} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className={primaryBtn} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title={`Delete ${deleting.title}?`} subtitle={`${deleting.companyId?.name || ''} • This cannot be undone`} onClose={() => !busy && setDeleting(null)}>
          <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            Students will no longer see this job, and its applications are removed too.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" className={secondaryBtn} disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> {busy ? 'Deleting…' : 'Delete job'}
            </button>
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
};
