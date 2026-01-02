import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause } from 'lucide-react';
import { Track, PlayerState } from '../types';

interface MiniPlayerProps {
  currentTrack: Track | null;
  playerState: PlayerState;
  isPlayerOpen: boolean;
  onOpen: () => void;
  togglePlay: () => void;
  progress?: number;
}

const MiniPlayer: React.FC<MiniPlayerProps> = React.memo(({ 
  currentTrack, 
  playerState, 
  isPlayerOpen, 
  onOpen, 
  togglePlay,
  progress = 0 
}) => {
  const handleTogglePlay = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    togglePlay();
  }, [togglePlay]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onOpen();
    }
  };

  // Guard against null currentTrack, although parent should handle conditional rendering
  if (!currentTrack) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      /**
       * STYLING FIXES:
       * 1. z-[500] ensures it is above the Nav Bar (z-40) and any other overlays.
       * 2. bottom-[calc(96px+env(safe-area-inset-bottom))] pushes it above
       * the 88px nav bar + mobile safe areas.
       */
      className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-4 right-4 h-16 bg-surface/80 backdrop-blur-xl rounded-2xl flex items-center px-2 shadow-2xl z-[500] cursor-pointer md:left-auto md:right-8 md:w-[380px] md:bottom-[calc(96px+env(safe-area-inset-bottom))] overflow-hidden border border-white/10"
      role="button"
      tabIndex={0}
      aria-label={`Now playing: ${currentTrack.title} by ${currentTrack.artist}`}
      layoutId="mini-player" // Consistent layoutId for shared element transition if implemented
    >
      {/* Subtle Progress Background */}
      <div className="absolute bottom-0 left-0 h-[2px] bg-white/10 w-full">
        <motion.div 
          className="h-full bg-primary"
          style={{ width: `${progress * 100}%` }}
          transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        />
      </div>

      {/* Album Art */}
      <motion.div
        layoutId={`artwork-${currentTrack.id}`}
        className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-lg"
      >
        <img
          src={currentTrack.coverArt || '/default-album-art.png'}
          className="w-full h-full object-cover"
          alt=""
        />
      </motion.div>

      {/* Track Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-4">
        <motion.h4
          layoutId={`title-${currentTrack.id}`}
          className="text-[14px] font-bold text-white truncate"
        >
          {currentTrack.title}
        </motion.h4>
        <motion.p
          layoutId={`artist-${currentTrack.id}`}
          className="text-[12px] text-white/50 truncate font-medium"
        >
          {currentTrack.artist}
        </motion.p>
      </div>

      {/* Play/Pause Button */}
      <button
        onClick={handleTogglePlay}
        className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/5 active:bg-white/10 transition-colors flex-shrink-0"
        aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
      >
        <AnimatePresence mode="wait">
          {playerState.isPlaying ? (
            <motion.div
              key="pause"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <Pause className="w-5 h-5 fill-white text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="play"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
});

MiniPlayer.displayName = 'MiniPlayer';

export default MiniPlayer;
