import React, { useEffect, useState } from 'react';
import { Lock, Save, UserRound } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card, ErrorNote, Field, PageHeader, Spinner, inputClass, primaryBtn } from '../admin/tracking/shared';

// My Profile for admins, trainers and the placement team: name and contact / work details.
// The login email and password are not editable here (an admin manages those).

type Role = 'ADMIN' | 'SUPER_ADMIN' | 'TRAINER' | 'PLACEMENT_MANAGER';
interface ProfileData {
  fullName: string;
  email: string;
  role: Role;
  profile: { phone: string; designation: string; department: string; specialization: string; experience: string; bio: string };
}

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', SUPER_ADMIN: 'Super admin', TRAINER: 'Trainer', PLACEMENT_MANAGER: 'Placement team' };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

export const StaffProfile: React.FC = () => {
  const { refreshUserData } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', designation: '', department: '', specialization: '', experience: '', bio: '' });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/auth/my-profile')
      .then((res: any) => {
        setData(res.data);
        setForm({ fullName: res.data.fullName, ...res.data.profile });
      })
      .catch((e: any) => setError(e.message));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved('');
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res: any = await api.put('/auth/my-profile', form);
      setData(res.data);
      setSaved('Profile saved');
      await refreshUserData(); // new name shows in the top bar right away
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return error ? <ErrorNote text={error} /> : <Spinner />;
  const isTrainer = data.role === 'TRAINER';

  return (
    <div className="space-y-5 pb-12 max-w-4xl">
      <PageHeader title="My Profile" subtitle="Your name and contact details. Your login email and password are managed by the admin." />

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="p-5 space-y-4 text-center h-fit">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-2xl font-extrabold text-white shadow-md">
            {initials(form.fullName || data.fullName)}
          </div>
          <div>
            <p className="text-lg font-extrabold text-slate-900 dark:text-white">{data.fullName}</p>
            <p className="text-xs font-bold text-brand-600 dark:text-brand-400">{data.profile.designation || ROLE_LABEL[data.role]}</p>
          </div>
          <dl className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-left text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Role</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">{ROLE_LABEL[data.role]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Login email</dt>
              <dd className="truncate font-mono text-slate-900 dark:text-white" title={data.email}>{data.email}</dd>
            </div>
            {data.profile.phone && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Phone</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{data.profile.phone}</dd>
              </div>
            )}
            {data.profile.department && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Department</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{data.profile.department}</dd>
              </div>
            )}
          </dl>
          {data.profile.bio && <p className="border-t border-slate-100 dark:border-slate-800 pt-3 text-left text-xs italic text-slate-500">{data.profile.bio}</p>}
        </Card>

        <Card className="p-5">
          <ErrorNote text={error} />
          {saved && <p className="mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{saved}</p>}
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <UserRound className="h-4 w-4 text-brand-600" /> Your details
            </div>
            <Field label="Full name" required>
              <input id="sp-name" className={inputClass} value={form.fullName} onChange={set('fullName')} required minLength={2} maxLength={80} />
            </Field>
            <Field label="Phone">
              <input id="sp-phone" className={inputClass} value={form.phone} onChange={set('phone')} inputMode="tel" maxLength={20} placeholder="+91 98765 43210" />
            </Field>
            <Field label="Designation">
              <input id="sp-designation" className={inputClass} value={form.designation} onChange={set('designation')} maxLength={80} placeholder={isTrainer ? 'e.g. Senior Trainer' : 'e.g. Placement Coordinator'} />
            </Field>
            <Field label="Department">
              <input id="sp-department" className={inputClass} value={form.department} onChange={set('department')} maxLength={80} />
            </Field>
            {isTrainer && (
              <>
                <Field label="Specialization">
                  <input id="sp-spec" className={inputClass} value={form.specialization} onChange={set('specialization')} maxLength={120} placeholder="e.g. Python, Power BI" />
                </Field>
                <Field label="Teaching experience">
                  <input id="sp-exp" className={inputClass} value={form.experience} onChange={set('experience')} maxLength={40} placeholder="e.g. 5 years" />
                </Field>
              </>
            )}
            <div className="sm:col-span-2">
              <Field label="About you" hint="Optional, up to 600 characters">
                <textarea id="sp-bio" className={inputClass} rows={3} value={form.bio} onChange={set('bio')} maxLength={600} />
              </Field>
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Lock className="h-3.5 w-3.5" /> Login email and password can only be changed by the admin.
              </p>
              <button type="submit" className={primaryBtn} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
