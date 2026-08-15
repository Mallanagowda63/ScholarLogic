import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { FileCheck, HelpCircle, PlusCircle, Award, CheckCircle2, TrendingUp, BarChart3, ShieldCheck, Camera, Mic, Maximize2, Layers, ArrowRight } from 'lucide-react';

export const TrainerAssessments: React.FC = () => {
  const [searchParams] = useSearchParams();
  const actionParam = searchParams.get('action');

  const [exams, setExams] = useState<any[]>([]);
  const [questionBank, setQuestionBank] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Exam Builder Modal state
  const [showCreateModal, setShowCreateModal] = useState(actionParam === 'create-exam' || actionParam === 'create-quiz');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('ScholarLogic Assessment Exam');
  const [courseId, setCourseId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [totalMarks, setTotalMarks] = useState(100);
  const [passingMarks, setPassingMarks] = useState(40);
  const [negativeMarking, setNegativeMarking] = useState(0);

  // Security Settings Switches
  const [requireFullscreen, setRequireFullscreen] = useState(true);
  const [requireCamera, setRequireCamera] = useState(true);
  const [requireMicrophone, setRequireMicrophone] = useState(false);
  const [detectTabSwitch, setDetectTabSwitch] = useState(true);
  const [detectWindowBlur, setDetectWindowBlur] = useState(true);
  const [autoSubmitOnViolations, setAutoSubmitOnViolations] = useState(true);
  const [maxViolations, setMaxViolations] = useState(3);
  const [questionRandomization, setQuestionRandomization] = useState(true);

  // Selected Question IDs from Question Bank
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  useEffect(() => {
    fetchExams();
    fetchCourses();
    fetchQuestionBank();
  }, []);

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

  const fetchExams = () => {
    setLoading(true);
    api.get('/exams')
      .then((res: any) => {
        if (res.success) setExams(res.data.exams || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchQuestionBank = async () => {
    try {
      const res: any = await api.get('/exams/questions');
      if (res.success) setQuestionBank(res.data.questions || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleQuestionSelect = (qId: string) => {
    if (selectedQuestionIds.includes(qId)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== qId));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, qId]);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/exams', {
        courseId: courseId || undefined,
        title,
        description,
        durationMinutes: Number(durationMinutes),
        totalMarks: Number(totalMarks),
        passingMarks: Number(passingMarks),
        negativeMarking: Number(negativeMarking),
        isPublished: true,
        securitySettings: {
          requireFullscreen,
          requireCamera,
          requireMicrophone,
          detectTabSwitch,
          detectWindowBlur,
          autoSubmitOnViolations,
          maxViolations: Number(maxViolations),
          questionRandomization,
        },
        questionIds: selectedQuestionIds,
      });

      alert('Exam created and published successfully!');
      setShowCreateModal(false);
      setTitle('');
      setSelectedQuestionIds([]);
      fetchExams();
    } catch (err: any) {
      alert(err.message || 'Failed to create exam');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header with Question Bank Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Exams, Quizzes & Proctoring Workspace</h1>
          <p className="text-xs text-slate-500">Configure online exams, question randomization, proctoring security rules, and audit results</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/trainer/question-bank"
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Layers className="h-4 w-4 text-brand-500" /> Question Bank ({questionBank.length})
          </Link>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-md"
          >
            <PlusCircle className="h-4 w-4" /> + Create Exam
          </button>
        </div>
      </div>

      {/* Primary Exams Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {exams.map((exam) => (
            <div key={exam._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="purple">{exam.durationMinutes} Mins</Badge>
                <Badge variant="green">PUBLISHED</Badge>
              </div>

              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{exam.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{exam.description || 'Comprehensive assessment exam'}</p>
              </div>

              {/* Security Indicators */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                {exam.securitySettings?.requireFullscreen && <Badge variant="blue">✓ Fullscreen</Badge>}
                {exam.securitySettings?.requireCamera && <Badge variant="amber">✓ Camera</Badge>}
                {exam.securitySettings?.requireMicrophone && <Badge variant="purple">✓ Microphone</Badge>}
                {exam.securitySettings?.detectTabSwitch && <Badge variant="green">✓ Tab Monitoring</Badge>}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs border-t border-slate-100 dark:border-slate-800">
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Total Marks</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{exam.totalMarks}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Passing</span>
                  <span className="font-extrabold text-emerald-600">{exam.passingMarks}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[10px] text-slate-400 block font-bold">Questions</span>
                  <span className="font-extrabold text-brand-600">{exam.questionIds?.length || 10}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <Link
                  to={`/trainer/exams/${exam._id}/results`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-600 hover:text-white text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
                >
                  View Student Results & Violation Audit <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Exam with Security Rules */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-brand-500" /> Create Exam & Configure Security Controls
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Exam Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Python Secure Mid-Term Assessment"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Passing Marks</label>
                  <input
                    type="number"
                    value={passingMarks}
                    onChange={(e) => setPassingMarks(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Negative Marking</label>
                  <input
                    type="number"
                    step="0.25"
                    value={negativeMarking}
                    onChange={(e) => setNegativeMarking(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2 text-white"
                  />
                </div>
              </div>

              {/* Security Settings Section */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Exam Security & Proctoring Settings
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireFullscreen}
                      onChange={(e) => setRequireFullscreen(e.target.checked)}
                      className="h-4 w-4 rounded text-brand-500"
                    />
                    Require Fullscreen
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireCamera}
                      onChange={(e) => setRequireCamera(e.target.checked)}
                      className="h-4 w-4 rounded text-brand-500"
                    />
                    Require Camera
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireMicrophone}
                      onChange={(e) => setRequireMicrophone(e.target.checked)}
                      className="h-4 w-4 rounded text-brand-500"
                    />
                    Require Microphone
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={detectTabSwitch}
                      onChange={(e) => setDetectTabSwitch(e.target.checked)}
                      className="h-4 w-4 rounded text-brand-500"
                    />
                    Detect Tab Switch
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={detectWindowBlur}
                      onChange={(e) => setDetectWindowBlur(e.target.checked)}
                      className="h-4 w-4 rounded text-brand-500"
                    />
                    Detect Window Blur
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSubmitOnViolations}
                      onChange={(e) => setAutoSubmitOnViolations(e.target.checked)}
                      className="h-4 w-4 rounded text-brand-500"
                    />
                    Auto Submit on Max Violations
                  </label>
                </div>
              </div>

              {/* Question Selection List from Question Bank */}
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-200">Select Questions from Question Bank ({selectedQuestionIds.length} Selected)</span>
                  <Link to="/trainer/question-bank" className="text-brand-400 font-bold text-[11px] hover:underline">
                    + Add New to Bank
                  </Link>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                  {questionBank.map((q) => (
                    <label key={q._id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={selectedQuestionIds.includes(q._id)}
                          onChange={() => handleToggleQuestionSelect(q._id)}
                          className="h-4 w-4 rounded text-brand-500"
                        />
                        <span className="font-semibold text-slate-200 line-clamp-1">{q.questionText}</span>
                      </div>
                      <Badge variant="blue">+{q.marks} Mks</Badge>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700">
                  Publish Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
