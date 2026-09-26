import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Share2, Check } from 'lucide-react';

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  examsTaken: number;
  isMe: boolean;
}

export interface LeaderboardData {
  top: LeaderboardEntry[];
  me: { rank: number; points: number; examsTaken: number; latestResultId: string | null } | null;
  totalParticipants: number;
}

const medalColors: Record<number, { leaf: string; leafDark: string; ring: string; text: string }> = {
  1: { leaf: '#f5c24a', leafDark: '#c98a12', ring: '#e8a81c', text: '#9a6200' },
  2: { leaf: '#c3cad6', leafDark: '#8e98a8', ring: '#a7b0bf', text: '#5b6576' },
  3: { leaf: '#e9a27c', leafDark: '#b9643a', ring: '#d27f52', text: '#8f4a24' },
};

const podiumLayout: Record<number, { wreath: string; letter: string; block: string; delay: number }> = {
  1: { wreath: 'h-28 w-28', letter: 'text-3xl', block: 'h-40', delay: 250 },
  2: { wreath: 'h-[5.5rem] w-[5.5rem]', letter: 'text-2xl', block: 'h-28', delay: 0 },
  3: { wreath: 'h-[5.5rem] w-[5.5rem]', letter: 'text-2xl', block: 'h-20', delay: 500 },
};

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Counts from 0 up to `target` after `delay` ms (skipped when reduced motion is preferred)
const useCountUp = (target: number, delay = 0, duration = 900) => {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (start === null) start = now;
        const progress = Math.min(1, (now - start) / duration);
        setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, delay, duration]);

  return value;
};

// Leaves along each side of the wreath, from the bottom (100°) up to the top (250°)
const LEAF_ANGLES = [104, 119, 134, 149, 164, 179, 194, 209, 224, 239];
const STEM_RADIUS = 40;
// Pointed leaf drawn along +x from its base at the origin
const LEAF_PATH = 'M0,0 Q5,-4 11,0 Q5,4 0,0Z';

const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
};

const LaurelWreath: React.FC<{ rank: number; letter: string; letterClass: string }> = ({ rank, letter, letterClass }) => {
  const c = medalColors[rank];
  const leaves = LEAF_ANGLES.flatMap((deg, i) =>
    [deg, 180 - deg].map((a, side) => {
      const { x, y } = polar(a, STEM_RADIUS);
      // Point each leaf up along the stem, alternating outward and inward
      const along = side === 0 ? a + 90 : a - 90;
      const splay = (i % 2 === 0 ? 38 : -38) * (side === 0 ? -1 : 1);
      return (
        <path
          key={`${i}-${side}`}
          d={LEAF_PATH}
          transform={`translate(${x} ${y}) rotate(${along + splay})`}
          fill={i % 2 === 0 ? c.leaf : c.leafDark}
        />
      );
    })
  );
  const stemStart = polar(100, STEM_RADIUS);
  const stemEnd = polar(248, STEM_RADIUS);
  const stemEndRight = polar(-68, STEM_RADIUS);

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-sm" aria-hidden="true">
        <path
          d={`M${stemStart.x},${stemStart.y} A${STEM_RADIUS},${STEM_RADIUS} 0 0 1 ${stemEnd.x},${stemEnd.y}`}
          fill="none"
          stroke={c.leafDark}
          strokeWidth="1.2"
        />
        <path
          d={`M${100 - stemStart.x},${stemStart.y} A${STEM_RADIUS},${STEM_RADIUS} 0 0 0 ${stemEndRight.x},${stemEndRight.y}`}
          fill="none"
          stroke={c.leafDark}
          strokeWidth="1.2"
        />
        {leaves}
        <circle cx="50" cy="50" r="31" fill="white" stroke={c.ring} strokeWidth="2.5" />
        <circle cx="50" cy="88" r="8" fill={c.ring} stroke="white" strokeWidth="2" />
        <text x="50" y="91.5" textAnchor="middle" fontSize="10" fontWeight="800" fill="white">
          {rank}
        </text>
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center pb-1 font-black ${letterClass}`}
        style={{ color: c.text }}
      >
        {letter}
      </span>
    </div>
  );
};

const PodiumSpot: React.FC<{ entry: LeaderboardEntry; resultLink: string | null }> = ({ entry, resultLink }) => {
  const layout = podiumLayout[entry.rank];
  const points = useCountUp(entry.points, layout.delay + 400);
  const isFirst = entry.rank === 1;

  const medal = (
    <div
      className="flex flex-col items-center px-1 motion-safe:animate-lb-pop"
      style={{ animationDelay: `${layout.delay + 350}ms` }}
    >
      {isFirst && <Crown className="h-7 w-7 -mb-2 fill-amber-400 text-amber-500 motion-safe:animate-lb-bob" />}
      <div className={`${layout.wreath} ${entry.isMe ? 'rounded-full ring-2 ring-brand-500/70' : ''}`}>
        <LaurelWreath rank={entry.rank} letter={initial(entry.name)} letterClass={layout.letter} />
      </div>
      <p className="mt-2 max-w-full truncate text-center text-sm font-bold text-slate-900 dark:text-white">
        {entry.isMe ? 'You' : entry.name}
      </p>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
        {points} <span className="text-xs font-normal text-slate-400">pts</span>
      </p>
    </div>
  );

  return (
    <div className="flex flex-1 min-w-0 flex-col items-center justify-end">
      {resultLink ? (
        <Link to={resultLink} title="View my exam result" className="max-w-full">
          {medal}
        </Link>
      ) : (
        medal
      )}
      <div
        className="mt-2 w-full origin-bottom motion-safe:animate-lb-rise"
        style={{ animationDelay: `${layout.delay}ms` }}
      >
        {/* Top face gives the block its 3D look */}
        <div
          className="h-3.5 w-full bg-[#cdd6e6] dark:bg-[#4a5d80]"
          style={{ clipPath: 'polygon(7% 0, 93% 0, 100% 100%, 0 100%)' }}
        />
        <div
          className={`${layout.block} w-full flex items-start justify-center pt-3 bg-gradient-to-b from-[#91a3c4] via-[#b7c3d8] to-white/0 dark:from-[#34476a] dark:via-[#26354f] dark:to-slate-900/0`}
        >
          <span className="text-5xl font-black text-white drop-shadow-[0_2px_3px_rgba(30,41,59,0.35)]">
            {entry.rank}
          </span>
        </div>
      </div>
    </div>
  );
};

