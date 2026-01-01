import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
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
  Repeat,
  Volume2
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

const SquiggleLine = React.memo(({ progress, themeColor }: { progress: number; themeColor: string }) => {
  const pathData = useMemo(() => {
    const points: string[] = [];
    for (let i = 0; i <= 100; i++) {
      // Reduced amplitude slightly for cleaner look
      const y = Math.sin(i * 0.8) * 2.5 + 5; 
      points.push(`${i},${y}`);
    }
    return `M ${points.join(' L ')}`;
  }, []);

  return (
    <svg viewBox="0 0 100 10" className="w-full h-full overflow-visible">
      {/* Background Track */}
      <path
        d={pathData}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-white/10"
        vectorEffect="non-scaling-stroke"
      />

      {/* Active Track */}
      <svg width={`${progress}%`} className="overflow-hidden">
        <path
          d={pathData}
          fill="none"
          stroke={themeColor || "white"}
          strokeWidth="2"
          className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-colors duration-300"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Thumb */}
      <motion.g animate={{ x: `${progress}%` }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
        <circle
          cx="0"
          cy="50%"
          r="4"
          fill={themeColor || "white"}
          className="drop-shadow-md"
        />
      </motion.g>
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
  handleSeek,
  themeColor = '#e0b5d6' // Default fallback
}) => {
  const [activeView, setActiveView] = useState<'cover' | 'lyrics' | 'queue'>('cover');

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  // Handle drag to dismiss
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 150 || info.velocity.y > 200) {
      onClose();
    }
  };

  return (
    <AnimatePresence mode="wait">
      {isPlayerOpen && currentTrack && (
        <motion.div
          key="full-player"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 0.8 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.2 }}
          onDragEnd={handleDragEnd}
          className="fixed inset-0 z-[100] bg-[#1a1a1a] flex flex-col overflow-hidden"
        >
          {/* Dynamic Ambient Background */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
             <motion.div 
               animate={{ backgroundColor: themeColor }}
               className="absolute top-[-20%] left-[-20%] w-[140%] h-[80%] opacity-20 blur-[100px] rounded-full mix-blend-screen"
             />
             <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1a1a1a]/80 to-[#1a1a1a]" />
          </div>

          <div className="relative z-10 flex flex-col h-full p-6 pb-10">
            {/* Header / Drag Handle */}
            <header className="flex justify-between items-center mb-6 pt-2">
              <button
                aria-label="Close player"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white hover:bg-white/10 active:scale-95 transition-all backdrop-blur-md border border-white/5"
              >
                <ChevronDown size={24} />
              </button>

              <div className="flex flex-col items-center gap-1 opacity-50 cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1 bg-white/20 rounded-full" />
                <span className="text-xs font-medium tracking-widest uppercase">Now Playing</span>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setActiveView(activeView === 'lyrics' ? 'cover' : 'lyrics')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/5 ${activeView === 'lyrics' ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:text-white'}`}
                >
                  <MessageSquareQuote size={20} />
                </button>
                <button 
                  onClick={() => setActiveView(activeView === 'queue' ? 'cover' : 'queue')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/5 ${activeView === 'queue' ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:text-white'}`}
                >
                  <ListMusic size={20} />
                </button>
              </div>
            </header>

            {/* Main Visual Content */}
            <div className="flex-1 flex items-center justify-center py-2 min-h-0">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ 
                  scale: 1, 
                  opacity: 1,
                  filter: activeView !== 'cover' ? 'blur(10px) brightness(0.5)' : 'none'
                }}
                transition={{ duration: 0.4 }}
                className="relative aspect-square w-full max-w-[340px]"
              >
                <motion.div
                   animate={playerState.isPlaying ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                   transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                   className="w-full h-full rounded-[32px] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-white/10"
                >
                  {currentTrack.coverArt ? (
                    <img
                      src={currentTrack.coverArt}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                      <Volume2 className="text-white/20 w-24 h-24" />
                    </div>
                  )}
                </motion.div>
                
                {/* View Overlays (Lyrics/Queue placeholders) */}
                {activeView !== 'cover' && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <p className="text-white/80 font-mono text-center px-4">
                            {activeView === 'lyrics' ? "Lyrics not available" : "Queue empty"}
                        </p>
                    </motion.div>
                )}
              </motion.div>
            </div>

            {/* Track Info */}
            <div className="mt-8 text-center space-y-1">
              <motion.h1 
                layout
                className="text-2xl font-bold text-white truncate px-4 leading-tight"
              >
                {currentTrack.title}
              </motion.h1>
              <motion.p 
                layout
                className="text-lg text-white/60 truncate font-medium"
              >
                {currentTrack.artist}
              </motion.p>
            </div>

            {/* Progress Bar */}
            <div className="mt-8 mb-4 px-2">
              <div className="relative h-10 group">
                <div className="absolute inset-0 flex items-center pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                  <SquiggleLine progress={progress} themeColor={themeColor} />
                </div>

                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>

              <div className="flex justify-between -mt-1 text-xs text-white/40 font-mono tracking-wider">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Primary Controls */}
            <div className="mt-4 flex items-center justify-center gap-8">
              <button
                onClick={prevTrack}
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5 active:scale-90 transition-all"
              >
                <SkipBack size={32} fill="currentColor" />
              </button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={togglePlay}
                animate={{
                  boxShadow: playerState.isPlaying 
                    ? `0 0 40px -10px ${themeColor}60` 
                    : "0 0 0px 0px rgba(0,0,0,0)"
                }}
                style={{ backgroundColor: themeColor }}
                className="w-20 h-20 rounded-[30px] text-[#1a1a1a] flex items-center justify-center hover:scale-105 transition-transform"
              >
                {playerState.isPlaying ? (
                  <Pause size={36} fill="currentColor" />
                ) : (
                  <Play size={36} fill="currentColor" className="ml-1" />
                )}
              </motion.button>

              <button
                onClick={nextTrack}
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/5 active:scale-90 transition-all"
              >
                <SkipForward size={32} fill="currentColor" />
              </button>
            </div>

            {/* Secondary Controls (Shuffle/Repeat/Like) */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <button
                onClick={() => setPlayerState(p => ({ ...p, shuffle: !p.shuffle }))}
                className={`h-14 rounded-2xl flex items-center justify-center transition-all ${
                  playerState.shuffle
                    ? 'bg-white text-black shadow-lg shadow-white/10'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                <Shuffle size={20} />
              </button>

              <button
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
                className={`h-14 rounded-2xl flex items-center justify-center relative transition-all ${
                  playerState.repeat !== RepeatMode.OFF
                    ? 'bg-white text-black shadow-lg shadow-white/10'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                <Repeat size={20} />
                {playerState.repeat === RepeatMode.ONE && (
                  <span className="absolute text-[8px] font-bold top-3 right-3">1</span>
                )}
              </button>

              <button
                className="h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-red-500 hover:bg-white/10 transition-colors active:scale-95"
              >
                <Heart size={20} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPlayer;
