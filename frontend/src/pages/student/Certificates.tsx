import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Certificate } from '../../types';
import { Badge } from '../../components/Badge';
import { Award, ShieldCheck, ExternalLink, Download } from 'lucide-react';

export const Certificates: React.FC = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/certificates/me')
      .then((res: any) => {
        if (res.success) setCertificates(res.data.certificates || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">ScholarLogic Verified Certificates</h1>
        <p className="text-xs text-slate-500">Official course completion certificates with tamper-proof verification keys</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : certificates.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500">
          No certificates issued yet. Complete courses and pass assessment exams to earn verified certificates.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <div
              key={cert._id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="green" className="font-mono">{cert.certificateId}</Badge>
                  <span className="text-[11px] text-slate-400">{new Date(cert.issueDate).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 flex items-center justify-center shrink-0">
                    <Award className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">{(cert.courseId as any)?.title || 'Course Certificate'}</h3>
                    <p className="text-xs text-slate-500">ScholarLogic Verified Certification</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <Link
                  to={`/verify/${cert.certificateId}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Public Verification Page
                </Link>

                <a
                  href={cert.certificatePdfUrl || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold shadow hover:bg-brand-700"
                >
                  Download PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
