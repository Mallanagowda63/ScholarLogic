import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Trash2, Upload } from 'lucide-react';
import { api, assetUrl } from '../../services/api';
import { Card, ErrorNote, Field, Modal, PageHeader, Spinner, inputClass, primaryBtn, secondaryBtn, useToast } from './tracking/shared';

// Student dashboard banners. Used by admins (/admin/banners) and the placement team (/placement/banners).

interface Banner {
  _id: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
  updatedById?: { fullName: string } | null;
}

const BANNER_SIZE = '1257 × 360 px';

const BannerForm: React.FC<{ banner?: Banner; onClose: () => void; onDone: (msg: string) => void }> = ({ banner, onClose, onDone }) => {
  const [title, setTitle] = useState(banner?.title || '');
  const [isActive, setIsActive] = useState(banner?.isActive ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(assetUrl(banner?.imageUrl));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f?: File) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setError('Choose a PNG, JPG or WEBP image');
    if (f.size > 5 * 1024 * 1024) return setError('The image must be 5 MB or smaller');
    setError('');
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banner && !file) return setError('Choose a banner image');
    setSaving(true);
    setError('');
    const form = new FormData();
    form.append('title', title.trim());
    form.append('isActive', String(isActive));
    if (file) form.append('image', file);
    try {
      const headers = { 'Content-Type': 'multipart/form-data' };
      const res: any = banner ? await api.put(`/banners/${banner._id}`, form, { headers }) : await api.post('/banners', form, { headers });
      onDone(res.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={banner ? 'Edit banner' : 'Add banner'} subtitle={`Best size ${BANNER_SIZE} (wide). PNG, JPG or WEBP up to 5 MB.`} onClose={onClose} wide>
      <ErrorNote text={error} />
      <form onSubmit={submit} className="space-y-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0]);
          }}
          className="block w-full overflow-hidden rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-400"
        >
          {preview ? (
            <div className="relative aspect-[1257/360] w-full bg-gradient-to-b from-[#0b0660] to-[#3b00e6]">
              <img src={preview} alt="" className="h-full w-full object-contain" />
              <span className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-semibold text-white">
                {banner || file ? 'Click to replace image' : ''}
              </span>
            </div>
          ) : (
            <div className="flex aspect-[1257/360] w-full flex-col items-center justify-center gap-2 text-slate-500">
              <ImagePlus className="h-8 w-8" />
              <span className="text-xs font-semibold">Click or drop the banner image here</span>
            </div>
          )}
        </button>
        <input ref={input} id="banner-file" type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

        <Field label="Title" required hint="Shown to screen readers and in this list, e.g. who was placed, where and the package">
          <input id="banner-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ranjith Kumar placed at TCS, System Engineering, 7 LPA" required maxLength={200} />
        </Field>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <input id="banner-active" type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Show on the student dashboard
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={primaryBtn} disabled={saving}>
            <Upload className="h-3.5 w-3.5" /> {saving ? 'Saving…' : banner ? 'Save changes' : 'Add banner'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const AdminBanners: React.FC = () => {
  const toast = useToast();
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<{ kind: 'add' } | { kind: 'edit'; banner: Banner } | { kind: 'delete'; banner: Banner } | null>(null);
  const [busy, setBusy] = useState('');

  const load = () =>
    api
      .get('/banners/manage')
      .then((res: any) => setBanners(res.data.banners))
      .catch((e: any) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const done = (msg: string) => {
    setDialog(null);
    toast.show(msg);
    load();
  };

  const toggle = async (b: Banner) => {
    setBusy(b._id);
    try {
      const form = new FormData();
      form.append('isActive', String(!b.isActive));
      await api.put(`/banners/${b._id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.show(b.isActive ? 'Hidden from students' : 'Now showing to students');
      load();
    } catch (e: any) {
      toast.show(e.message);
    } finally {
      setBusy('');
    }
  };

  const move = async (index: number, delta: number) => {
    if (!banners) return;
    const next = [...banners];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setBanners(next);
    try {
      await api.put('/banners/reorder', { ids: next.map((b) => b._id) });
    } catch (e: any) {
      toast.show(e.message);
      load();
    }
  };

  const remove = async (b: Banner) => {
    setBusy(b._id);
    try {
      const res: any = await api.delete(`/banners/${b._id}`);
      done(res.message);
    } catch (e: any) {
      toast.show(e.message);
    } finally {
      setBusy('');
    }
  };

  const shown = banners?.filter((b) => b.isActive).length || 0;

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="Banners"
        subtitle={`Placement and announcement banners on the student dashboard. They rotate every 5 seconds after the welcome slide. Best size ${BANNER_SIZE}.`}
        action={
          <button type="button" className={primaryBtn} onClick={() => setDialog({ kind: 'add' })}>
            <ImagePlus className="h-4 w-4" /> Add banner
          </button>
        }
      />
      <ErrorNote text={error} />

      {!banners ? (
        <Spinner />
      ) : banners.length === 0 ? (
        <Card className="p-10 text-center text-sm text-slate-500">No banners yet. Click "Add banner" to upload the first one.</Card>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {shown} of {banners.length} showing to students, in this order.
          </p>
          <div className="grid gap-4">
            {banners.map((b, i) => (
              <Card key={b._id} className={`overflow-hidden ${b.isActive ? '' : 'opacity-60'}`}>
                <div className="grid gap-0 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <div className="aspect-[1257/360] w-full bg-gradient-to-b from-[#0b0660] to-[#3b00e6]">
                    <img src={assetUrl(b.imageUrl)} alt={b.title} className="h-full w-full object-contain" loading="lazy" />
                  </div>
                  <div className="flex min-w-0 flex-col justify-between gap-3 p-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">#{i + 1}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                          {b.isActive ? 'Showing' : 'Hidden'}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{b.title}</p>
                      <p className="text-[11px] text-slate-500">
                        Updated {new Date(b.updatedAt).toLocaleDateString()}
                        {b.updatedById?.fullName ? ` by ${b.updatedById.fullName}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={`${secondaryBtn} !px-2`} title="Move up" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className={`${secondaryBtn} !px-2`} title="Move down" aria-label="Move down" disabled={i === banners.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className={secondaryBtn} disabled={busy === b._id} onClick={() => toggle(b)}>
                        {b.isActive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {b.isActive ? 'Hide' : 'Show'}
                      </button>
                      <button type="button" className={secondaryBtn} onClick={() => setDialog({ kind: 'edit', banner: b })}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        className={`${secondaryBtn} !text-rose-600 hover:!bg-rose-50 dark:hover:!bg-rose-950/40`}
                        onClick={() => setDialog({ kind: 'delete', banner: b })}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {dialog?.kind === 'add' && <BannerForm onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'edit' && <BannerForm banner={dialog.banner} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'delete' && (
        <Modal title="Delete this banner?" subtitle="It is removed from the student dashboard, the database and storage. This cannot be undone." onClose={() => setDialog(null)}>
          <div className="space-y-4">
            <div className="aspect-[1257/360] w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#0b0660] to-[#3b00e6]">
              <img src={assetUrl(dialog.banner.imageUrl)} alt={dialog.banner.title} className="h-full w-full object-contain" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{dialog.banner.title}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className={secondaryBtn} onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button type="button" className={`${primaryBtn} !bg-rose-600 hover:!bg-rose-700`} disabled={busy === dialog.banner._id} onClick={() => remove(dialog.banner)}>
                <Trash2 className="h-3.5 w-3.5" /> {busy === dialog.banner._id ? 'Deleting…' : 'Delete banner'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toast.node}
    </div>
  );
};
