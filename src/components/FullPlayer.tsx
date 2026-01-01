import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MoreVertical, Music, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat } from 'lucide-react';
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

const formatTime = (time: number): string => {
  if (!time || isNaN(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Animation Variants
const artVariants = {
  hidden: { opacity: 0, scale: 0.9, filter: 'blur(10px)' },
  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.1, filter: 'blur(10px)' }
};

const textVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const FullPlayer: React.FC<FullPlayerProps> = React.memo(({
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
  const progress = useMemo(() => 
    (currentTime / (duration || 1)) * 100, 
    [currentTime, duration]
  );
   
  const formattedCurrentTime = useMemo(() => formatTime(currentTime), [currentTime]);
  const formattedDuration = useMemo(() => formatTime(duration), [duration]);

  const toggleShuffle = useCallback(() => {
    setPlayerState(p => ({ ...p, shuffle: !p.shuffle }));
  }, [setPlayerState]);

  const cycleRepeat = useCallback(() => {
    setPlayerState(p => ({ 
      ...p, 
      repeat: p.repeat === RepeatMode.OFF 
        ? RepeatMode.ALL 
        : p.repeat === RepeatMode.ALL 
        ? RepeatMode.ONE 
        : RepeatMode.OFF 
    }));
  }, [setPlayerState]);

  if (!isPlayerOpen || !currentTrack) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="full-player-overlay"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
        className="fixed inset-0 bg-black z-[100] flex flex-col safe-area-top safe-area-bottom overflow-hidden"
        role="dialog"
        aria-label="Full screen player"
      >
        {/* Dynamic Background with Crossfade */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {currentTrack.coverArt && (
              <motion.img 
                key={currentTrack.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                src={currentTrack.coverArt}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-[100px] scale-150"
              />
            )}
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black" />
        </div>

        <div className="relative z-10 flex flex-col h-full p-8 md:px-12">
          {/* Header */}
          <header className="flex justify-between items-center mb-6">
            <button 
              onClick={onClose} 
              className="p-2 -ml-2 text-white/80 hover:text-white transition-colors active:scale-90 transform"
            >
              <ChevronDown size={32} />
            </button>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold mb-0.5">
                Now Playing
              </p>
              <p className="text-sm text-white font-semibold">Your Library</p>
            </div>
            <button className="p-2 -mr-2 text-white/80 hover:text-white transition-colors active:scale-90 transform">
              <MoreVertical size={24} />
            </button>
          </header>

          {/* Artwork Section with Transition */}
          <div className="flex-1 flex items-center justify-center py-4">
            <div className="relative aspect-square w-full max-w-[340px]">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={currentTrack.id}
                  variants={artVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                  className="absolute inset-0"
                >
                  <motion.div 
                    animate={{ 
                      scale: playerState.isPlaying ? 1 : 0.95,
                    }}
                    transition={{ duration: 0.4 }}
                    className="w-full h-full rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden border border-white/10 bg-neutral-900"
                  >
                    {currentTrack.coverArt ? (
                      <img 
                        src={currentTrack.coverArt} 
                        className="w-full h-full object-cover" 
                        alt={`${currentTrack.title} album art`} 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-20 h-20 text-white/10" />
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Track Metadata with Slide Animation */}
          <div className="mt-8 flex justify-between items-end gap-4 min-h-[80px]">
            <div className="flex-1 min-w-0 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${currentTrack.id}-meta`}
                  variants={textVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="text-3xl font-bold text-white truncate mb-1">
                    {currentTrack.title}
                  </h1>
                  <p className="text-xl text-white/60 truncate">
                    {currentTrack.artist}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
            <motion.button 
              whileTap={{ scale: 0.8 }}
              className="p-2 text-white/80 hover:text-red-500 transition-colors flex-shrink-0"
            >
              <Heart size={28} />
            </motion.button>
          </div>

          {/* Seek Bar */}
          <div className="mt-8 group">
            <div className="relative h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
              <motion.div 
                className="absolute h-full bg-white rounded-full group-hover:bg-green-400 transition-colors" 
                style={{ width: `${progress}%` }}
                layoutId="progressBar"
              />
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
            </div>
            <div className="flex justify-between mt-3 text-xs font-medium text-white/40 tabular-nums tracking-wider">
              <time>{formattedCurrentTime}</time>
              <time>{formattedDuration}</time>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="mt-6 mb-12 flex items-center justify-between">
            <button
              onClick={toggleShuffle}
              className={`transition-colors p-2 ${playerState.shuffle ? "text-green-400" : "text-white/40"}`}
            >
              <Shuffle size={20} />
            </button>

            <div className="flex items-center gap-6 md:gap-8">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={prevTrack} 
                className="text-white p-2"
              >
                <SkipBack size={36} fill="currentColor" />
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={togglePlay}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-black shadow-lg shadow-white/10"
              >
                {playerState.isPlaying ? (
                  <Pause size={32} fill="currentColor" />
                ) : (
                  <Play size={32} fill="currentColor" className="ml-1" />
                )}
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={nextTrack} 
                className="text-white p-2"
              >
                <SkipForward size={36} fill="currentColor" />
              </motion.button>
            </div>

            <button
              onClick={cycleRepeat}
              className={`transition-colors relative p-2 ${
                playerState.repeat !== RepeatMode.OFF ? "text-green-400" : "text-white/40"
              }`}
            >
              <Repeat size={20} />
              {playerState.repeat === RepeatMode.ONE && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-current rounded-full" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

FullPlayer.displayName = 'FullPlayer';

export default FullPlayer;
