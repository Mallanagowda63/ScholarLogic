import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { FileText, PlusCircle, CheckCircle2, Clock, Send, Edit, Eye } from 'lucide-react';

export const TrainerAssignments: React.FC = () => {
  const [searchParams] = useSearchParams();
  const actionParam = searchParams.get('action');

  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);

  // Creation modal state
  const [showCreateModal, setShowCreateModal] = useState(actionParam === 'create');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxMarks, setMaxMarks] = useState(100);

  // Grading modal state
  const [gradingSubmission, setGradingSubmission] = useState<any | null>(null);
  const [marksObtained, setMarksObtained] = useState<number>(85);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = () => {
    setLoading(true);
    api.get('/trainer/assignments')
      .then((res: any) => {
        if (res.success) {
          setAssignments(res.data.assignments || []);
          if (res.data.assignments.length > 0) {
            setSelectedAssignmentId(res.data.assignments[0]._id);
            fetchSubmissions(res.data.assignments[0]._id);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const fetchSubmissions = (aId: string) => {
    api.get(`/trainer/assignments/${aId}/submissions`)
      .then((res: any) => {
        if (res.success) setSubmissions(res.data.submissions || []);
      })
      .catch(console.error);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const coursesRes: any = await api.get('/trainer/courses');
      const course = coursesRes.data.courses[0];
      if (!course) return alert('No assigned course found');

      const courseDetails: any = await api.get(`/courses/${course._id}`);
      const lessonId = courseDetails.data.modules[0]?.lessons[0]?._id;

      await api.post('/trainer/assignments', {
        courseId: course._id,
        lessonId: lessonId || course._id,
        title,
        description,
        dueDate,
        maxMarks,
      });

      alert('Assignment created and published to students!');
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      fetchAssignments();
    } catch (err: any) {
      alert(err.message || 'Failed to create assignment');
    }
  };

  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    try {
      await api.post(`/trainer/submissions/${gradingSubmission._id}/grade`, {
        marksObtained,
        feedback,
      });
      alert('Grade & feedback submitted successfully!');
      setGradingSubmission(null);
      if (selectedAssignmentId) fetchSubmissions(selectedAssignmentId);
    } catch (err: any) {
      alert(err.message || 'Failed to submit grade');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Assignments & Submission Grading</h1>
          <p className="text-xs text-slate-500">Create coursework, review student code & documents, and grade submissions</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-md"
        >
          <PlusCircle className="h-4 w-4" /> + Create Assignment
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Assignment Selection List (Left Column) */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Course Assignments</h3>

            <div className="space-y-3">
              {assignments.map((a) => (
                <div
                  key={a._id}
                  onClick={() => {
                    setSelectedAssignmentId(a._id);
                    fetchSubmissions(a._id);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                    selectedAssignmentId === a._id
                      ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-brand-600">{a.courseId?.title || 'Python Course'}</span>
                    <Badge variant={a.pendingReview > 0 ? 'amber' : 'green'}>{a.pendingReview} Pending</Badge>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">{a.title}</h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                    <span className="font-bold text-emerald-600">{a.totalSubmissions} Submissions</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submissions Table & Grading Area (Right 2 Columns) */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Student Submission Reviews</h3>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-4">Student</th>
                    <th className="p-4">Submitted File / Link</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Marks</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {submissions.map((sub) => (
                    <tr key={sub._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {(sub.studentId as any)?.userId?.fullName || 'Alex Morgan'}
                        <span className="block text-[10px] font-mono text-brand-600">{(sub.studentId as any)?.studentId}</span>
                      </td>
                      <td className="p-4">
                        <a
                          href={sub.fileUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-brand-600 underline truncate max-w-[150px] block"
                        >
                          {sub.fileUrl ? 'View Submission PDF' : 'Source Code Submission'}
                        </a>
                      </td>
                      <td className="p-4">
                        <Badge variant={sub.status === 'GRADED' ? 'green' : 'amber'}>{sub.status}</Badge>
                      </td>
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {sub.status === 'GRADED' ? `${sub.marksObtained} / 100` : 'Not Graded'}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setGradingSubmission(sub);
                            setMarksObtained(sub.marksObtained || 85);
                            setFeedback(sub.feedback || '');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold text-[11px] hover:bg-brand-700"
                        >
                          Grade & Feedback
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Create Assignment */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-bold text-base text-white">Create New Course Assignment</h3>
            <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Assignment Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Python OOP Practice Assignment"
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Instructions & Guidelines</label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Implement inheritance and polymorphism in Python..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Max Marks</label>
                  <input
                    type="number"
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700">
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Grade Submission */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h3 className="font-bold text-base text-white">Grade Student Submission</h3>
            <form onSubmit={handleGradeSubmission} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Marks Awarded (out of 100)</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={marksObtained}
                  onChange={(e) => setMarksObtained(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Trainer Feedback & Comments</label>
                <textarea
                  rows={4}
                  required
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Great implementation of class structures. Watch out for edge-case handling in method override."
                  className="w-full rounded-xl border border-slate-800 bg-slate-800 p-2.5 text-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-800 bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700">
                  Submit Grade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
