import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ShieldCheck, Camera, Mic, Maximize2, AlertCircle, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

export const ExamInstructions: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchExam();
  }, [id]);

  const fetchExam = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/exams/${id}`);
      if (res.success) {
        setExam(res.data.exam);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load exam instructions');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: exam?.securitySettings?.requireMicrophone || false,
      });
      setCameraGranted(true);
      if (exam?.securitySettings?.requireMicrophone) {
        setMicGranted(true);
      }
      // Stop temporary track stream until runner starts
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setErrorMsg('Camera/Microphone permission was denied by browser. Please allow permission to proceed.');
    }
  };

  const handleEnterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setFullscreenGranted(true);
    } catch (err) {
      setErrorMsg('Could not enter Fullscreen mode. Please click to enable.');
    }
  };

  const handleStartExamSession = async () => {
    if (exam?.securitySettings?.requireCamera && !cameraGranted) {
      return setErrorMsg('Camera permission is required before starting the exam.');
    }
    if (exam?.securitySettings?.requireFullscreen && !fullscreenGranted) {
      await handleEnterFullscreen();
    }

    navigate(`/student/exams/${id}/runner`);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const sec = exam?.securitySettings || {};

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-lg">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">ScholarLogic Secure Exam Instructions</h1>
          <p className="text-xs text-slate-500">{exam?.title} ({exam?.durationMinutes} Minutes • {exam?.totalMarks} Marks)</p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-600 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
          </div>
        )}

        {/* Security Rules Checklist */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Required Security Rules & Proctoring Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <Maximize2 className="h-4 w-4 text-brand-500" /> Fullscreen Enforcement
              </span>
              <span className="font-bold text-emerald-500">REQUIRED</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <Camera className="h-4 w-4 text-emerald-500" /> Camera Permission
              </span>
              <span className={`font-bold ${cameraGranted ? 'text-emerald-500' : 'text-amber-500'}`}>
                {cameraGranted ? '✓ GRANTED' : 'PENDING'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <ShieldCheck className="h-4 w-4 text-indigo-500" /> Tab & Focus Monitoring
              </span>
              <span className="font-bold text-emerald-500">ACTIVE</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-purple-500" /> Max Security Violations
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{sec.maxViolations || 3} Allowed</span>
            </div>
          </div>
        </div>

        {/* Clear Privacy Notice (Requirement 15 & 37) */}
        <div className="p-4 rounded-2xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-900 text-xs space-y-1">
          <span className="font-bold text-brand-700 dark:text-brand-300 block">🔒 Privacy & Device Security Notice</span>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11px]">
            Camera & Microphone permissions are requested strictly for live presence status checks during your active assessment session.
            No video recording is stored or sent to third-party services. Timer auto-saves your progress continuously.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          {sec.requireCamera && !cameraGranted && (
            <button
              onClick={handleRequestCamera}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" /> Allow Camera Permission
            </button>
          )}

          <button
            onClick={handleStartExamSession}
            disabled={sec.requireCamera && !cameraGranted}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-extrabold text-xs shadow-lg shadow-brand-500/25 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            Start Secure Exam Session <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
