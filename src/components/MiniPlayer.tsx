import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipForward, Music } from 'lucide-react';
import { Track, PlayerState } from '../types';

interface MiniPlayerProps {
  currentTrack: Track | null;
  playerState: PlayerState;
  isPlayerOpen: boolean;
  onOpen: () => void;
  togglePlay: () => void;
  onNext?: () => void; // Added optional onNext prop
  progress?: number;
}

const MiniPlayer: React.FC<MiniPlayerProps> = React.memo(({ 
  currentTrack, 
  playerState, 
  onOpen, 
  togglePlay,
  onNext,
  progress = 0 
}) => {
  const [imgError, setImgError] = useState(false);

  // Reset error state when track changes
  useEffect(() => {
    setImgError(false);
  }, [currentTrack?.id]);

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePlay();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onNext) onNext();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  if (!currentTrack) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 100, opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-4 right-4 h-[72px] 
                 bg-surface-container-high/90 backdrop-blur-2xl rounded-[28px] flex items-center pr-4 pl-3 
                 shadow-xl shadow-black/20 z-[500] cursor-pointer 
                 md:left-auto md:right-8 md:w-[400px] md:bottom-[calc(96px+env(safe-area-inset-bottom))] 
                 overflow-hidden border border-white/10 group"
      role="button"
      tabIndex={0}
      aria-label={`Now playing: ${currentTrack.title}`}
      layoutId="mini-player"
    >
      {/* Gradient Progress Background */}
      <div className="absolute bottom-0 left-0 h-[3px] bg-white/5 w-full z-0">
        <motion.div 
          className="h-full bg-gradient-to-r from-primary/80 to-primary"
          style={{ width: `${progress * 100}%` }}
          transition={{ type: 'tween', ease: "linear", duration: 0.2 }}
        />
      </div>

      {/* Album Art with fallback */}
      <motion.div
        layoutId={`artwork-${currentTrack.id}`}
        className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 shadow-sm border border-white/5 z-10"
      >
        {!imgError && currentTrack.coverArt ? (
          <img
            src={currentTrack.coverArt}
            className="w-full h-full object-cover"
            alt={currentTrack.title}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
            <Music className="w-6 h-6 text-on-surface-variant/50" />
          </div>
        )}
      </motion.div>

      {/* Track Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-4 z-10">
        <motion.div layoutId={`title-${currentTrack.id}`} className="relative">
          <h4 className="text-[15px] font-semibold text-on-surface truncate leading-tight">
            {currentTrack.title}
          </h4>
        </motion.div>
        <motion.div layoutId={`artist-${currentTrack.id}`}>
          <p className="text-[13px] text-on-surface-variant truncate font-medium">
            {currentTrack.artist}
          </p>
        </motion.div>
      </div>

      {/* Controls Container */}
      <div className="flex items-center gap-1 z-10">
        {/* Play/Pause Button */}
        <motion.button
          onClick={handleTogglePlay}
          whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.1)" }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {playerState.isPlaying ? (
              <motion.div
                key="pause"
                initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.5, rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Pause className="w-6 h-6 fill-on-surface text-on-surface" />
              </motion.div>
            ) : (
              <motion.div
                key="play"
                initial={{ scale: 0.5, rotate: 90, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.5, rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Play className="w-6 h-6 fill-on-surface text-on-surface translate-x-0.5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Next Button (Only renders if prop is provided) */}
        {onNext && (
          <motion.button
            onClick={handleNext}
            whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.1)" }}
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface-variant hover:text-on-surface"
            aria-label="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
});

MiniPlayer.displayName = 'MiniPlayer';

export default MiniPlayer;