const LeaderboardRow: React.FC<{ entry: LeaderboardEntry; resultLink: string | null; index: number }> = ({
  entry,
  resultLink,
  index,
}) => {
  const delay = 800 + index * 90;
  const points = useCountUp(entry.points, delay);
  const content = (
    <div
      className={`flex items-center gap-4 rounded-xl px-3 py-3 text-sm ${
        entry.isMe ? 'bg-brand-50 dark:bg-brand-950/50 ring-1 ring-brand-200 dark:ring-brand-900' : ''
      } ${resultLink ? 'hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors' : ''}`}
    >
      <span className="w-5 text-right text-slate-500 tabular-nums">{entry.rank}</span>
      <span className="w-4 text-center font-semibold text-slate-500">{initial(entry.name)}</span>
      <span className="flex-1 truncate text-slate-800 dark:text-slate-200">{entry.isMe ? 'You' : entry.name}</span>
      <span className="font-bold text-slate-900 dark:text-white tabular-nums">
        {points} <span className="text-[11px] font-normal text-slate-400">pts</span>
      </span>
    </div>
  );

  return (
    <li className="list-none motion-safe:animate-lb-slide" style={{ animationDelay: `${delay}ms` }}>
      {resultLink ? (
        <Link to={resultLink} title="View my exam result">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
};

export const Leaderboard: React.FC<{ data: LeaderboardData | null }> = ({ data }) => {
  const [shared, setShared] = useState(false);
  const top = data?.top || [];
  const me = data?.me || null;
  const podiumOrder = [2, 1, 3]
    .map((rank) => top.find((e) => e.rank === rank))
    .filter((e): e is LeaderboardEntry => Boolean(e));
  const rest = top.filter((e) => e.rank > 3);
  const meInTop = top.some((e) => e.isMe);
  const myResultLink = me?.latestResultId ? `/student/results/${me.latestResultId}` : null;

  const handleShare = async () => {
    const text = me
      ? `I'm ranked #${me.rank} on the ScholarLogic leaderboard with ${me.points} pts!`
      : 'Check out the ScholarLogic exam leaderboard!';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ScholarLogic Leaderboard', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      // Share sheet dismissed or clipboard blocked — nothing to do
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Leaderboard</h3>
          <p className="text-xs text-slate-500">Overall top performers</p>
        </div>
        <button
          type="button"
          onClick={handleShare}
          title={shared ? 'Copied!' : 'Share my rank'}
          aria-label="Share my rank"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          {shared ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
        </button>
      </div>

      {top.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center space-y-1">
          <Crown className="h-10 w-10 text-slate-400 mx-auto mb-1" />
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">No exam results yet</h4>
          <p className="text-xs text-slate-500">Complete an exam to appear on the leaderboard.</p>
        </div>
      ) : (
        <>
          <div className="flex items-end pt-2">
            {podiumOrder.map((entry) => (
              <PodiumSpot key={entry.rank} entry={entry} resultLink={entry.isMe ? myResultLink : null} />
            ))}
          </div>

          {rest.length > 0 && (
            <ul>
              {rest.map((entry, i) => (
                <LeaderboardRow
                  key={entry.rank}
                  entry={entry}
                  index={i}
                  resultLink={entry.isMe ? myResultLink : null}
                />
              ))}
            </ul>
          )}

          {me && !meInTop && (
            <ul className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-3">
              <LeaderboardRow
                entry={{ rank: me.rank, name: 'You', points: me.points, examsTaken: me.examsTaken, isMe: true }}
                index={rest.length}
                resultLink={myResultLink}
              />
            </ul>
          )}

          {!me && <p className="text-center text-xs text-slate-500">Take an exam to earn points and get ranked.</p>}
        </>
      )}
    </div>
  );
};
