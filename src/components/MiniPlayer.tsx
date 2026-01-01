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
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        onClick={onOpen}
        className="fixed bottom-[100px] left-4 right-4 h-[72px] bg-surface-variant text-on-surface rounded-[20px] flex items-center px-4 gap-4 shadow-elevation-3 z-[60] cursor-pointer md:left-auto md:right-8 md:w-96 md:bottom-8 border border-outline/10 overflow-hidden"
        role="button"
        tabIndex={0}
        aria-label={`Now playing: ${currentTrack.title} by ${currentTrack.artist}. Click to open full player.`}
      >
        <div className="absolute inset-0 bg-primary/5 pointer-events-none" />

        {/* Progress Bar (Background) */}
        {/* We could add a subtle progress bar at the bottom if needed, but M3 usually puts it inside. */}

        {/* Album Art */}
        <div className="w-12 h-12 rounded-xl bg-surface-variant-dim overflow-hidden flex-shrink-0 relative shadow-sm z-10">
          {currentTrack.coverArt ? (
            <img 
              src={currentTrack.coverArt} 
              className="w-full h-full object-cover" 
              alt={`${currentTrack.title} album art`}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-container">
              <Music className="w-6 h-6 text-on-surface/40" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
          <h4 className="text-base font-semibold text-on-surface truncate leading-tight">
            {currentTrack.title}
          </h4>
          <p className="text-sm text-on-surface/70 truncate mt-0.5 leading-tight">
            {currentTrack.artist}
          </p>
        </div>

        {/* Play/Pause Button */}
        <button
          onClick={handleTogglePlay}
          className="w-12 h-12 rounded-full bg-primary text-primary-on-container flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-sm flex-shrink-0 z-10"
          aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
        >
          {playerState.isPlaying ? (
            <Pause className="w-6 h-6 fill-current" aria-hidden="true" />
          ) : (
            <Play className="w-6 h-6 fill-current translate-x-0.5" aria-hidden="true" />
          )}
        </button>
      </motion.div>
    </AnimatePresence>
  );
});

MiniPlayer.displayName = 'MiniPlayer';

export default MiniPlayer;
