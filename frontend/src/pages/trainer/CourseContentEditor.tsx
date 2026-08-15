import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Course, Module } from '../../types';
import { Badge } from '../../components/Badge';
import { PlusCircle, Upload, Video, FileText, Trash2, Edit, CheckCircle2, AlertCircle, RefreshCw, Eye } from 'lucide-react';

export const CourseContentEditor: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const courseIdParam = searchParams.get('courseId');

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseIdParam || '');
  const [courseDetail, setCourseDetail] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MODULES' | 'VIDEOS' | 'NOTES'>(
    tabParam === 'notes' ? 'NOTES' : tabParam === 'videos' ? 'VIDEOS' : tabParam === 'modules' ? 'MODULES' : 'OVERVIEW'
  );

  // Upload Video Modal state
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  const [targetModuleId, setTargetModuleId] = useState('');
  const [targetLessonId, setTargetLessonId] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trainer/courses')
      .then((res: any) => {
        if (res.success && res.data.courses.length > 0) {
          setCourses(res.data.courses);
          const activeId = courseIdParam || res.data.courses[0]._id;
          setSelectedCourseId(activeId);
          fetchCourseHierarchy(activeId);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseIdParam]);

  const fetchCourseHierarchy = (cId: string) => {
    api.get(`/courses/${cId}`)
      .then((res: any) => {
        if (res.success && res.data) {
          setCourseDetail(res.data.course);
          setModules(res.data.modules || []);
          if (res.data.modules.length > 0) {
            setTargetModuleId(res.data.modules[0]._id);
            if (res.data.modules[0].lessons?.length > 0) {
              setTargetLessonId(res.data.modules[0].lessons[0]._id);
            }
          }
        }
      })
      .catch(console.error);
  };

  const handleUploadMediaSubmit = async (e: React.FormEvent, type: 'VIDEO' | 'NOTES') => {
    e.preventDefault();
    if (!selectedFile) return alert('Please choose a file to upload');

    setUploading(true);
    setUploadProgress(20);
    setUploadSuccess('');

    let lessonIdToUse = targetLessonId;

    // Create lesson if needed
    if (!lessonIdToUse && targetModuleId) {
      const newLessRes: any = await api.post(`/trainer/modules/${targetModuleId}/lessons`, {
        courseId: selectedCourseId,
        title: mediaTitle || selectedFile.name,
        type,
      });
      lessonIdToUse = newLessRes.data.lesson._id;
    }

    const interval = setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? 90 : prev + 25));
    }, 200);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Content = (reader.result as string).split(',')[1];
      try {
        await api.post(`/trainer/lessons/${lessonIdToUse}/media`, {
          type,
          fileBuffer: base64Content,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          courseSlug: courseDetail?.slug || 'python-course',
          status: uploadStatus,
        });

        setUploadProgress(100);
        setUploadSuccess(`✓ ${type === 'VIDEO' ? 'Video' : 'Notes'} uploaded to Supabase Storage & published to Student LMS!`);
        setShowVideoModal(false);
        setShowNotesModal(false);
        setSelectedFile(null);
        setMediaTitle('');
        fetchCourseHierarchy(selectedCourseId);
      } catch (err: any) {
        alert(err.message || 'Upload failed');
      } finally {
        clearInterval(interval);
        setUploading(false);
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  // Flattened video and notes lists
  const allLessons = modules.flatMap((m) => m.lessons || []);
  const videoLessons = allLessons.filter((l) => l.videoUrl || l.type === 'VIDEO');
  const notesLessons = allLessons.filter((l) => l.notesFileUrl || l.type === 'NOTES');

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Prominent Upload Action Buttons (Requirements 5 & 6) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Course Content Management & Upload Workspace</h1>
          <p className="text-xs text-slate-500">Upload lesson videos and PDF notes directly to Supabase Storage. Published content automatically updates Student LMS.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowVideoModal(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors shadow-md flex items-center gap-2"
          >
            <Video className="h-4 w-4" /> + Upload Video
          </button>

          <button
            onClick={() => setShowNotesModal(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-colors shadow-md flex items-center gap-2"
          >
            <Upload className="h-4 w-4" /> + Upload Notes
          </button>
        </div>
      </div>

      {uploadSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> {uploadSuccess}
          </div>
          <span className="text-[10px] font-mono">AUTOMATICALLY LIVE IN STUDENT LMS</span>
        </div>
      )}

      {/* Tabs Bar (Requirement 9) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(['OVERVIEW', 'MODULES', 'VIDEOS', 'NOTES'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab
                ? 'bg-brand-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab === 'OVERVIEW' ? 'Overview' : tab === 'MODULES' ? 'Modules' : tab === 'VIDEOS' ? '🎥 Videos' : '📄 Notes'}
          </button>
        ))}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Active Course: {courseDetail?.title}</h3>
            <p className="text-xs text-slate-500">{courseDetail?.description}</p>
            <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs border-t border-slate-100 dark:border-slate-800">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-bold">Total Modules</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{modules.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-bold">Videos Uploaded</span>
                <span className="font-extrabold text-emerald-600">{videoLessons.length}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-bold">Notes PDFs</span>
                <span className="font-extrabold text-brand-600">{notesLessons.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Videos Management (Requirement 9 & 13) */}
      {activeTab === 'VIDEOS' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Lesson Title</th>
                <th className="p-4">Storage File Path</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {videoLessons.map((les) => (
                <tr key={les._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Video className="h-4 w-4 text-emerald-500" /> {les.title}
                  </td>
                  <td className="p-4 font-mono text-[11px] text-brand-600 truncate max-w-[200px]">
                    {les.videoUrl || 'course-videos/sample.mp4'}
                  </td>
                  <td className="p-4 font-semibold">{les.durationMinutes || 20} mins</td>
                  <td className="p-4">
                    <Badge variant="green">PUBLISHED</Badge>
                  </td>
                  <td className="p-4 flex items-center gap-2">
                    <a
                      href={les.videoUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200"
                    >
                      Preview
                    </a>
                    <button
                      onClick={() => {
                        setTargetLessonId(les._id);
                        setShowVideoModal(true);
                      }}
                      className="px-3 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-bold hover:bg-brand-700"
                    >
                      Replace Video
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Notes Management (Requirement 9 & 14) */}
      {activeTab === 'NOTES' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Lesson Title</th>
                <th className="p-4">File Name / Path</th>
                <th className="p-4">Type</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {notesLessons.map((les) => (
                <tr key={les._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-500" /> {les.title}
                  </td>
                  <td className="p-4 font-mono text-[11px] text-brand-600 truncate max-w-[200px]">
                    {les.notesFileUrl || 'course-notes/sample.pdf'}
                  </td>
                  <td className="p-4 font-bold uppercase">{les.notesFileType || 'PDF'}</td>
                  <td className="p-4">
                    <Badge variant="green">PUBLISHED</Badge>
                  </td>
                  <td className="p-4 flex items-center gap-2">
                    <a
                      href={les.notesFileUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:bg-slate-200"
                    >
                      Preview
                    </a>
                    <button
                      onClick={() => {
                        setTargetLessonId(les._id);
                        setShowNotesModal(true);
                      }}
                      className="px-3 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-bold hover:bg-brand-700"
                    >
                      Replace Notes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal 1: Upload Lesson Video (Requirement 5) */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-bold text-base text-white">UPLOAD LESSON VIDEO</h3>
            <form onSubmit={(e) => handleUploadMediaSubmit(e, 'VIDEO')} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                >
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Module</label>
                <select
                  value={targetModuleId}
                  onChange={(e) => setTargetModuleId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                >
                  {modules.map((m) => (
                    <option key={m._id} value={m._id}>{m.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Choose Video File (MP4 / WebM)</label>
                <input
                  type="file"
                  required
                  accept="video/mp4,video/webm"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Publication Status</label>
                <select
                  value={uploadStatus}
                  onChange={(e: any) => setUploadStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                >
                  <option value="PUBLISHED">PUBLISHED (Automatically Live in Student LMS)</option>
                  <option value="DRAFT">DRAFT (Hidden from Students)</option>
                </select>
              </div>

              {uploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-brand-400">
                    <span>Uploading to Supabase Storage bucket [course-videos]...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVideoModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Upload Lesson Notes (Requirement 6) */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-bold text-base text-white">UPLOAD LESSON NOTES</h3>
            <form onSubmit={(e) => handleUploadMediaSubmit(e, 'NOTES')} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Course</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                >
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Module</label>
                <select
                  value={targetModuleId}
                  onChange={(e) => setTargetModuleId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                >
                  {modules.map((m) => (
                    <option key={m._id} value={m._id}>{m.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Choose File (PDF / DOCX / PPTX)</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.pptx"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Publication Status</label>
                <select
                  value={uploadStatus}
                  onChange={(e: any) => setUploadStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                >
                  <option value="PUBLISHED">PUBLISHED (Automatically Live in Student LMS)</option>
                  <option value="DRAFT">DRAFT (Hidden from Students)</option>
                </select>
              </div>

              {uploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-brand-400">
                    <span>Uploading to Supabase Storage bucket [course-notes]...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNotesModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
