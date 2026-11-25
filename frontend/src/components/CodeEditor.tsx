import React from 'react';
import Editor from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';
import { Lang, MONACO_LANG } from '../services/codeRunner';

// The IDE text area: Monaco (the editor inside VS Code), loaded on demand. Dark when the site is dark.
const isDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

export const CodeEditor: React.FC<{ lang: Lang; value: string; onChange: (v: string) => void; height?: string | number; readOnly?: boolean }> = ({ lang, value, onChange, height = 360, readOnly }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
    <Editor
      height={height}
      language={MONACO_LANG[lang]}
      theme={isDark() ? 'vs-dark' : 'light'}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      loading={
        <span className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the editor…
        </span>
      }
      options={{
        readOnly,
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: lang === 'python' ? 4 : 2,
        wordWrap: 'on',
        lineNumbersMinChars: 3,
        padding: { top: 10 },
      }}
    />
  </div>
);
