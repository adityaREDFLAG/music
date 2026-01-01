import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ListMusic,
  MessageSquareQuote,
  Heart,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat
} from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';

interface FullPlayerProps {
  currentTrack: Track | null;
  playerState: PlayerState;
  isPlayerOpen: boolean;
  onClose: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
  currentTime: number;
  duration: number;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  themeColor: string;
}

const formatTime = (time: number) => {
  if (!time || isNaN(time)) return '0:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/* ---------------- Squiggle Progress ---------------- */

const SquiggleLine = React.memo(({ progress }: { progress: number }) => {
  const pathData = useMemo(() => {
    const points: string[] = [];
    for (let i = 0; i <= 100; i++) {
      const y = Math.sin(i * 0.8) * 3 + 5;
      points.push(`${i},${y}`);
    }
    return `M ${points.join(' L ')}`;
  }, []);

  return (
    <svg viewBox="0 0 100 10" className="w-full h-full overflow-visible">
      <path
        d={pathData}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white/20"
        vectorEffect="non-scaling-stroke"
      />

      <svg width={`${progress}%`} className="overflow-hidden">
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-white"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <circle
        cx={`${progress}%`}
        cy="50%"
        r="4"
        fill="currentColor"
        className="text-white drop-shadow-md"
      />
    </svg>
  );
});

/* ---------------- Full Player ---------------- */

const FullPlayer: React.FC<FullPlayerProps> = ({
  currentTrack,
  playerState,
  isPlayerOpen,
  onClose,
  togglePlay,
  nextTrack,
  prevTrack,
  setPlayerState,
  currentTime,
  duration,
  handleSeek
}) => {
  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  return (
    <AnimatePresence mode="wait">
      {isPlayerOpen && currentTrack && (
        <motion.div
          key="full-player"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 0.8 }}
          className="fixed inset-0 z-[100] bg-[#2a1b2a] flex flex-col overflow-hidden"
        >
          {/* background */}
          <div className="absolute inset-0 z-0">
            {currentTrack.coverArt && (
              <motion.img
                key={currentTrack.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                src={currentTrack.coverArt}
                className="w-full h-full object-cover blur-[80px] scale-125 saturate-150"
              />
            )}
            <div className="absolute inset-0 bg-[#1e1e1e]/80 mix-blend-multiply" />
          </div>

          <div className="relative z-10 flex flex-col h-full p-6 pb-8">
            {/* header */}
            <header className="flex justify-between items-center mb-6">
              <button
                aria-label="Close player"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 backdrop-blur-md"
              >
                <ChevronDown size={24} />
              </button>

              <span className="text-sm font-medium text-white/90">
                Now Playing
              </span>

              <div className="flex gap-3">
                <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white backdrop-blur-md">
                  <MessageSquareQuote size={20} />
                </button>
                <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white backdrop-blur-md">
                  <ListMusic size={20} />
                </button>
              </div>
            </header>

            {/* album art */}
            <div className="flex-1 flex items-center justify-center py-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="relative aspect-square w-full max-w-[340px] rounded-[32px] overflow-hidden shadow-2xl"
              >
                {currentTrack.coverArt ? (
                  <img
                    src={currentTrack.coverArt}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                    <span className="text-white/20 text-4xl font-bold">
                      Music
                    </span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* track info */}
            <div className="mt-6 text-center space-y-2">
              <h1 className="text-2xl font-bold text-white truncate px-4">
                {currentTrack.title}
              </h1>
              <p className="text-lg text-white/60 truncate">
                {currentTrack.artist}
              </p>
            </div>

            {/* progress */}
            <div className="mt-10 mb-2 px-2">
              <div className="relative h-6">
                <div className="absolute inset-0 pointer-events-none">
                  <SquiggleLine progress={progress} />
                </div>

                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              <div className="flex justify-between mt-2 text-xs text-white/50 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* controls */}
            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                aria-label="Previous"
                onClick={prevTrack}
                className="w-20 h-20 rounded-[28px] bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95"
              >
                <SkipBack size={28} fill="currentColor" />
              </button>

              <button
                aria-label="Play or pause"
                onClick={togglePlay}
                className="w-24 h-24 rounded-[32px] bg-[#e0b5d6] text-[#3a1d33] shadow-[0_0_30px_rgba(224,181,214,0.3)] flex items-center justify-center hover:scale-105 active:scale-95"
              >
                {playerState.isPlaying ? (
                  <Pause size={40} fill="currentColor" />
                ) : (
                  <Play size={40} fill="currentColor" className="ml-1" />
                )}
              </button>

              <button
                aria-label="Next"
                onClick={nextTrack}
                className="w-20 h-20 rounded-[28px] bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95"
              >
                <SkipForward size={28} fill="currentColor" />
              </button>
            </div>

            {/* bottom row */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <button
                aria-label="Shuffle"
                onClick={() =>
                  setPlayerState(p => ({ ...p, shuffle: !p.shuffle }))
                }
                className={`h-16 rounded-2xl flex items-center justify-center ${
                  playerState.shuffle
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/40'
                }`}
              >
                <Shuffle size={24} />
              </button>

              <button
                aria-label="Repeat"
                onClick={() =>
                  setPlayerState(p => ({
                    ...p,
                    repeat:
                      p.repeat === RepeatMode.OFF
                        ? RepeatMode.ALL
                        : p.repeat === RepeatMode.ALL
                        ? RepeatMode.ONE
                        : RepeatMode.OFF
                  }))
                }
                className={`h-16 rounded-2xl flex items-center justify-center relative ${
                  playerState.repeat !== RepeatMode.OFF
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/40'
                }`}
              >
                <Repeat size={24} />
                {playerState.repeat === RepeatMode.ONE && (
                  <span className="absolute top-4 right-4 w-1.5 h-1.5 bg-white rounded-full" />
                )}
              </button>

              <button
                aria-label="Like"
                className="h-16 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/10"
              >
                <Heart size={24} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPlayer;
