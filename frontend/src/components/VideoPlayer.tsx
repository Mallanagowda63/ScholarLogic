import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface VideoPlayerProps {
  videoUrl: string;
  lessonId: string;
  courseId: string;
  initialProgress?: number;
  onCompleted?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  lessonId,
  courseId,
  initialProgress = 0,
  onCompleted,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(initialProgress);
  const [isCompleted, setIsCompleted] = useState(initialProgress >= 90);
  const [isMuted, setIsMuted] = useState(false);
  const [speed, setSpeed] = useState(1);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const duration = videoRef.current.duration;
    const currentTime = videoRef.current.currentTime;
    if (duration > 0) {
      const pct = Math.round((currentTime / duration) * 100);
      setProgress(pct);

      if (pct >= 90 && !isCompleted) {
        setIsCompleted(true);
        if (onCompleted) onCompleted();
      }

      // Save progress to database every 5% increment
      if (pct % 5 === 0 && pct > 0) {
        api.post('/courses/progress', {
          lessonId,
          courseId,
          progressPercentage: pct,
        }).catch(() => {});
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = parseFloat(e.target.value);
    setSpeed(s);
    if (videoRef.current) {
      videoRef.current.playbackRate = s;
    }
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-black group shadow-xl">
      <video
        ref={videoRef}
        src={videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
        className="w-full aspect-video object-cover"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          setIsPlaying(false);
          setIsCompleted(true);
          api.post('/courses/progress', { lessonId, courseId, progressPercentage: 100 }).catch(() => {});
        }}
      />

      {/* Video Progress Bar Overlay */}
      <div className="absolute bottom-12 left-0 right-0 h-1.5 bg-white/20">
        <div
          className="h-full bg-brand-500 transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Control Bar Overlay */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent p-4 text-white opacity-95 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md transition-colors"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>

          <button onClick={toggleMute} className="text-white/80 hover:text-white transition-colors">
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          <span className="text-xs font-mono text-white/80">{progress}% Completed</span>
        </div>

        <div className="flex items-center gap-3">
          {isCompleted && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Completed
            </span>
          )}

          <select
            value={speed}
            onChange={handleSpeedChange}
            className="bg-black/60 text-xs font-semibold text-white border border-white/20 rounded-lg px-2 py-1 focus:outline-none"
          >
            <option value={0.75}>0.75x</option>
            <option value={1}>1.0x (Normal)</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2.0x</option>
          </select>

          <button onClick={toggleFullscreen} className="text-white/80 hover:text-white transition-colors">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
