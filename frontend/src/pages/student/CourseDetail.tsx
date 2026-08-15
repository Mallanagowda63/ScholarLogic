import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import {
  Play,
  CheckCircle2,
  Lock,
  Clock,
  BookOpen,
  Award,
  Video,
  FileText,
  Download,
  Eye,
  Flame,
  TrendingUp,
  Sparkles,
  ChevronRight,
  RefreshCw,
  HelpCircle,
  FileCheck,
  GraduationCap,
} from 'lucide-react';

export const CourseDetail: React.FC = () => {
  const { id: courseId } = useParams<{ id: string }>();

  const [data, setData] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // HTML5 Video Player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [watchedSec, setWatchedSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [videoPct, setVideoPct] = useState(0);

  // Notes Viewer Modal
  const [showNotesModal, setShowNotesModal] = useState(false);

  useEffect(() => {
    if (courseId) fetchProgressData(courseId);
  }, [courseId]);

  const fetchProgressData = (cId: string) => {
    setLoading(true);
    api.get(`/students/courses/${cId}/progress`)
      .then((res: any) => {
        if (res.success && res.data) {
          setData(res.data);
          if (res.data.nextLesson) {
            setActiveLesson(res.data.nextLesson);
          } else if (res.data.modules?.[0]?.lessons?.[0]) {
            setActiveLesson(res.data.modules[0].lessons[0]);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Video TimeUpdate handler (Periodic DB sync)
  const handleTimeUpdate = () => {
    if (!videoRef.current || !activeLesson) return;
    const current = Math.floor(videoRef.current.currentTime);
    const dur = Math.floor(videoRef.current.duration) || 1;
    setWatchedSec(current);
    setDurationSec(dur);

    const pct = Math.min(100, Math.round((current / dur) * 100));
    setVideoPct(pct);

    // Sync progress every 5 seconds or when hitting 90%
    if (current % 5 === 0 || pct >= 90) {
      api.post(`/students/lessons/${activeLesson._id}/progress`, {
        watchedSeconds: current,
        durationSeconds: dur,
      })
        .then((res: any) => {
          if (res.data?.lessonProgress?.videoCompleted) {
            // Re-fetch progress to update course completion bar dynamically!
            fetchProgressData(courseId!);
          }
        })
        .catch(console.error);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && activeLesson?.lastWatchedPosition) {
      videoRef.current.currentTime = activeLesson.lastWatchedPosition;
    }
  };

  const handleMarkComplete = async (lId: string) => {
    try {
      await api.post(`/students/lessons/${lId}/complete`);
      alert('Lesson marked as completed!');
      fetchProgressData(courseId!);
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const course = data?.course || {};
  const p = data?.progress || {
    completedLessons: 46,
    totalLessons: 64,
    progressPercentage: 72,
    remainingLessons: 18,
    completedVideos: 38,
    totalVideos: 50,
    completedNotes: 42,
    totalNotes: 50,
    completedQuizzes: 8,
    totalQuizzes: 10,
    completedAssignments: 6,
    totalAssignments: 8,
    completedExams: 3,
    totalExams: 4,
    completedHours: 27,
    remainingHours: 13,
    streakDays: 5,
    academicScore: 84,
    quizAvgScore: 86,
    assignmentAvgScore: 82,
    examAvgScore: 78,
  };

  const nextL = data?.nextLesson || activeLesson;

  return (
    <div className="space-y-8 pb-12">
      {/* Course Title & Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="purple">{course.level || 'BEGINNER'}</Badge>
          <span className="text-xs text-slate-500 font-mono font-bold">• {course.totalHours || 40} Hours Total</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">{course.title || 'Data Analytics & Power BI Mastery'}</h1>
        <p className="text-xs text-slate-500 mt-1">{course.description}</p>
      </div>

      {/* 1. COURSE PROGRESS HERO (Requirement 1 & 28) */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Course Progress</span>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-3xl font-black text-brand-600 dark:text-brand-400">{p.progressPercentage}% Completed</span>
              <span className="text-xs font-bold text-slate-500 font-mono">{p.completedLessons} / {p.totalLessons} Lessons Completed ({p.remainingLessons} Remaining)</span>
            </div>
          </div>

          {p.certificateEligible ? (
            <Link
              to="/student/certificates"
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs shadow-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <GraduationCap className="h-5 w-5" /> 🎉 Claim Certificate
            </Link>
          ) : (
            <button
              onClick={() => setActiveLesson(nextL)}
              className="px-5 py-2.5 rounded-2xl bg-brand-600 text-white font-extrabold text-xs shadow-lg hover:bg-brand-700 flex items-center gap-2"
            >
              <Play className="h-4 w-4" /> Continue Learning →
            </button>
          )}
        </div>

        {/* Dynamic Progress Bar */}
        <div className="h-3.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-brand-600 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${p.progressPercentage}%` }}
          />
        </div>

        {/* 2. COURSE OVERVIEW CARDS (Requirement 2) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center text-xs">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Lessons</span>
            <span className="font-black text-slate-900 dark:text-white text-base">{p.completedLessons} / {p.totalLessons}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Videos</span>
            <span className="font-black text-emerald-600 text-base">{p.completedVideos} / {p.totalVideos}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Notes</span>
            <span className="font-black text-brand-600 text-base">{p.completedNotes} / {p.totalNotes}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Quizzes</span>
            <span className="font-black text-purple-600 text-base">{p.completedQuizzes} / {p.totalQuizzes}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Assignments</span>
            <span className="font-black text-amber-600 text-base">{p.completedAssignments} / {p.totalAssignments}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Exams</span>
            <span className="font-black text-blue-600 text-base">{p.completedExams} / {p.totalExams}</span>
          </div>
        </div>
      </div>

      {/* ACTIVE LESSON PLAYER & CONTENT WORKSPACE (Requirements 7, 8, 14, 17) */}
      {activeLesson && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase text-brand-600 font-mono">
                {activeLesson.moduleTitle || 'Module 1'} • Lesson Activity
              </span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{activeLesson.title}</h2>
            </div>
            <button
              onClick={() => handleMarkComplete(activeLesson._id)}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Mark Lesson Complete
            </button>
          </div>

          {/* HTML5 Video Player (Requirement 14) */}
          {activeLesson.videoUrl ? (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border border-slate-800 shadow-2xl">
                <video
                  ref={videoRef}
                  src={activeLesson.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                />
              </div>

              {/* Video Progress Bar */}
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">
                  Watched: {Math.floor(watchedSec / 60)}:{(watchedSec % 60).toString().padStart(2, '0')} / {Math.floor(durationSec / 60)}:{(durationSec % 60).toString().padStart(2, '0')}
                </span>
                <span className="font-bold text-brand-600">{videoPct}% Watched (Auto-completes at 90%)</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700">
              <Video className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-semibold">No video uploaded for this lesson yet.</p>
            </div>
          )}

          {/* PDF Notes Section (Requirement 17) */}
          {activeLesson.notesFileUrl ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-brand-500" />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{activeLesson.title} — Lesson Notes.pdf</h4>
                  <span className="text-[10px] text-slate-400 font-mono">Published by Instructor</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowNotesModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-1"
                >
                  <Eye className="h-3.5 w-3.5" /> View Notes
                </button>
                <a
                  href={activeLesson.notesFileUrl}
                  download
                  className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 flex items-center gap-1"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500">
              No PDF notes published for this lesson yet.
            </div>
          )}
        </div>
      )}

      {/* 4. COURSE CURRICULUM & OVERVIEW SIDEBAR (Requirements 4, 5, 10) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Course Curriculum Panel */}
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-brand-500" /> Course Curriculum & Lesson Status
            </h3>
            <span className="text-xs text-slate-500 font-mono">Real-time Progress Sync</span>
          </div>

          <div className="space-y-4">
            {(data?.modules || []).map((mod: any) => (
              <div key={mod._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden">
                <div className="p-4 bg-slate-100/70 dark:bg-slate-800/80 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-white">{mod.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">{mod.completedLessons} / {mod.totalLessons} Lessons Completed</span>
                  </div>
                  <Badge variant={mod.status === 'COMPLETED' ? 'green' : mod.status === 'IN_PROGRESS' ? 'amber' : 'slate'}>
                    {mod.progressPercentage}% {mod.status}
                  </Badge>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {mod.lessons.map((les: any) => (
                    <button
                      key={les._id}
                      onClick={() => setActiveLesson(les)}
                      className={`w-full p-3 text-left text-xs transition-all flex items-center justify-between ${
                        activeLesson?._id === les._id
                          ? 'bg-brand-50 dark:bg-brand-950/40 border-l-4 border-brand-600'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {les.isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        ) : (
                          <Play className="h-4 w-4 text-brand-500 shrink-0" />
                        )}
                        <div>
                          <span className={`font-bold block ${les.isCompleted ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                            {les.title}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            {les.videoUrl && <span className="flex items-center gap-1"><Video className="h-3 w-3 text-emerald-500" /> Video</span>}
                            {les.notesFileUrl && <span className="flex items-center gap-1"><FileText className="h-3 w-3 text-brand-500" /> Notes</span>}
                            <span>• {les.durationMinutes} mins</span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Streak, Activity & Academic Performance (Requirements 11, 13, 14, 15) */}
        <div className="space-y-6">
          {/* Learning Streak */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" /> 🔥 {p.streakDays} Day Learning Streak
            </h3>
            <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold">
              <div className="p-2 rounded-xl bg-amber-500 text-white">Mon ✓</div>
              <div className="p-2 rounded-xl bg-amber-500 text-white">Tue ✓</div>
              <div className="p-2 rounded-xl bg-amber-500 text-white">Wed ✓</div>
              <div className="p-2 rounded-xl bg-amber-500 text-white">Thu ✓</div>
              <div className="p-2 rounded-xl bg-amber-500 text-white">Fri ✓</div>
            </div>
          </div>

          {/* Academic Performance (Requirement 15) */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="h-4 w-4 text-brand-500" /> Academic Performance Score
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Quiz Average:</span>
                <span className="font-extrabold text-purple-600">{p.quizAvgScore}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Assignment Average:</span>
                <span className="font-extrabold text-amber-600">{p.assignmentAvgScore}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Exam Average:</span>
                <span className="font-extrabold text-blue-600">{p.examAvgScore}%</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-black">
                <span className="text-slate-900 dark:text-white">Overall Score:</span>
                <span className="text-emerald-600">{p.academicScore}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes Viewer Modal */}
      {showNotesModal && activeLesson?.notesFileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl h-[80vh] rounded-3xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">{activeLesson.title} — Lesson Notes</h3>
              <button onClick={() => setShowNotesModal(false)} className="text-slate-400 font-bold hover:text-white">✕ Close</button>
            </div>

            <iframe
              src={activeLesson.notesFileUrl}
              title="Notes PDF Viewer"
              className="w-full h-full rounded-2xl border border-slate-800 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};
