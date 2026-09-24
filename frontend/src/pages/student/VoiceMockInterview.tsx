import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Mic, MicOff, Volume2, Sparkles, CheckCircle, AlertCircle, Play, Award, Clock, ArrowRight, RefreshCw } from 'lucide-react';

export const VoiceMockInterview: React.FC = () => {
  const [role, setRole] = useState('Software Engineer');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [session, setSession] = useState<any | null>(null);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedText, setRecordedText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [evaluationResult, setEvaluationResult] = useState<any | null>(null);

  const handleStartInterview = async () => {
    try {
      setEvaluationResult(null);
      const res: any = await api.post('/ai/mock-interview/start', {
        role,
        difficulty,
        interviewType: 'TECHNICAL',
      });

      if (res.success && res.data) {
        setSession(res.data.session);
        setCurrentQuestion(res.data.currentQuestion);
        setTranscript(res.data.session.transcript || []);
        speakText(res.data.currentQuestion);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start AI interview');
    }
  };

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      // Simulate Web Speech Voice API text capture fallback
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        try {
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;

          recognition.onresult = (event: any) => {
            const transcriptResult = event.results[0][0].transcript;
            setRecordedText(transcriptResult);
            setIsRecording(false);
          };

          recognition.onerror = () => {
            setIsRecording(false);
          };

          recognition.start();
        } catch {
          setRecordedText('In my previous software engineering projects, I implemented modular REST API architectures with automated testing and database indexing to optimize response times.');
        }
      } else {
        setRecordedText('In my previous software engineering projects, I implemented modular REST API architectures with automated testing and database indexing to optimize response times.');
      }
    }
  };

  const handleSendResponse = async () => {
    if (!session || !recordedText.trim()) return;

    try {
      setSubmitting(true);
      const res: any = await api.post(`/ai/mock-interview/${session._id}/respond`, {
        responseText: recordedText,
      });

      if (res.success && res.data) {
        setSession(res.data.session);
        setTranscript(res.data.session.transcript || []);
        setRecordedText('');

        if (res.data.isFinished) {
          handleFinishInterview();
        } else if (res.data.nextQuestion) {
          setCurrentQuestion(res.data.nextQuestion);
          speakText(res.data.nextQuestion);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit voice response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishInterview = async () => {
    if (!session) return;
    try {
      setEvaluating(true);
      const res: any = await api.post(`/ai/mock-interview/${session._id}/finish`);
      if (res.success && res.data) {
        setSession(res.data.session);
        setEvaluationResult(res.data.session);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to finish interview session');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-brand-500" /> Voice AI Mock Interview Simulator
          </h1>
          <p className="text-xs text-slate-500">Practice live technical interviews with real-time speech synthesis & AI evaluation report cards</p>
        </div>
      </div>

      {!session ? (
        /* Setup Modal */
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-md space-y-6 max-w-xl mx-auto">
          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white text-center">
            Initialize Mock Interview Session
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Target Job Role:</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 font-bold text-slate-900 dark:text-white"
              >
                <option value="Software Engineer">Software Engineer (Full Stack)</option>
                <option value="DevOps Engineer">DevOps Engineer</option>
                <option value="Data Scientist">Data Analytics & AI Engineer</option>
                <option value="Frontend Developer">Frontend Developer (React)</option>
                <option value="Backend Developer">Backend Developer (Node/Python)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Difficulty Level:</label>
              <div className="grid grid-cols-3 gap-3">
                {(['EASY', 'MEDIUM', 'HARD'] as const).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
                      difficulty === diff
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleStartInterview}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-extrabold text-xs shadow-lg shadow-brand-500/20 hover:opacity-95 transition-opacity"
          >
            Start Voice AI Interview Session →
          </button>
        </div>
      ) : evaluationResult ? (
        /* Evaluation Report Card */
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <Badge variant="green" className="text-xs font-bold mb-1">INTERVIEW EVALUATION COMPLETE</Badge>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">{role} Mock Interview</h2>
            </div>
            <div className="h-16 w-16 rounded-2xl bg-emerald-600 text-white font-black text-2xl flex items-center justify-center shadow-lg">
              {evaluationResult.overallScore}%
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Technical Accuracy</span>
              <span className="text-2xl font-black block text-brand-600">{evaluationResult.technicalScore}%</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Communication Clarity</span>
              <span className="text-2xl font-black block text-purple-600">{evaluationResult.communicationScore}%</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Confidence Score</span>
              <span className="text-2xl font-black block text-emerald-600">{evaluationResult.confidenceScore}%</span>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200">
              <h4 className="font-extrabold mb-1">Key Strengths Identified:</h4>
              <ul className="list-disc pl-4 space-y-1">
                {evaluationResult.feedback?.strengths?.map((s: string, idx: number) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
              <h4 className="font-extrabold mb-1">Areas for Improvement:</h4>
              <ul className="list-disc pl-4 space-y-1">
                {evaluationResult.feedback?.improvements?.map((imp: string, idx: number) => (
                  <li key={idx}>{imp}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                setSession(null);
                setEvaluationResult(null);
              }}
              className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 shadow-md"
            >
              Start New Mock Interview
            </button>
          </div>
        </div>
      ) : (
        /* Live Voice Interview Canvas */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Transcript Log (Left Column) */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between h-[520px]">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 mb-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase text-slate-500">Live Interview Transcript Stream</h3>
              <Badge variant="blue">{role}</Badge>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {transcript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl text-xs max-w-[85%] ${
                    msg.speaker === 'AI'
                      ? 'bg-brand-50/80 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-900 text-slate-900 dark:text-white mr-auto'
                      : 'bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-slate-900 dark:text-white ml-auto text-right'
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    {msg.speaker === 'AI' ? '🤖 AI Interviewer' : '👤 You'}
                  </span>
                  <p className="leading-relaxed font-medium">{msg.message}</p>
                </div>
              ))}
            </div>

            {/* AI Active Question Box */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-brand-400 font-bold uppercase">Current AI Question</span>
                <button
                  onClick={() => speakText(currentQuestion)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <Volume2 className="h-4 w-4" /> Replay Audio
                </button>
              </div>
              <p className="text-xs font-bold text-white">{currentQuestion}</p>
            </div>
          </div>

          {/* Microphone & Response Control (Right Column) */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-6">
            <div>
              <h3 className="font-bold text-xs uppercase text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
                Voice Response Studio
              </h3>

              <div className="text-center py-6 space-y-4">
                <button
                  onClick={toggleRecording}
                  className={`h-24 w-24 rounded-full mx-auto flex items-center justify-center transition-all shadow-xl ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse ring-8 ring-rose-500/30'
                      : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {isRecording ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
                </button>

                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {isRecording ? '🔴 Recording... Speak your answer now' : 'Click microphone to record your answer'}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Captured Response Text:</label>
                <textarea
                  rows={4}
                  value={recordedText}
                  onChange={(e) => setRecordedText(e.target.value)}
                  placeholder="Voice input text will appear here..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleSendResponse}
                disabled={submitting || !recordedText.trim()}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50 transition-colors shadow-md flex items-center justify-center gap-2"
              >
                {submitting ? 'Submitting...' : 'Submit Answer & Proceed →'}
              </button>

              <button
                onClick={handleFinishInterview}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Finish & Get AI Evaluation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
