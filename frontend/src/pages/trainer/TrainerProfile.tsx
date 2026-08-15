import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/Badge';
import { User, Mail, Phone, BookOpen, Settings, Award, Briefcase, GraduationCap } from 'lucide-react';

export const TrainerProfile: React.FC = () => {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || 'Prof. Michael Vance');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [department, setDepartment] = useState('Computer Science & Engineering');
  const [specialization, setSpecialization] = useState('Full Stack Python & Cloud Architecture');
  const [experience, setExperience] = useState('8 Years');
  const [bio, setBio] = useState('Senior Lead Instructor specializing in Python Full Stack Development, Microservices Architecture, and Cloud Engineering.');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Trainer instructor profile updated successfully!');
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Trainer Profile & Teaching Workspace Settings</h1>
          <p className="text-xs text-slate-500">Manage your instructor credentials, specialization, department details, and contact preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Card: Trainer Credentials (NO STUDENT FIELDS) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5 text-center">
          <img
            src={user?.avatarUrl || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200'}
            alt={fullName}
            className="h-24 w-24 rounded-2xl border-2 border-brand-500 mx-auto object-cover shadow-md"
          />

          <div>
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{fullName}</h3>
            <p className="text-xs font-bold text-brand-600 dark:text-brand-400 mt-0.5">Senior Lead Instructor</p>
            <div className="mt-2 flex justify-center gap-1.5">
              <Badge variant="purple">SENIOR TRAINER</Badge>
              <Badge variant="blue">4 COURSES</Badge>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-left">
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 font-medium">Email:</span>
              <span className="font-bold text-slate-900 dark:text-white">{user?.email || 'trainer@scholarlogic.edu'}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 font-medium">Department:</span>
              <span className="font-bold text-slate-900 dark:text-white">{department}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 font-medium">Specialization:</span>
              <span className="font-bold text-brand-600 dark:text-brand-400">{specialization}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 font-medium">Teaching Experience:</span>
              <span className="font-bold text-slate-900 dark:text-white">{experience}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400 font-medium">Assigned Courses:</span>
              <span className="font-bold text-emerald-600">4 Active Courses</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 italic pt-2 border-t border-slate-100 dark:border-slate-800 text-left leading-relaxed">
            "{bio}"
          </p>
        </div>

        {/* Right Form: Edit Instructor Profile */}
        <form onSubmit={handleSave} className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand-500" /> Instructor Information & Teaching Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-500 mb-1">Trainer Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-500 mb-1">Official Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || 'trainer@scholarlogic.edu'}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 p-2.5 text-slate-500 cursor-not-allowed font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-500 mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-500 mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-500 mb-1">Specialization</label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-500 mb-1">Teaching Experience</label>
              <input
                type="text"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Teaching Bio & Overview</label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700 transition-colors shadow-md"
          >
            Save Trainer Profile
          </button>
        </form>
      </div>
    </div>
  );
};
