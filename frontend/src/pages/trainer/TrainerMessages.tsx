import React, { useState } from 'react';
import { Badge } from '../../components/Badge';
import { MessageSquare, Send, User } from 'lucide-react';

export const TrainerMessages: React.FC = () => {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'Alex Morgan (SL-2026-00001)', text: 'Prof. Vance, I have a question regarding class inheritance in Assignment 2.', time: '10:15 AM' },
    { id: 2, sender: 'You (Trainer)', text: 'Hi Alex, sure! Ensure you override the parent __init__ method using super().__init__().', time: '10:18 AM' },
  ]);
  const [inputText, setInputText] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText) return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: 'You (Trainer)', text: inputText, time: 'Just now' },
    ]);
    setInputText('');
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Student Communication & Doubt Clearing</h1>
          <p className="text-xs text-slate-500">Authorized student-trainer messaging channel for academic doubt resolution</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6 max-w-3xl">
        <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="h-10 w-10 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center">
            AM
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Alex Morgan (SL-2026-00001)</h3>
            <p className="text-[10px] text-emerald-600 font-bold">Python Full Stack • CSE</p>
          </div>
        </div>

        <div className="space-y-4 h-64 overflow-y-auto p-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender.startsWith('You') ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-md p-3.5 rounded-2xl text-xs ${
                  msg.sender.startsWith('You')
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                }`}
              >
                <p>{msg.text}</p>
              </div>
              <span className="text-[10px] text-slate-400 mt-1">{msg.time}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSend} className="flex gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your response to student..."
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-white"
          />
          <button type="submit" className="px-5 py-3 rounded-xl bg-brand-600 text-white font-bold text-xs hover:bg-brand-700">
            Send Reply
          </button>
        </form>
      </div>
    </div>
  );
};
