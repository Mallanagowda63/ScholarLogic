import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Password box with an eye button to show or hide what was typed
export const PasswordInput: React.FC<Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>> = ({ className = '', ...props }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${className} pr-10`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};
