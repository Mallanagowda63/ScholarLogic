import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card, ErrorNote, Field, PageHeader, inputClass, primaryBtn } from './tracking/shared';

// Admin → My Account: the admin changes their own login email and password.
// Trainers, the placement team and students cannot change theirs; an admin resets those on Staff Access.

const strength = (pw: string) => {
  if (!pw) return null;
  const okLength = pw.length >= 10;
  const okMix = /[A-Za-z]/.test(pw) && /\d/.test(pw);
  const bonus = /[^A-Za-z0-9]/.test(pw) && pw.length >= 12;
  if (!okLength || !okMix) return { label: 'Too weak: at least 10 characters with letters and numbers', cls: 'text-rose-600', ok: false };
  return bonus ? { label: 'Strong', cls: 'text-emerald-600', ok: true } : { label: 'Good', cls: 'text-emerald-600', ok: true };
};

export const AdminAccount: React.FC = () => {
  const { user, login } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState(false);

  const s = strength(next);
  const emailChanged = email.trim().toLowerCase() !== (user?.email || '').toLowerCase();
  const canSave = !!current && (emailChanged || (!!next && !!s?.ok && next === confirm));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    if (next && next !== confirm) return setError('The two new passwords do not match');
    setSaving(true);
    try {
      const res: any = await api.put('/auth/my-credentials', {
        currentPassword: current,
        newEmail: emailChanged ? email.trim() : undefined,
        newPassword: next || undefined,
      });
      // Fresh session for this browser; other browsers signed in with the old password are signed out
      login(res.data.tokens.accessToken, { ...(user as any), ...res.data.user });
      setDone(res.message);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pwInput = (id: string, value: string, set: (v: string) => void, auto: string) => (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} className={`${inputClass} pr-10`} value={value} onChange={(e) => set(e.target.value)} autoComplete={auto} />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700" aria-label={show ? 'Hide passwords' : 'Show passwords'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  return (
    <div className="space-y-5 pb-12 max-w-2xl">
      <PageHeader title="My Account" subtitle="Change the email and password you use to log in as admin." />

      {done && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" /> {done}. Use the new details next time you log in.
        </div>
      )}
      <ErrorNote text={error} />

      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Login email">
            <input id="acct-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" hint="Leave empty to keep your current password">
              {pwInput('acct-new', next, setNext, 'new-password')}
            </Field>
            <Field label="Repeat new password">
              {pwInput('acct-confirm', confirm, setConfirm, 'new-password')}
            </Field>
          </div>
          {s && <p className={`-mt-2 text-xs font-semibold ${s.cls}`}>{s.label}</p>}
          {next && confirm && next !== confirm && <p className="-mt-2 text-xs font-semibold text-rose-600">The two new passwords do not match</p>}

          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <Field label="Current password" required hint="Needed to confirm it is you">
              {pwInput('acct-current', current, setCurrent, 'current-password')}
            </Field>
          </div>

          <div className="flex justify-end">
            <button type="submit" className={primaryBtn} disabled={!canSave || saving}>
              <KeyRound className="h-4 w-4" /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Card>

      <p className="text-xs text-slate-500">
        Changing the password signs you out everywhere else. Trainer and placement-team passwords are managed on <b>Staff Access</b>; they cannot change their own.
      </p>
    </div>
  );
};
