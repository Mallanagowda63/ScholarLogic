import React, { useEffect, useRef, useState } from 'react';
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

  // Zoho & Upload Video Source states
  const [videoSource, setVideoSource] = useState<'UPLOAD' | 'ZOHO_MEETING'>('UPLOAD');
  const [useCustomModule, setUseCustomModule] = useState(false);
  const [customModuleName, setCustomModuleName] = useState('');
  // Course typed by the trainer: reused if it exists (and assigned to them), otherwise created
  const [useCustomCourse, setUseCustomCourse] = useState(false);
  const [customCourseName, setCustomCourseName] = useState('');
  const writingCourse = useCustomCourse || courses.length === 0;
  const resolveCourseId = async (): Promise<string> => {
    if (!writingCourse && selectedCourseId) return selectedCourseId;
    const name = customCourseName.trim();
    if (!name) throw new Error('Please write the course name');
    const res: any = await api.post('/trainer/courses', { title: name });
    const course = res.data.course;
    setCourses((list) => (list.some((c) => c._id === course._id) ? list : [course, ...list]));
    setSelectedCourseId(course._id);
    setUseCustomCourse(false);
    setCustomCourseName('');
    return course._id;
  };
  const [zohoUrl, setZohoUrl] = useState('');
  const [zohoValidating, setZohoValidating] = useState(false);
  const [zohoMetadata, setZohoMetadata] = useState<any>(null);
  const [zohoError, setZohoError] = useState('');

  // Which batches receive uploaded notes (a trainer usually runs several batches)
  const [myBatches, setMyBatches] = useState<any[]>([]);
  const [notesAudience, setNotesAudience] = useState<'BATCHES' | 'ALL'>('BATCHES');
  const [notesBatchIds, setNotesBatchIds] = useState<string[]>([]);

  // Tracks the user's current pick so a late (or StrictMode-duplicated) course list load can't overwrite it
  const selectedCourseRef = useRef(selectedCourseId);
  selectedCourseRef.current = selectedCourseId;
  // Only the most recently requested course hierarchy may update modules
  const latestHierarchyRequest = useRef('');

  useEffect(() => {
    api.get('/trainer/courses')
      .then((res: any) => {
        if (res.success && res.data.courses.length > 0) {
          setCourses(res.data.courses);
          const activeId = courseIdParam || selectedCourseRef.current || res.data.courses[0]._id;
          setSelectedCourseId(activeId);
          if (latestHierarchyRequest.current !== activeId) fetchCourseHierarchy(activeId);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [courseIdParam]);

  useEffect(() => {
    // Trainers get their own batches; admins (403 on the trainer route) get every batch
    api.get('/tracking/trainer/batches')
      .catch(() => api.get('/tracking/batches'))
      .then((res: any) => {
        const list = (res?.data?.batches || []).filter((b: any) => b.status !== 'CANCELLED');
        const rank = (s: string) => (s === 'COMPLETED' ? 1 : 0);
        setMyBatches(list.sort((a: any, b: any) => rank(a.status) - rank(b.status) || String(a.batchCode).localeCompare(String(b.batchCode))));
      })
      .catch(() => setMyBatches([]));
  }, []);

  const openNotesModal = (lesson?: any) => {
    if (lesson) setTargetLessonId(lesson._id);
    const sentTo: string[] = (lesson?.batchIds || []).map(String);
    setNotesAudience(lesson && sentTo.length === 0 ? 'ALL' : 'BATCHES');
    setNotesBatchIds(sentTo);
    setShowNotesModal(true);
  };
  const toggleNotesBatch = (id: string) =>
    setNotesBatchIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const batchLabel = (id: string) => myBatches.find((b) => String(b._id) === String(id))?.batchCode || 'Other batch';

  const fetchCourseHierarchy = (cId: string) => {
    latestHierarchyRequest.current = cId;
    api.get(`/courses/${cId}`)
      .then((res: any) => {
        if (latestHierarchyRequest.current !== cId) return;
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
    if (type === 'NOTES' && notesAudience === 'BATCHES' && notesBatchIds.length === 0) {
      return alert('Choose at least one batch to send these notes to');
    }

    setUploading(true);
    setUploadProgress(20);
    setUploadSuccess('');

    const newCourse = writingCourse;
    let courseIdToUse: string;
    let moduleIdToUse = targetModuleId;
    let lessonIdToUse = targetLessonId;
    try {
      courseIdToUse = await resolveCourseId();
      if (newCourse || useCustomModule || !moduleIdToUse) {
        if (!customModuleName.trim()) {
          setUploading(false);
          return alert('Please write a target module name');
        }
        const modRes: any = await api.post(`/trainer/courses/${courseIdToUse}/modules`, {
          title: customModuleName.trim(),
        });
        moduleIdToUse = modRes.data.module._id;
        lessonIdToUse = '';
      }
    } catch (err: any) {
      setUploading(false);
      return alert(err.message || 'Could not prepare the course');
    }

    // Create lesson if needed
    if (!lessonIdToUse || mediaTitle) {
      const newLessRes: any = await api.post(`/trainer/modules/${moduleIdToUse}/lessons`, {
        courseId: courseIdToUse,
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
          ...(type === 'NOTES' ? { batchIds: notesAudience === 'ALL' ? [] : notesBatchIds } : {}),
        });

        setUploadProgress(100);
        setUploadSuccess(
          type === 'NOTES'
            ? `✓ Notes sent to ${notesAudience === 'ALL' ? 'everyone in this course' : notesBatchIds.map(batchLabel).join(', ')}`
            : '✓ Video uploaded to Supabase Storage & published to Student LMS!'
        );
        setShowVideoModal(false);
        setShowNotesModal(false);
        setSelectedFile(null);
        setMediaTitle('');
        setCustomModuleName('');
        setUseCustomModule(false);
        fetchCourseHierarchy(courseIdToUse);
      } catch (err: any) {
        alert(err.message || 'Upload failed');
      } finally {
        clearInterval(interval);
        setUploading(false);
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleValidateZohoUrl = async () => {
    if (!zohoUrl.trim()) return alert('Please enter a Zoho Meeting recording URL');
    setZohoValidating(true);
    setZohoError('');
    setZohoMetadata(null);
    try {
      const res: any = await api.post('/trainer/zoho/validate-recording', { recordingUrl: zohoUrl });
      if (res.success && res.data) {
        setZohoMetadata(res.data);
      }
    } catch (err: any) {
      setZohoError(err.message || 'Invalid Zoho Meeting Recording URL');
    } finally {
      setZohoValidating(false);
    }
  };

  const handleAddZohoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zohoUrl.trim()) return alert('Please paste a Zoho Meeting recording URL');

    setUploading(true);
    try {
      const newCourse = writingCourse;
      const courseIdToUse = await resolveCourseId();
      let moduleIdToUse = targetModuleId;
      if (newCourse || useCustomModule || !moduleIdToUse) {
        if (!customModuleName.trim()) {
          setUploading(false);
          return alert('Please write a target module name');
        }
        const modRes: any = await api.post(`/trainer/courses/${courseIdToUse}/modules`, {
          title: customModuleName.trim(),
        });
        moduleIdToUse = modRes.data.module._id;
      }

      await api.post(`/trainer/modules/${moduleIdToUse}/lessons/zoho-recording`, {
        courseId: courseIdToUse,
        recordingUrl: zohoUrl,
        title: mediaTitle || (zohoMetadata ? zohoMetadata.title : 'Zoho Meeting Recording'),
      });

      setUploadSuccess('✓ Zoho Meeting Recording associated successfully with Lesson!');
      setShowVideoModal(false);
      setZohoUrl('');
      setZohoMetadata(null);
      setMediaTitle('');
      setCustomModuleName('');
      setUseCustomModule(false);
      fetchCourseHierarchy(courseIdToUse);
    } catch (err: any) {
      alert(err.message || 'Failed to add Zoho Meeting recording');
    } finally {
      setUploading(false);
    }
  };

  // Flattened video and notes lists
  const allLessons = modules.flatMap((m) => m.lessons || []);
  const videoLessons = allLessons.filter((l) => l.videoUrl || l.type === 'VIDEO');
  const notesLessons = allLessons.filter((l) => l.notesFileUrl || l.type === 'NOTES');

  const courseField = (
    <>
      <div className="flex items-center justify-between mb-1">
        <label className="text-slate-300 font-semibold">Target Course</label>
        {courses.length > 0 && (
          <button type="button" onClick={() => setUseCustomCourse(!useCustomCourse)} className="text-brand-400 hover:underline text-[11px] font-bold">
            {useCustomCourse ? 'Select existing course' : '+ Write course name'}
          </button>
        )}
      </div>
      {writingCourse ? (
        <>
          <input
            type="text"
            required
            list="trainer-course-names"
            placeholder="Write the course name here (e.g. Python Full Stack)..."
            value={customCourseName}
            onChange={(e) => setCustomCourseName(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-bold placeholder:text-slate-500"
          />
          <p className="mt-1 text-[10px] text-slate-400">If this course already exists it is used; otherwise it is added. Then write the module name below.</p>
        </>
      ) : (
        <select
          value={selectedCourseId}
          onChange={(e) => {
            setSelectedCourseId(e.target.value);
            fetchCourseHierarchy(e.target.value);
          }}
          className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
        >
          {courses.map((c) => (
            <option key={c._id} value={c._id}>{c.title}</option>
          ))}
        </select>
      )}
    </>
  );

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
            onClick={() => openNotesModal()}
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
                <th className="p-4">Sent To</th>
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
                  <td className="p-4">
                    {les.batchIds?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {les.batchIds.map((id) => (
                          <span key={id} className="rounded-md bg-brand-50 dark:bg-brand-950/50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                            {batchLabel(id)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500">Whole course</span>
                    )}
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
                      onClick={() => openNotesModal(les)}
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

      {/* Modal 1: Upload Lesson Video / Zoho Meeting Recording */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-bold text-base text-white">ADD LESSON VIDEO RECORDING</h3>

            {/* Video Source Radio Options */}
            <div className="space-y-1">
              <label className="block text-slate-300 font-semibold text-xs mb-1">Video Source</label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-800 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setVideoSource('UPLOAD')}
                  className={`py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                    videoSource === 'UPLOAD' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" /> Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setVideoSource('ZOHO_MEETING')}
                  className={`py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1.5 ${
                    videoSource === 'ZOHO_MEETING' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Video className="h-3.5 w-3.5" /> Zoho Meeting
                </button>
              </div>
            </div>

            {videoSource === 'UPLOAD' ? (
              <form onSubmit={(e) => handleUploadMediaSubmit(e, 'VIDEO')} className="space-y-4 text-xs">
                <div>
                  {courseField}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Target Module</label>
                    <button
                      type="button"
                      onClick={() => setUseCustomModule(!useCustomModule)}
                      className="text-brand-400 hover:underline text-[11px] font-bold"
                    >
                      {useCustomModule ? 'Select existing module' : '+ Write custom module name'}
                    </button>
                  </div>

                  {useCustomModule || writingCourse || modules.length === 0 ? (
                    <input
                      type="text"
                      required
                      placeholder="Write target module name here (e.g. Module 3: Advanced Topics)..."
                      value={customModuleName}
                      onChange={(e) => setCustomModuleName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-bold placeholder:text-slate-500"
                    />
                  ) : (
                    <select
                      value={targetModuleId}
                      onChange={(e) => setTargetModuleId(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                    >
                      {modules.map((m) => (
                        <option key={m._id} value={m._id}>{m.title}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Lesson Title</label>
                  <input
                    type="text"
                    placeholder="Write lesson title here (e.g. Lesson 1: Introduction)..."
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-slate-200 placeholder:text-slate-500 font-medium"
                  />
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
            ) : (
              <form onSubmit={handleAddZohoSubmit} className="space-y-4 text-xs">
                <div>
                  {courseField}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">Target Module</label>
                    <button
                      type="button"
                      onClick={() => setUseCustomModule(!useCustomModule)}
                      className="text-brand-400 hover:underline text-[11px] font-bold"
                    >
                      {useCustomModule ? 'Select existing module' : '+ Write custom module name'}
                    </button>
                  </div>

                  {useCustomModule || writingCourse || modules.length === 0 ? (
                    <input
                      type="text"
                      required
                      placeholder="Write target module name here (e.g. Module 3: Live Recordings)..."
                      value={customModuleName}
                      onChange={(e) => setCustomModuleName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-bold placeholder:text-slate-500"
                    />
                  ) : (
                    <select
                      value={targetModuleId}
                      onChange={(e) => setTargetModuleId(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                    >
                      {modules.map((m) => (
                        <option key={m._id} value={m._id}>{m.title}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Lesson Title</label>
                  <input
                    type="text"
                    placeholder="Write lesson title here (e.g. Session 1 Live Recording)..."
                    value={mediaTitle}
                    onChange={(e) => setMediaTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-slate-200 placeholder:text-slate-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Zoho Meeting Recording URL</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      required
                      placeholder="https://meeting.zoho.in/meeting/public/videoprv?recordingId=..."
                      value={zohoUrl}
                      onChange={(e) => setZohoUrl(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-slate-200 placeholder:text-slate-500 font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleValidateZohoUrl}
                      disabled={zohoValidating || !zohoUrl.trim()}
                      className="px-3 py-2.5 rounded-xl bg-slate-700 text-white font-bold text-xs hover:bg-slate-600 disabled:opacity-50"
                    >
                      {zohoValidating ? 'Checking...' : 'Validate'}
                    </button>
                  </div>
                </div>

                {zohoError && (
                  <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{zohoError}</span>
                  </div>
                )}

                {zohoMetadata && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Valid Zoho Meeting Recording
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1 text-slate-300">
                      <div>Provider: <span className="text-white font-bold">Zoho Meeting</span></div>
                      <div>Recording ID: <span className="text-white font-bold">{zohoMetadata.recordingId}</span></div>
                      <div>Status: <span className="text-emerald-400 font-bold">{zohoMetadata.status}</span></div>
                      {zohoMetadata.organizationId && <div>Org ID: <span className="text-white font-bold">{zohoMetadata.organizationId}</span></div>}
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
                    className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 disabled:opacity-50"
                  >
                    {uploading ? 'Associating...' : 'Add Recording'}
                  </button>
                </div>
              </form>
            )}
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
                {courseField}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">Target Module</label>
                  <button
                    type="button"
                    onClick={() => setUseCustomModule(!useCustomModule)}
                    className="text-brand-400 hover:underline text-[11px] font-bold"
                  >
                    {useCustomModule ? 'Select existing module' : '+ Write custom module name'}
                  </button>
                </div>

                {useCustomModule || writingCourse || modules.length === 0 ? (
                  <input
                    type="text"
                    required
                    placeholder="Write target module name here (e.g. Module 1: Getting Started)..."
                    value={customModuleName}
                    onChange={(e) => setCustomModuleName(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-white font-bold placeholder:text-slate-500"
                  />
                ) : (
                  <select
                    value={targetModuleId}
                    onChange={(e) => setTargetModuleId(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold"
                  >
                    {modules.map((m) => (
                      <option key={m._id} value={m._id}>{m.title}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Send To</label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-800 border border-slate-700">
                  {(['BATCHES', 'ALL'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setNotesAudience(a)}
                      className={`py-2 rounded-lg font-bold text-xs transition-colors ${notesAudience === a ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                      {a === 'BATCHES' ? 'Selected batches' : 'Whole course'}
                    </button>
                  ))}
                </div>
                {notesAudience === 'BATCHES' && (
                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-800/60">
                    {myBatches.length === 0 ? (
                      <p className="p-3 text-slate-400">No batches are assigned to you yet. Ask the admin to assign one, or send to the whole course.</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                          <span className="text-slate-400">{notesBatchIds.length} of {myBatches.length} selected</span>
                          <button
                            type="button"
                            onClick={() => setNotesBatchIds(notesBatchIds.length === myBatches.length ? [] : myBatches.map((b) => String(b._id)))}
                            className="text-brand-400 hover:underline text-[11px] font-bold"
                          >
                            {notesBatchIds.length === myBatches.length ? 'Clear all' : 'Select all'}
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1">
                          {myBatches.map((b) => (
                            <label key={b._id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-700/60">
                              <input
                                type="checkbox"
                                checked={notesBatchIds.includes(String(b._id))}
                                onChange={() => toggleNotesBatch(String(b._id))}
                                className="h-4 w-4 accent-brand-500"
                              />
                              <span className="font-bold text-white">{b.batchCode}</span>
                              <span className="truncate text-slate-400">
                                {[b.subject?.name, b.timing, b.mode === 'ONLINE' ? 'Online' : 'Offline'].filter(Boolean).join(' • ')}
                              </span>
                              <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                                {b.studentCount} students{b.status === 'COMPLETED' ? ' • completed' : ''}
                              </span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {notesAudience === 'ALL' && <p className="mt-1.5 text-[11px] text-slate-400">Every student in this course will see these notes.</p>}
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
