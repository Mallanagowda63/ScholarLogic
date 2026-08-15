import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Course } from '../../types';
import { Badge } from '../../components/Badge';
import { Search, BookOpen, Clock, ArrowRight, Video, FileText, CheckCircle2, Play, Download, Eye, TrendingUp, Filter, Sparkles } from 'lucide-react';

export const StudentCourses: React.FC = () => {
  const { studentProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const courseParam = searchParams.get('courseId');

  const [courses, setCourses] = useState<Course[]>([]);
  const [registeredProgress, setRegisteredProgress] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseParam || '');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  const activeTab = tabParam === 'videos' ? 'VIDEOS' : tabParam === 'notes' ? 'NOTES' : tabParam === 'progress' ? 'PROGRESS' : 'COURSES';

  useEffect(() => {
    fetchRegisteredCoursesData();
  }, [category]);

  const fetchRegisteredCoursesData = () => {
    setLoading(true);
    let url = '/courses?';
    if (category) url += `category=${encodeURIComponent(category)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    api.get(url)
      .then(async (res: any) => {
        if (res.success && res.data.courses) {
          const fetchedCourses = res.data.courses || [];
          setCourses(fetchedCourses);

          // Auto-match selected course based on student's preferred role if not explicitly set
          if (!courseParam && studentProfile?.preferredRole && fetchedCourses.length > 0) {
            const role = studentProfile.preferredRole.toLowerCase();
            const matched = fetchedCourses.find((c: any) => {
              const title = c.title.toLowerCase();
              const cat = c.category.toLowerCase();
              return (
                (role.includes('devops') && (title.includes('devops') || cat.includes('devops'))) ||
                (role.includes('cloud') && (title.includes('aws') || cat.includes('cloud'))) ||
                (role.includes('full stack') && (title.includes('python') || cat.includes('software'))) ||
                (role.includes('data') && (title.includes('data') || cat.includes('data')))
              );
            });

            if (matched) {
              setSelectedCourseId(matched._id);
            }
          }

          // Fetch student progress per registered course
          const progressPromises = fetchedCourses.map(async (c: any) => {
            try {
              const pRes: any = await api.get(`/students/courses/${c._id}/progress`);
              return { courseId: c._id, courseTitle: c.title, category: c.category, thumbnailUrl: c.thumbnailUrl, durationHours: c.durationHours, ...pRes.data };
            } catch {
              return {
                courseId: c._id,
                courseTitle: c.title,
                category: c.category,
                thumbnailUrl: c.thumbnailUrl,
                durationHours: c.durationHours,
                progress: { progressPercentage: 0, completedLessons: 0, totalLessons: 10, completedVideos: 0, totalVideos: 5, completedNotes: 0, totalNotes: 5 },
                modules: [],
              };
            }
          });

          const pResults = await Promise.all(progressPromises);
          setRegisteredProgress(pResults);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRegisteredCoursesData();
  };

  // Filter datasets strictly by selected course if selectedCourseId is set
  const filteredCourses = selectedCourseId
    ? courses.filter((c) => c._id === selectedCourseId)
    : courses;

  const filteredRegisteredProgress = selectedCourseId
    ? registeredProgress.filter((cp) => cp.courseId === selectedCourseId)
    : registeredProgress;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Course Selection Pipeline Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            {activeTab === 'COURSES' ? 'My Registered Courses (LMS)' : activeTab === 'VIDEOS' ? '🎥 Registered Lesson Videos' : activeTab === 'NOTES' ? '📄 Registered Lesson Notes' : '📊 Course Learning Progress'}
          </h1>
          <p className="text-xs text-slate-500">
            {activeTab === 'COURSES'
              ? 'Select a course to view its specific modules, video lectures, and PDF notes'
              : activeTab === 'VIDEOS'
              ? 'Recorded video lectures exclusively for your selected registered course'
              : activeTab === 'NOTES'
              ? 'Downloadable PDF notes & study materials for your selected registered course'
              : 'Real-time completion percentage and milestone scores'}
          </p>
        </div>

        {/* Filter Controls (Course Selection Selector) */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Select Specific Course Dropdown */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <Filter className="h-4 w-4 text-brand-500 ml-2" />
            <select
              value={selectedCourseId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCourseId(val);
                if (val) {
                  searchParams.set('courseId', val);
                } else {
                  searchParams.delete('courseId');
                }
                setSearchParams(searchParams);
              }}
              className="rounded-lg border-none bg-transparent px-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="">All Registered Courses</option>
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search registered courses..."
              className="w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </form>
        </div>
      </div>

      {/* Selected Course Active Banner (If specific course is selected) */}
      {selectedCourseId && filteredCourses.length > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-200">Active Selected Course Pipeline</span>
              <h3 className="font-extrabold text-sm text-white">{filteredCourses[0].title}</h3>
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedCourseId('');
              searchParams.delete('courseId');
              setSearchParams(searchParams);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-bold text-white transition-colors"
          >
            Show All Courses
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : activeTab === 'COURSES' ? (
        /* TAB 1: Registered Courses Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((c) => {
            const p = registeredProgress.find((item) => item.courseId === c._id)?.progress || { progressPercentage: 0, completedLessons: 0, totalLessons: 10 };
            const isDevOps = c.title.toLowerCase().includes('devops');
            const thumbUrl = c.thumbnailUrl && !c.thumbnailUrl.includes('1618401471353')
              ? c.thumbnailUrl
              : isDevOps
              ? 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=500'
              : 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=500';

            return (
              <div
                key={c._id}
                className={`group flex flex-col justify-between rounded-2xl border bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 ${
                  selectedCourseId === c._id ? 'border-2 border-brand-500 ring-4 ring-brand-500/10' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="relative aspect-video overflow-hidden bg-slate-950">
                    <img
                      src={thumbUrl}
                      alt={c.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3">
                      <Badge variant="green">REGISTERED</Badge>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">{c.category}</span>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1">{c.title}</h3>

                    {/* Registered Progress Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Progress</span>
                        <span className="text-brand-600">{p.progressPercentage}% ({p.completedLessons}/{p.totalLessons})</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${p.progressPercentage}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between mt-4">
                  <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-brand-500" /> {c.durationHours}h
                  </span>

                  <Link
                    to={`/student/courses/${c._id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold shadow-md hover:bg-brand-700 transition-colors"
                  >
                    Open LMS <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : activeTab === 'VIDEOS' ? (
        /* TAB 2: Recorded Videos filtered strictly to Selected Course */
        <div className="space-y-6">
          {filteredRegisteredProgress.map((cp) => {
            const videoLessons = (cp.modules || []).flatMap((m: any) => m.lessons || []).filter((l: any) => l.videoUrl || l.type === 'VIDEO');
            return (
              <div key={cp.courseId} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Video className="h-5 w-5 text-emerald-500" /> {cp.courseTitle}
                  </h3>
                  <Badge variant="blue">{videoLessons.length} Recorded Videos</Badge>
                </div>

                {videoLessons.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {videoLessons.map((les: any) => (
                      <div key={les._id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 font-bold">
                            <Play className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">{les.title}</h4>
                            <span className="text-[10px] text-slate-400 font-mono">{les.durationMinutes || 20} mins • Video Lecture</span>
                          </div>
                        </div>

                        <Link
                          to={`/student/courses/${cp.courseId}`}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700"
                        >
                          ▶ Watch Video
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No recorded videos published for this course yet.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : activeTab === 'NOTES' ? (
        /* TAB 3: Downloadable Notes filtered strictly to Selected Course */
        <div className="space-y-6">
          {filteredRegisteredProgress.map((cp) => {
            const notesLessons = (cp.modules || []).flatMap((m: any) => m.lessons || []).filter((l: any) => l.notesFileUrl || l.type === 'NOTES');
            return (
              <div key={cp.courseId} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-brand-500" /> {cp.courseTitle}
                  </h3>
                  <Badge variant="purple">{notesLessons.length} PDF Notes</Badge>
                </div>

                {notesLessons.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {notesLessons.map((les: any) => (
                      <div key={les._id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <FileText className="h-6 w-6 text-brand-500 shrink-0" />
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">{les.title} Notes.pdf</h4>
                            <span className="text-[10px] text-slate-400 font-mono">Official PDF Handout</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={les.notesFileUrl || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px]"
                          >
                            View
                          </a>
                          <a
                            href={les.notesFileUrl || '#'}
                            download
                            className="px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold text-[11px] hover:bg-brand-700"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No notes documents published for this course yet.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* TAB 4: Registered Course Progress Overview filtered strictly to Selected Course */
        <div className="space-y-6">
          {filteredRegisteredProgress.map((cp) => {
            const p = cp.progress || { progressPercentage: 0, completedLessons: 0, totalLessons: 10 };
            return (
              <div key={cp.courseId} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{cp.courseTitle}</h3>
                    <span className="text-xs text-slate-500 font-mono">{p.completedLessons} of {p.totalLessons} Lessons Completed</span>
                  </div>
                  <Badge variant="amber">{p.progressPercentage}% Completed</Badge>
                </div>

                <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${p.progressPercentage}%` }} />
                </div>

                <div className="flex justify-end pt-2">
                  <Link
                    to={`/student/courses/${cp.courseId}`}
                    className="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700"
                  >
                    Open Course Detail & Video Workspace →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
