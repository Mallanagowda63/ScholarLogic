import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Heart, Mail, Phone, MapPin } from 'lucide-react';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar isDashboard={false} />
      
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <img src="/logo.png" alt="ScholarLogic — Experience The Commitment" className="h-9 w-auto dark:brightness-0 dark:invert" />
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                ScholarLogic Career & Learning Hub empowers students with integrated LMS learning, online assessment certification, AI resume engineering, and enterprise placement opportunities.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">Core Modules</h4>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>ScholarLogic LMS</li>
                <li>Online Assessment Engine</li>
                <li>AI Resume Builder & ATS</li>
                <li>Placement Portal</li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">Popular Programs</h4>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li>Python Full Stack Development</li>
                <li>Java Full Stack Development</li>
                <li>Cloud Computing (AWS)</li>
                <li>Data Analytics & Power BI</li>
                <li>Digital Marketing</li>
                <li>DevOps Engineering</li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">Contact Hub</h4>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand-500" /> support@scholarlogic.edu</p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-500" /> +91 80 4567 8900</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-500" /> ScholarLogic Tech Park, Bangalore</p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
            <p>© 2026 ScholarLogic Career & Learning Hub. All rights reserved.</p>
            <p className="flex items-center gap-1 mt-2 sm:mt-0">
              Built for Student Success <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
