import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { ShieldCheck, Award, CheckCircle2, AlertTriangle, GraduationCap } from 'lucide-react';

export const VerifyCertificate: React.FC = () => {
  const { certificateId } = useParams();
  const [certData, setCertData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (certificateId) {
      api.get(`/certificates/verify/${certificateId}`)
        .then((res: any) => {
          if (res.success && res.data) setCertData(res.data.certificate);
        })
        .catch((err: any) => {
          setError(err.message || 'Invalid or unverified certificate ID');
        })
        .finally(() => setLoading(false));
    }
  }, [certificateId]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        {error ? (
          <div className="rounded-3xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-xl font-extrabold text-red-900 dark:text-red-200">Verification Failed</h2>
            <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl space-y-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 mx-auto flex items-center justify-center shadow-lg">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <ShieldCheck className="h-4 w-4" /> Official ScholarLogic Verification
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Certificate Verified</h2>
              <p className="text-xs font-mono text-slate-500">ID: {certData?.certificateId}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-left space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500 font-medium">Issued To Candidate:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {certData?.studentId?.userId?.fullName || 'ScholarLogic Student'} ({certData?.studentId?.studentId})
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500 font-medium">Certified Program:</span>
                <span className="font-bold text-slate-900 dark:text-white">{certData?.courseId?.title}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Issue Date:</span>
                <span className="font-bold text-slate-900 dark:text-white">{new Date(certData?.issueDate).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
