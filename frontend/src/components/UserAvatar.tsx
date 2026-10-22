import React from 'react';
import { assetUrl } from '../services/api';

// The user's uploaded photo, or their initials. Old demo accounts point at stock photos of
// strangers; those are treated as "no photo".
export const UserAvatar: React.FC<{ user: { fullName?: string; avatarUrl?: string } | null | undefined; className?: string }> = ({ user, className = '' }) => {
  const url = user?.avatarUrl && !/images\.unsplash\.com/.test(user.avatarUrl) ? assetUrl(user.avatarUrl) : '';
  const name = user?.fullName || '';
  if (url) return <img src={url} alt={name} className={`${className} object-cover`} />;
  const letters =
    name
      .replace(/\(.*?\)/g, '')
      .split(/\s+/)
      .filter((w) => w && !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?';
  return (
    <span aria-label={name} className={`${className} inline-flex shrink-0 items-center justify-center bg-gradient-to-tr from-brand-600 to-indigo-600 text-sm font-extrabold text-white`}>
      {letters}
    </span>
  );
};
