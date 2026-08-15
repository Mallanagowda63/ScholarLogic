import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Bell, PlusCircle, Megaphone, Send } from 'lucide-react';

export const TrainerAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = () => {
    setLoading(true);
    api.get('/trainer/announcements')
      .then((res: any) => {
        if (res.success) setAnnouncements(res.data.announcements || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/trainer/announcements', { title, content });
      alert('Announcement published to students!');
      setTitle('');
      setContent('');
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message || 'Failed to publish announcement');
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Course Announcements</h1>
          <p className="text-xs text-slate-500">Publish class updates, assignment deadline extensions, and exam notices to enrolled students</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handlePublish} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-brand-500" /> Publish Announcement
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Title / Headline</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Python Assignment 2 Deadline Extended"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Details & Instructions</label>
            <textarea
              rows={5}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="The assignment submission deadline has been extended to Friday 6:00 PM..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            <Send className="h-4 w-4" /> Publish Announcement
          </button>
        </form>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">Published Announcements Feed</h3>

          <div className="space-y-4">
            {announcements.map((ann) => (
              <div key={ann._id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="blue">{ann.courseId?.title || 'All Courses'}</Badge>
                  <span className="text-[10px] text-slate-400">{new Date(ann.createdAt).toLocaleDateString()}</span>
                </div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{ann.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{ann.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
