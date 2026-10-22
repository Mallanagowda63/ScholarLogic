import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Heart, Mail, Phone, MapPin } from 'lucide-react';

// Footer program links open the course catalogue searched for that program
const PROGRAMS: [string, string][] = [
  ['Python Full Stack Development', 'Python'],
  ['Java Full Stack Development', 'Java'],
  ['Cloud Computing (AWS)', 'Cloud'],
  ['Data Analytics & Power BI', 'Data Analytics'],
  ['Digital Marketing', 'Digital Marketing'],
  ['DevOps Engineering', 'DevOps'],
];

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
                <li><Link to="/courses" className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors">ScholarLogic LMS</Link></li>
                <li><Link to="/login" className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors">Online Assessment Engine</Link></li>
                <li><Link to="/login" className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors">AI Resume Builder & ATS</Link></li>
                <li><Link to="/placement" className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors">Placement Portal</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">Popular Programs</h4>
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                {PROGRAMS.map(([label, q]) => (
                  <li key={label}>
                    <Link to={`/courses?q=${encodeURIComponent(q)}`} className="hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3">Contact Hub</h4>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <a href="mailto:tech@scholarlogic.net" className="flex items-center gap-2 hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors">
                  <Mail className="h-4 w-4 shrink-0 text-brand-500" /> tech@scholarlogic.net
                </a>
                <a href="tel:+919008625716" className="flex items-center gap-2 hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors">
                  <Phone className="h-4 w-4 shrink-0 text-brand-500" /> +91 90086 25716
                </a>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=ScholarLogic%2C%20BTM%202nd%20Stage%2C%20Bengaluru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 hover:text-brand-600 dark:hover:text-brand-400 hover:underline transition-colors"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> ScholarLogic, BTM 2nd Stage, Bengaluru
                </a>
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
