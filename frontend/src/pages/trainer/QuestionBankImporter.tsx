import React, { useState } from 'react';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Upload, FileSpreadsheet, FileJson, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';

export const QuestionBankImporter: React.FC = () => {
  const [jsonText, setJsonText] = useState<string>(`[
  {
    "questionText": "What is the output of print(type([])) in Python?",
    "type": "MCQ",
    "options": ["<class 'list'>", "<class 'tuple'>", "<class 'dict'>", "<class 'array'>"],
    "correctAnswer": 0,
    "marks": 5,
    "difficulty": "EASY",
    "topicTag": "Python Basics"
  },
  {
    "questionText": "Which HTTP status code represents 'Internal Server Error'?",
    "type": "MCQ",
    "options": ["200", "404", "500", "403"],
    "correctAnswer": 2,
    "marks": 5,
    "difficulty": "MEDIUM",
    "topicTag": "REST APIs"
  }
]`);

  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [resultSummary, setResultSummary] = useState<any | null>(null);

  const handleParseText = () => {
    setResultSummary(null);
    setValidationErrors([]);
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        alert('Input must be a JSON array of questions');
        return;
      }

      const errors: any[] = [];
      const valid: any[] = [];

      parsed.forEach((q: any, idx: number) => {
        if (!q.questionText || typeof q.questionText !== 'string') {
          errors.push({ index: idx + 1, error: 'Missing question text' });
        } else if (!['MCQ', 'TRUE_FALSE', 'MULTIPLE_SELECT', 'SHORT_ANSWER', 'CODING'].includes(q.type)) {
          errors.push({ index: idx + 1, questionText: q.questionText, error: `Invalid question type: ${q.type}` });
        } else {
          valid.push(q);
        }
      });

      setParsedPreview(valid);
      setValidationErrors(errors);
    } catch (err: any) {
      alert('Invalid JSON format: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (file.name.endsWith('.json')) {
        setJsonText(content);
      } else if (file.name.endsWith('.csv')) {
        // Simple CSV parser
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

        const questions: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 3) {
            questions.push({
              questionText: cols[0],
              type: cols[1] || 'MCQ',
              options: cols[2] ? cols[2].split(';') : ['Option A', 'Option B'],
              correctAnswer: 0,
              marks: Number(cols[3]) || 5,
              difficulty: cols[4] || 'MEDIUM',
              topicTag: cols[5] || 'General',
            });
          }
        }
        setJsonText(JSON.stringify(questions, null, 2));
      }
    };
    reader.readAsText(file);
  };

  const handleCommitImport = async () => {
    if (parsedPreview.length === 0) return alert('No valid questions to import');
    try {
      setImporting(true);
      const res: any = await api.post('/exams/questions/import', { questions: parsedPreview });
      if (res.success && res.data) {
        setResultSummary(res.data);
        alert(`Successfully imported ${res.data.insertedCount} questions into Question Bank!`);
      }
    } catch (err: any) {
      alert(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Question Bank CSV/JSON Importer</h1>
          <p className="text-xs text-slate-500">Bulk import questions with row validation, error preview, and taxonomy tagging</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload & Paste JSON/CSV */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Upload className="h-4 w-4 text-brand-500" /> Upload File (.CSV or .JSON)
            </h3>

            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 dark:file:bg-brand-950 file:text-brand-700 dark:file:text-brand-300 hover:file:bg-brand-100"
            />

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Or Paste JSON / CSV Content:
              </label>
              <textarea
                rows={12}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              onClick={handleParseText}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-colors"
            >
              Parse & Validate Format
            </button>
          </div>
        </div>

        {/* Right Column: Preview & Commit */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Parsed Questions Preview ({parsedPreview.length})
              </h3>

              <button
                onClick={handleCommitImport}
                disabled={importing || parsedPreview.length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50 transition-colors shadow-md flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {importing ? 'Importing...' : 'Commit Batch Import'}
              </button>
            </div>

            {/* Error Warnings List */}
            {validationErrors.length > 0 && (
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20 text-xs text-rose-800 dark:text-rose-300 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  {validationErrors.length} Row Validation Errors Found:
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>
                      Row #{err.index}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Valid Questions Table */}
            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {parsedPreview.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-12">Click "Parse & Validate Format" to preview questions.</p>
              ) : (
                parsedPreview.map((q, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white line-clamp-1">{q.questionText}</span>
                      <Badge variant="blue" className="text-[10px] font-extrabold">{q.type}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Topic: {q.topicTag || 'General'} • Marks: {q.marks || 5}</span>
                      <span className="font-bold text-emerald-600">Valid Record</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
