import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { ShieldAlert, Clock, CheckCircle2, AlertTriangle, Camera, Lock, Maximize2, Send } from 'lucide-react';

export const ExamRunner: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);

  // Timer state
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(3600);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'SAVED' | 'SAVING' | 'ERROR'>('SAVED');

  // Security & Proctoring State
  const [violationsCount, setViolationsCount] = useState(0);
  const [maxViolations, setMaxViolations] = useState(3);
  const [showViolationBanner, setShowViolationBanner] = useState(false);
  const [latestViolationType, setLatestViolationType] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startExamSession();

    return () => {
      // Clean up media tracks on unmount/exit
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [id]);

  const startExamSession = async () => {
    setLoading(true);
    try {
      // 1. Initialize camera stream if requested
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        mediaStreamRef.current = stream;
        setCameraActive(true);
      } catch (err) {
        console.warn('Camera stream not active');
      }

      // 2. Request Fullscreen
      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          console.warn('Fullscreen entry suppressed');
        }
      }

      // 3. Start Exam Attempt on Backend
      const res: any = await api.post(`/exams/${id}/start`);
      if (res.success && res.data) {
        setAttemptId(res.data.attemptId);
        setExam(res.data.exam);
        setQuestions(res.data.questions || []);
        setMaxViolations(res.data.exam.securitySettings?.maxViolations || 3);

        const exp = new Date(res.data.expiresAt).getTime();
        const now = Date.now();
        setTimeLeftSeconds(Math.max(1, Math.round((exp - now) / 1000)));
      }
    } catch (err: any) {
      alert(err.message || 'Could not start exam session');
      navigate(`/student/exams`);
    } finally {
      setLoading(false);
    }
  };

  // Timer countdown hook
  useEffect(() => {
    if (loading || submitting) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit('TIME_EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, submitting]);

  // Real-Time Proctoring Security Listeners
  useEffect(() => {
    if (!attemptId || submitting) return;

    // A. Fullscreen Exit Listener
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !submitting) {
        logViolation('FULLSCREEN_EXIT');
      }
    };

    // B. Tab Switch Listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !submitting) {
        logViolation('TAB_SWITCH');
      }
    };

    // C. Window Blur Listener
    const handleWindowBlur = () => {
      if (!submitting) {
        logViolation('WINDOW_BLUR');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [attemptId, submitting]);

  const logViolation = async (type: string) => {
    if (!attemptId || submitting) return;

    try {
      const res: any = await api.post(`/exams/attempts/${attemptId}/violation`, { type });
      if (res.success && res.data) {
        const count = res.data.violationsCount;
        setViolationsCount(count);
        setLatestViolationType(type);
        setShowViolationBanner(true);

        if (res.data.autoSubmitted) {
          handleAutoSubmit('MAX_VIOLATIONS');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectAnswer = (qId: string, val: any) => {
    const updated = { ...answers, [qId]: val };
    setAnswers(updated);
    triggerAutoSave(updated);
  };

  const triggerAutoSave = async (currentAnswers: Record<string, any>) => {
    if (!attemptId) return;
    setAutoSaveStatus('SAVING');
    try {
      await api.post(`/exams/attempts/${attemptId}/save`, {
        answers: currentAnswers,
        markedForReview,
      });
      setAutoSaveStatus('SAVED');
    } catch {
      setAutoSaveStatus('ERROR');
    }
  };

  const handleAutoSubmit = async (reason: string) => {
    if (submitting || !attemptId) return;
    setSubmitting(true);

    try {
      const res: any = await api.post(`/exams/attempts/${attemptId}/submit`, {
        answers,
        reason,
      });

      if (res.success && res.data.result) {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        navigate(`/student/results/${res.data.result._id}`);
      }
    } catch (err: any) {
      alert(err.message || 'Exam auto-submission error');
    }
  };

  const handleSubmitConfirmed = () => {
    if (confirm('Are you sure you want to submit your exam now?')) {
      handleAutoSubmit('USER_SUBMITTED');
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent mx-auto" />
          <p className="text-xs font-bold">Initializing Secure Proctoring Canvas...</p>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Header Proctoring Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black text-xs">
            SL
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-white">{exam?.title}</h2>
            <span className="text-[10px] text-slate-400 font-mono">Question {currentIndex + 1} of {questions.length}</span>
          </div>
        </div>

        {/* Live Proctoring & Security Badges */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 font-bold text-[11px]">
              <Camera className="h-3.5 w-3.5" /> 🔴 Camera Active
            </span>

            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950 border border-blue-800 text-blue-400 font-bold text-[11px]">
              <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
            </span>

            {violationsCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950 border border-amber-800 text-amber-400 font-bold text-[11px]">
                <AlertTriangle className="h-3.5 w-3.5" /> {violationsCount}/{maxViolations} Violations
              </span>
            )}
          </div>

          {/* Server Synchronized Timer */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-slate-800 border border-slate-700 font-mono font-black text-sm text-brand-400">
            <Clock className="h-4 w-4" /> {formatTimer(timeLeftSeconds)}
          </div>

          <button
            onClick={handleSubmitConfirmed}
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white shadow-md flex items-center gap-1.5"
          >
            <Send className="h-3.5 w-3.5" /> Submit Exam
          </button>
        </div>
      </header>

      {/* Main Question Runner Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Question View */}
        <main className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto space-y-6">
          {currentQ && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3">
                <span className="font-bold text-brand-400">Topic: {currentQ.topicTag || 'General'}</span>
                <span>Marks: <strong className="text-white">+{currentQ.marks}</strong></span>
              </div>

              <h3 className="text-lg font-bold text-white leading-relaxed">{currentQ.questionText}</h3>

              {/* Options Section */}
              <div className="space-y-3 pt-2">
                {currentQ.type === 'MCQ' && (
                  currentQ.options?.map((opt: string, idx: number) => {
                    const isChecked = String(answers[currentQ._id]) === String(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectAnswer(currentQ._id, idx)}
                        className={`w-full text-left p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 transition-all ${
                          isChecked
                            ? 'bg-brand-600/20 border-brand-500 text-white shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className={`h-6 w-6 rounded-full border flex items-center justify-center font-mono text-[11px] font-bold ${isChecked ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-700 text-slate-400'}`}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })
                )}

                {currentQ.type === 'TRUE_FALSE' && (
                  <div className="grid grid-cols-2 gap-4">
                    {[true, false].map((tfVal) => {
                      const isChecked = String(answers[currentQ._id]) === String(tfVal);
                      return (
                        <button
                          key={String(tfVal)}
                          onClick={() => handleSelectAnswer(currentQ._id, tfVal)}
                          className={`p-5 rounded-2xl border text-center font-bold text-sm transition-all ${
                            isChecked
                              ? 'bg-brand-600/20 border-brand-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {tfVal ? 'True' : 'False'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-800">
                <button
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(currentIndex - 1)}
                  className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 disabled:opacity-40"
                >
                  ← Previous
                </button>

                <span className="text-[11px] text-slate-400 font-mono">
                  {autoSaveStatus === 'SAVING' ? 'Saving progress...' : '✓ Auto-Saved'}
                </span>

                <button
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-md disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Right Side: Question Navigation Palette */}
        <aside className="w-64 bg-slate-900 border-l border-slate-800 p-4 space-y-4 hidden md:block">
          <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider">Question Palette</h4>
          <div className="grid grid-cols-4 gap-2">
            {questions.map((q, idx) => {
              const isAnswered = answers[q._id] !== undefined;
              const isCurrent = idx === currentIndex;
              return (
                <button
                  key={q._id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-9 w-full rounded-xl text-xs font-bold flex items-center justify-center border transition-all ${
                    isCurrent
                      ? 'border-brand-500 bg-brand-600 text-white shadow-md ring-2 ring-brand-500/30'
                      : isAnswered
                      ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 text-[10px] text-slate-400 space-y-1">
            <p>🟢 Green: Answered</p>
            <p>🔵 Blue: Active Question</p>
            <p>⚪ Gray: Unanswered</p>
          </div>
        </aside>
      </div>

      {/* Security Violation Overlay Banner */}
      {showViolationBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-amber-500/50 bg-slate-900 p-6 space-y-4 text-center">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h3 className="font-extrabold text-base text-white">⚠ Security Violation Detected</h3>
            <p className="text-xs text-amber-300">
              Event logged: <strong className="text-white">{latestViolationType}</strong>
            </p>
            <p className="text-xs text-slate-400">
              Violation {violationsCount} of {maxViolations} recorded. Returning to full-screen exam mode.
            </p>

            <button
              onClick={() => setShowViolationBanner(false)}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
            >
              Return to Exam Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
