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
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={onOpen}
        className="fixed bottom-[90px] left-3 right-3 h-[64px] glass rounded-2xl flex items-center px-2 pr-4 shadow-ios-medium z-[60] cursor-pointer md:left-auto md:right-8 md:w-[400px] md:bottom-8 overflow-hidden group border border-white/5"
        role="button"
        tabIndex={0}
        aria-label={`Now playing: ${currentTrack.title} by ${currentTrack.artist}`}
      >
        {/* Album Art with Spin Animation (optional) or just nice shadow */}
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative shadow-md ml-1">
            <img 
              src={currentTrack.coverArt || '/default-album-art.png'}
              className="w-full h-full object-cover" 
              alt=""
              loading="lazy"
            />
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center px-3">
          <h4 className="text-[15px] font-semibold text-on-surface truncate leading-tight">
            {currentTrack.title}
          </h4>
          <p className="text-[13px] text-on-surface/60 truncate mt-0.5 leading-tight font-medium">
            {currentTrack.artist}
          </p>
        </div>

        {/* Play/Pause Button */}
        <button
          onClick={handleTogglePlay}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
          aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
        >
          {playerState.isPlaying ? (
            <Pause className="w-6 h-6 fill-current text-on-surface" aria-hidden="true" />
          ) : (
            <Play className="w-6 h-6 fill-current text-on-surface translate-x-0.5" aria-hidden="true" />
          )}
        </button>
      </motion.div>
    </AnimatePresence>
  );
});

MiniPlayer.displayName = 'MiniPlayer';

export default MiniPlayer;
