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

const MiniPlayer: React.FC<MiniPlayerProps> = ({ currentTrack, playerState, isPlayerOpen, onOpen, togglePlay }) => {
  return (
    <AnimatePresence>
      {currentTrack && !isPlayerOpen && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          onClick={onOpen}
          className="fixed bottom-[96px] left-4 right-4 h-[72px] bg-secondary-container rounded-2xl flex items-center px-4 pr-6 gap-4 shadow-elevation-3 z-[60] cursor-pointer md:left-auto md:right-4 md:w-96 md:bottom-4"
        >
          <div className="w-12 h-12 rounded-lg bg-surface-variant overflow-hidden flex-shrink-0 relative">
            {currentTrack.coverArt ? (
              <img src={currentTrack.coverArt} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                 <Music className="w-6 h-6 text-secondary opacity-50" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h4 className="text-title-medium text-secondary-on-container truncate">{currentTrack.title}</h4>
            <p className="text-body-small text-secondary-on-container/70 truncate">{currentTrack.artist}</p>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-10 h-10 rounded-full bg-secondary-on-container text-secondary-container flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          >
            {playerState.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MiniPlayer;
