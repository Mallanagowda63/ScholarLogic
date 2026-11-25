import React from 'react';

// Where a job was found: the LinkedIn "in" logo, or the ScholarLogic triangles
export const LinkedInLogo: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} role="img" aria-label="LinkedIn">
    <rect width="24" height="24" rx="4" fill="#0A66C2" />
    <path
      fill="#fff"
      d="M7.1 9.6H4.6V19h2.5V9.6zM5.85 5.2a1.45 1.45 0 100 2.9 1.45 1.45 0 000-2.9zM19.4 13.7c0-2.5-.55-4.3-3.45-4.3-1.4 0-2.35.77-2.73 1.5h-.04V9.6h-2.4V19h2.5v-4.65c0-1.23.23-2.42 1.75-2.42 1.5 0 1.52 1.4 1.52 2.5V19h2.5l.05-5.3z"
    />
  </svg>
);

export const ScholarLogicLogo: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <img src="/favicon-32.png" alt="ScholarLogic" className={`${className} object-contain`} />
);

export const isLinkedInJob = (job: { source?: string }) => job.source === 'LINKEDIN';
