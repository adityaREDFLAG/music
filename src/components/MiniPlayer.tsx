import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music } from 'lucide-react';
import { Track, PlayerState } from '../types';

interface MiniPlayerProps {
  currentTrack: Track | null;
  playerState: PlayerState;
  isPlayerOpen: boolean;
  onOpen: () => void;
  togglePlay: () => void;
}

const MiniPlayer: React.FC<MiniPlayerProps> = React.memo(({ 
  currentTrack, 
  playerState, 
  isPlayerOpen, 
  onOpen, 
  togglePlay 
}) => {
  const handleTogglePlay = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    togglePlay();
  }, [togglePlay]);

  if (!currentTrack || isPlayerOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        onClick={onOpen}
        className="fixed bottom-[96px] left-4 right-4 h-[72px] bg-white dark:bg-neutral-900 rounded-2xl flex items-center px-4 pr-6 gap-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[60] cursor-pointer md:left-auto md:right-4 md:w-96 md:bottom-4 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)] transition-shadow border border-neutral-200/50 dark:border-neutral-800/50"
        role="button"
        tabIndex={0}
        aria-label={`Now playing: ${currentTrack.title} by ${currentTrack.artist}. Click to open full player.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        {/* Album Art */}
        <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 overflow-hidden flex-shrink-0 relative shadow-sm">
          {currentTrack.coverArt ? (
            <img 
              src={currentTrack.coverArt} 
              className="w-full h-full object-cover" 
              alt={`${currentTrack.title} album art`}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-6 h-6 text-neutral-400 dark:text-neutral-600" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white truncate leading-tight">
            {currentTrack.title}
          </h4>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 truncate mt-0.5 leading-tight">
            {currentTrack.artist}
          </p>
        </div>

        {/* Play/Pause Button */}
        <button
          onClick={handleTogglePlay}
          className="w-10 h-10 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md flex-shrink-0"
          aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
          tabIndex={0}
        >
          {playerState.isPlaying ? (
            <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
          ) : (
            <Play className="w-5 h-5 fill-current translate-x-0.5" aria-hidden="true" />
          )}
        </button>
      </motion.div>
    </AnimatePresence>
  );
});

MiniPlayer.displayName = 'MiniPlayer';

export default MiniPlayer;
