import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { FileText, Download, CheckCircle, Clock, ExternalLink, MessageSquare, Award } from 'lucide-react';

export const TrainerGradingPanel: React.FC = () => {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [marks, setMarks] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const res: any = await api.get('/trainer/assignments');
      if (res.success && res.data?.assignments) {
        setAssignments(res.data.assignments);
        if (res.data.assignments.length > 0) {
          const firstId = res.data.assignments[0]._id;
          setSelectedAssignmentId(firstId);
          fetchSubmissions(firstId);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async (assignmentId: string) => {
    try {
      const res: any = await api.get(`/trainer/assignments/${assignmentId}/submissions`);
      if (res.success && res.data?.submissions) {
        setSubmissions(res.data.submissions);
        if (res.data.submissions.length > 0) {
          selectSubmission(res.data.submissions[0]);
        } else {
          setSelectedSubmission(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectSubmission = (sub: any) => {
    setSelectedSubmission(sub);
    setMarks(sub.marksObtained || 0);
    setFeedback(sub.feedback || '');
  };

  const handleGradeSubmit = async () => {
    if (!selectedSubmission) return;
    try {
      setSaving(true);
      await api.post(`/trainer/submissions/${selectedSubmission._id}/grade`, {
        marksObtained: marks,
        feedback,
      });

      alert('Grade updated successfully!');
      fetchSubmissions(selectedAssignmentId);
    } catch (err: any) {
      alert(err.message || 'Failed to update grade');
    } finally {
      setSaving(false);
    }
  };

  const isPdf = (url?: string) => url?.toLowerCase().endsWith('.pdf');
  const isZip = (url?: string) => url?.toLowerCase().endsWith('.zip');

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Assignment Grading Panel</h1>
          <p className="text-xs text-slate-500">Review student PDF/ZIP submissions, inspect code, and issue grades with feedback</p>
        </div>

        {/* Assignment Filter Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500">Select Assignment:</label>
          <select
            value={selectedAssignmentId}
            onChange={(e) => {
              setSelectedAssignmentId(e.target.value);
              fetchSubmissions(e.target.value);
            }}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white shadow-sm"
          >
            {assignments.map((a) => (
              <option key={a._id} value={a._id}>
                {a.title} ({a.pendingReview} Pending)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Submissions List Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 px-2">
              Submissions ({submissions.length})
            </h3>

            {submissions.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No submissions found for this assignment.</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {submissions.map((sub) => {
                  const studentName = sub.studentId?.userId?.fullName || 'Student Candidate';
                  const studentIdStr = sub.studentId?.studentId || 'SL-STUDENT';
                  const isSelected = selectedSubmission?._id === sub._id;

                  return (
                    <div
                      key={sub._id}
                      onClick={() => selectSubmission(sub)}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 shadow-sm'
                          : 'border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{studentName}</span>
                        <Badge
                          variant={sub.status === 'GRADED' ? 'green' : 'amber'}
                          className="text-[10px] font-extrabold"
                        >
                          {sub.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                        <span className="font-mono">{studentIdStr}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Submission Details & Preview Column */}
        <div className="lg:col-span-7 space-y-6">
          {selectedSubmission ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
              {/* Submission Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedSubmission.studentId?.userId?.fullName}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {selectedSubmission.studentId?.studentId} • Submitted: {new Date(selectedSubmission.submittedAt).toLocaleString()}
                  </p>
                </div>

                {selectedSubmission.submissionFileUrl && (
                  <a
                    href={selectedSubmission.submissionFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <Download className="h-4 w-4" /> Download File
                  </a>
                )}
              </div>

              {/* Inline PDF Preview / Safe File Inspector */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Submission Preview</h4>
                {selectedSubmission.submissionFileUrl ? (
                  isPdf(selectedSubmission.submissionFileUrl) ? (
                    <div className="h-96 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <iframe
                        src={selectedSubmission.submissionFileUrl}
                        className="w-full h-full"
                        title="PDF Submission Preview"
                      />
                    </div>
                  ) : isZip(selectedSubmission.submissionFileUrl) ? (
                    <div className="p-6 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <FileText className="h-5 w-5" /> ZIP Archive Submission Detected
                      </div>
                      <p>
                        For safety, executable files inside ZIP archives are not executed on the server. Download the archive to inspect code locally.
                      </p>
                      <a
                        href={selectedSubmission.submissionFileUrl}
                        download
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700"
                      >
                        <Download className="h-4 w-4" /> Download ZIP Archive
                      </a>
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span>Submitted File: {selectedSubmission.submissionFileUrl.split('/').pop()}</span>
                      <a
                        href={selectedSubmission.submissionFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 dark:text-brand-400 font-bold flex items-center gap-1"
                      >
                        View File <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {selectedSubmission.submissionText || 'No text content submitted.'}
                  </div>
                )}
              </div>

              {/* Grading Form */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Assign Score & Feedback</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Marks Obtained (Max: 100):
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={marks}
                      onChange={(e) => setMarks(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      Grade Status:
                    </label>
                    <Badge variant={selectedSubmission.status === 'GRADED' ? 'green' : 'amber'} className="text-xs font-bold py-2 px-3 block text-center">
                      {selectedSubmission.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                    Trainer Feedback / Review Comments:
                  </label>
                  <textarea
                    rows={4}
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Provide constructive feedback for student improvement..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleGradeSubmit}
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-md flex items-center gap-2"
                  >
                    <Award className="h-4 w-4" />
                    {saving ? 'Saving Grade...' : 'Save & Publish Grade'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-500">
              <FileText className="h-10 w-10 mx-auto text-slate-400 mb-2" />
              <p className="text-xs font-bold">Select a submission from the left to preview and grade.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
