import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Search, PlusCircle, Filter, BookOpen, Layers, CheckSquare, HelpCircle, Edit3, Copy, Eye, Archive, Trash2, X, AlertCircle } from 'lucide-react';

export const TrainerQuestionBank: React.FC = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedType, setSelectedType] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<any | null>(null);

  // Form states
  const [questionText, setQuestionText] = useState('');
  const [type, setType] = useState<'MCQ' | 'MULTIPLE_SELECT' | 'TRUE_FALSE' | 'SHORT_ANSWER'>('MCQ');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [topicTag, setTopicTag] = useState('Python Core');
  const [marks, setMarks] = useState(5);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [courseId, setCourseId] = useState('');
  const [options, setOptions] = useState<string[]>(['Option 1', 'Option 2', 'Option 3', 'Option 4']);
  const [mcqCorrect, setMcqCorrect] = useState<number>(0);
  const [multiCorrect, setMultiCorrect] = useState<number[]>([0]);
  const [tfCorrect, setTfCorrect] = useState<boolean>(true);
  const [shortCorrect, setShortCorrect] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchQuestions();
    fetchCourses();
  }, [selectedCourse, selectedDifficulty, selectedType]);

  const fetchCourses = async () => {
    try {
      const res: any = await api.get('/trainer/courses');
      if (res.success && res.data.courses) {
        setCourses(res.data.courses);
        if (res.data.courses.length > 0 && !courseId) {
          setCourseId(res.data.courses[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQuestions = async () => {
    setLoading(true);
    let url = '/exams/questions?';
    if (selectedCourse) url += `courseId=${encodeURIComponent(selectedCourse)}&`;
    if (selectedDifficulty) url += `difficulty=${encodeURIComponent(selectedDifficulty)}&`;
    if (selectedType) url += `type=${encodeURIComponent(selectedType)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    try {
      const res: any = await api.get(url);
      if (res.success) {
        setQuestions(res.data.questions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQuestions();
  };

  const handleAddOption = () => {
    setOptions([...options, `Option ${options.length + 1}`]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return alert('At least 2 options are required');
    setOptions(options.filter((_, i) => i !== index));
    if (mcqCorrect === index) setMcqCorrect(0);
    setMultiCorrect(multiCorrect.filter((i) => i !== index));
  };

  const handleOptionTextChange = (index: number, text: string) => {
    const updated = [...options];
    updated[index] = text;
    setOptions(updated);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    let correctAnswerPayload: any = mcqCorrect;
    if (type === 'MULTIPLE_SELECT') {
      if (multiCorrect.length === 0) {
        setErrorMsg('Multiple select question must have at least one correct option selected.');
        return;
      }
      correctAnswerPayload = multiCorrect;
    } else if (type === 'TRUE_FALSE') {
      correctAnswerPayload = tfCorrect;
    } else if (type === 'SHORT_ANSWER') {
      if (!shortCorrect.trim()) {
        setErrorMsg('Please specify the model correct answer text.');
        return;
      }
      correctAnswerPayload = shortCorrect.trim();
    }

    try {
      const res: any = await api.post('/exams/questions', {
        questionText,
        type,
        difficulty,
        topicTag,
        marks: Number(marks),
        negativeMarks: Number(negativeMarks),
        courseId: courseId || undefined,
        options: type === 'MCQ' || type === 'MULTIPLE_SELECT' ? options : [],
        correctAnswer: correctAnswerPayload,
      });

      if (res.success) {
        alert('Question added to Question Bank successfully!');
        setShowAddModal(false);
        setQuestionText('');
        fetchQuestions();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create question');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res: any = await api.post(`/exams/questions/${id}/duplicate`, {});
      if (res.success) {
        fetchQuestions();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to duplicate question');
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Archive this question?')) return;
    try {
      const res: any = await api.post(`/exams/questions/${id}/archive`, {});
      if (res.success) {
        fetchQuestions();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to archive question');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Main Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Central Trainer Question Bank</h1>
          <p className="text-xs text-slate-500">Create, validate, edit, duplicate, and organize assessment questions with strict backend validation</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-md shadow-brand-500/20"
        >
          <PlusCircle className="h-4 w-4" /> + Add Question
        </button>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions by text or topic..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </form>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-300"
            >
              <option value="">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-300"
            >
              <option value="">All Question Types</option>
              <option value="MCQ">Multiple Choice (MCQ)</option>
              <option value="MULTIPLE_SELECT">Multiple Select</option>
              <option value="TRUE_FALSE">True / False</option>
              <option value="SHORT_ANSWER">Short Answer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Question Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <HelpCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">No Questions Found</h3>
          <p className="text-xs text-slate-500 mt-1">Add your first question to the trainer Question Bank</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Question Text</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Difficulty</th>
                  <th className="p-4">Topic</th>
                  <th className="p-4">Marks</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {questions.map((q) => (
                  <tr key={q._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-slate-900 dark:text-white line-clamp-2">{q.questionText}</p>
                      {q.options && q.options.length > 0 && (
                        <span className="text-[10px] text-slate-400">{q.options.length} Options</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge variant={q.type === 'MCQ' ? 'blue' : q.type === 'MULTIPLE_SELECT' ? 'purple' : q.type === 'TRUE_FALSE' ? 'amber' : 'green'}>
                        {q.type}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={q.difficulty === 'EASY' ? 'green' : q.difficulty === 'MEDIUM' ? 'amber' : 'red'}>
                        {q.difficulty}
                      </Badge>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{q.topicTag || 'General'}</td>
                    <td className="p-4">
                      <span className="font-bold text-slate-900 dark:text-white">+{q.marks}</span>
                      {q.negativeMarks > 0 && <span className="text-red-500 text-[10px] ml-1">(-{q.negativeMarks})</span>}
                    </td>
                    <td className="p-4">
                      <Badge variant={q.status === 'ACTIVE' ? 'green' : 'slate'}>{q.status}</Badge>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => setPreviewQuestion(q)}
                        title="Preview Question"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(q._id)}
                        title="Duplicate Question"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchive(q._id)}
                        title="Archive Question"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-red-500/10 text-red-500"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: + Add Question Form */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-brand-500" /> Create Question in Question Bank
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-xs font-semibold text-red-300 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" /> {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Question Type</label>
                  <select
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                  >
                    <option value="MCQ">Multiple Choice (Single Select)</option>
                    <option value="MULTIPLE_SELECT">Multiple Select (Checkboxes)</option>
                    <option value="TRUE_FALSE">True / False</option>
                    <option value="SHORT_ANSWER">Short Answer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Difficulty Level</label>
                  <select
                    value={difficulty}
                    onChange={(e: any) => setDifficulty(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Question Text</label>
                <textarea
                  required
                  rows={3}
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="e.g. What is the output of print(2 + 3) in Python?"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Options Form for MCQ & MULTIPLE_SELECT */}
              {(type === 'MCQ' || type === 'MULTIPLE_SELECT') && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-800/50 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300">Answer Options & Correct Key</span>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-brand-400 font-bold text-[11px] hover:underline"
                    >
                      + Add Option
                    </button>
                  </div>

                  <div className="space-y-2">
                    {options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {type === 'MCQ' ? (
                          <input
                            type="radio"
                            name="correctOpt"
                            checked={mcqCorrect === idx}
                            onChange={() => setMcqCorrect(idx)}
                            className="h-4 w-4 text-brand-500"
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={multiCorrect.includes(idx)}
                            onChange={(e) => {
                              if (e.target.checked) setMultiCorrect([...multiCorrect, idx]);
                              else setMultiCorrect(multiCorrect.filter((i) => i !== idx));
                            }}
                            className="h-4 w-4 rounded text-brand-500"
                          />
                        )}

                        <input
                          type="text"
                          required
                          value={opt}
                          onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                          className="flex-1 rounded-xl border border-slate-800 bg-slate-800 p-2 text-white"
                        />

                        {options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="text-slate-500 hover:text-red-400 text-xs px-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    {type === 'MCQ' ? 'Select the radio button next to the correct answer.' : 'Check all boxes corresponding to correct options.'}
                  </p>
                </div>
              )}

              {/* True / False Form */}
              {type === 'TRUE_FALSE' && (
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-800 space-y-2">
                  <span className="font-bold text-slate-300 block">Correct True/False Answer</span>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="tfAnswer"
                        checked={tfCorrect === true}
                        onChange={() => setTfCorrect(true)}
                      />
                      True
                    </label>
                    <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                      <input
                        type="radio"
                        name="tfAnswer"
                        checked={tfCorrect === false}
                        onChange={() => setTfCorrect(false)}
                      />
                      False
                    </label>
                  </div>
                </div>
              )}

              {/* Short Answer Form */}
              {type === 'SHORT_ANSWER' && (
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-800 space-y-2">
                  <span className="font-bold text-slate-300 block">Model Correct Answer Text</span>
                  <input
                    type="text"
                    required
                    value={shortCorrect}
                    onChange={(e) => setShortCorrect(e.target.value)}
                    placeholder="e.g. 5 or True"
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Marks (+)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Negative Marks (-)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Topic Tag</label>
                  <input
                    type="text"
                    value={topicTag}
                    onChange={(e) => setTopicTag(e.target.value)}
                    placeholder="Python Loops"
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700">
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Question Preview */}
      {previewQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-indigo-400" /> Student View Question Preview
              </h3>
              <button onClick={() => setPreviewQuestion(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>{previewQuestion.topicTag}</span>
                <span className="font-bold text-emerald-400">+{previewQuestion.marks} Marks</span>
              </div>
              <h4 className="font-bold text-sm text-white">{previewQuestion.questionText}</h4>

              {previewQuestion.options && previewQuestion.options.length > 0 && (
                <div className="space-y-2 pt-2 text-xs text-slate-200">
                  {previewQuestion.options.map((opt: string, i: number) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 flex items-center gap-3">
                      <span className="font-mono text-slate-400 font-bold">{String.fromCharCode(65 + i)}.</span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 text-center italic">
              Student interface hides correct answer key during active exam attempts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
