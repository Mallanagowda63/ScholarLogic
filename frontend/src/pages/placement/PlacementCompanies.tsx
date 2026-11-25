import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Briefcase, ExternalLink, Globe, PlusCircle, Search, Trash2 } from 'lucide-react';
import { Card, ErrorNote, Field, Modal, PageHeader, Spinner, inputClass, primaryBtn, secondaryBtn, useToast } from '../admin/tracking/shared';

// Placement team: the companies students apply to. Companies are also added automatically when a job is posted.
export const PlacementCompanies: React.FC = () => {
  const toast = useToast();
  const [companies, setCompanies] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', website: '', officialCareersUrl: '', location: '' });
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .get('/placements/companies')
      .then((res: any) => setCompanies(res.data.companies || []))
      .catch((e: any) => toast.show(e.message));
  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      await api.post('/placements/companies', { ...form, name: form.name.trim() });
      setAdding(false);
      setForm({ name: '', website: '', officialCareersUrl: '', location: '' });
      toast.show('Company added');
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
      const res: any = await api.delete(`/placements/companies/${deleting._id}`);
      setCompanies((list) => (list || []).filter((c) => c._id !== deleting._id));
      setDeleting(null);
      toast.show(res.message);
    } catch (err: any) {
      toast.show(err.message);
    } finally {
      setBusy(false);
    }
  };

  const term = q.trim().toLowerCase();
  const visible = (companies || []).filter((c) => !term || `${c.name} ${c.location || ''}`.toLowerCase().includes(term));

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Companies"
        subtitle="Companies with job openings. A company is added automatically when you post a job for it."
        action={
          <button type="button" className={primaryBtn} onClick={() => setAdding(true)}>
            <PlusCircle className="h-4 w-4" /> Add company
          </button>
        }
      />

      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input id="company-search" className={`${inputClass} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company" />
      </label>

      {!companies ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">{companies.length ? 'No company matches your search.' : 'No companies yet. Post a job and its company appears here.'}</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const link = c.officialCareersUrl || c.website;
            return (
              <Card key={c._id} className="flex flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-black text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                    {c.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold text-slate-900 dark:text-white">{c.name}</h3>
                    {c.location && c.location !== 'India' && <p className="truncate text-xs text-slate-500">{c.location}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    ['Jobs', c.openPositionsCount || 0, 'text-slate-900 dark:text-white'],
                    ['Applied', c.scholarlogicApplicationsCount || 0, 'text-brand-600'],
                    ['Offers', c.offersCount || 0, 'text-emerald-600'],
                  ].map(([l, v, tone]) => (
                    <div key={String(l)} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                      <span className="block text-[10px] font-bold text-slate-400">{l}</span>
                      <span className={`font-extrabold ${tone}`}>{v}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:underline">
                      <Globe className="h-3.5 w-3.5" /> Careers page <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-2">
                    <Link to="/placement/jobs" className={`${secondaryBtn} !px-2.5 !py-1 text-xs`}>
                      <Briefcase className="h-3.5 w-3.5" /> Jobs
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete ${c.name}`}
                      onClick={() => setDeleting(c)}
                      className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-600 hover:text-white dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {adding && (
        <Modal title="Add company" subtitle="Only the name is needed." onClose={() => setAdding(false)}>
          <ErrorNote text={formError} />
          <form onSubmit={add} className="space-y-3">
            <Field label="Company name" required>
              <input id="co-name" className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
            </Field>
            <Field label="Careers page link" hint="Optional">
              <input id="co-careers" className={inputClass} value={form.officialCareersUrl} onChange={(e) => setForm((f) => ({ ...f, officialCareersUrl: e.target.value }))} placeholder="https://company.com/careers" />
            </Field>
            <Field label="Location" hint="Optional">
              <input id="co-location" className={inputClass} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Bangalore" />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={secondaryBtn} onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button type="submit" className={primaryBtn} disabled={busy}>
                {busy ? 'Saving…' : 'Add company'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title={`Delete ${deleting.name}?`} subtitle="This cannot be undone" onClose={() => !busy && setDeleting(null)}>
          <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            This removes the company, its <b>{deleting.openPositionsCount || 0} job(s)</b> and every student application to them.
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
              <Trash2 className="h-4 w-4" /> {busy ? 'Deleting…' : 'Delete company'}
            </button>
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
};
