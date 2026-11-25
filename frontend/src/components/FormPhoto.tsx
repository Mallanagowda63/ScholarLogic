import React, { useState } from 'react';
import { assetUrl } from '../services/api';

// A student's photo from a Google Form. `src` is the copy saved on the server (/api/form-photos/…);
// until it is saved, the initials show and `driveUrl` (the private Drive link) opens it for an admin signed in to Google.
const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';

export const FormPhoto: React.FC<{ src?: string; driveUrl?: string; name?: string; size?: 'sm' | 'lg'; className?: string }> = ({ src, driveUrl, name, size = 'sm', className = '' }) => {
  const [broken, setBroken] = useState(false);
  const [zoom, setZoom] = useState(false);
  const box = size === 'lg' ? 'h-28 w-28 rounded-2xl text-2xl' : 'h-10 w-10 rounded-xl text-xs';
  const url = assetUrl(src);
  if (url && !broken)
    return (
      <>
        <button type="button" onClick={() => setZoom(true)} title="See the photo" className={`shrink-0 overflow-hidden ring-1 ring-slate-200 dark:ring-slate-700 ${box} ${className}`}>
          <img src={url} alt={name ? `Photo of ${name}` : 'Student photo'} loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        </button>
        {zoom && (
          <div role="dialog" aria-label="Photo" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6" onClick={() => setZoom(false)}>
            <img src={url} alt={name ? `Photo of ${name}` : 'Student photo'} className="max-h-[85vh] max-w-[90vw] rounded-2xl shadow-2xl" />
          </div>
        )}
      </>
    );
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center bg-slate-100 font-black text-slate-400 dark:bg-slate-800 ${box} ${className}`} title={driveUrl ? 'Photo not saved yet' : 'No photo'}>
      {initials(name)}
      {driveUrl && (
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute -bottom-1 -right-1 rounded-md bg-brand-600 px-1 text-[8px] font-bold leading-4 text-white"
          title="Open the photo in Google Drive"
        >
          Drive
        </a>
      )}
    </span>
  );
};
