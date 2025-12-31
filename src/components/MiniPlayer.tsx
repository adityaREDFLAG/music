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
          initial={{ y: 150, scale: 0.9, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 150, opacity: 0 }}
          onClick={onOpen}
          className="fixed bottom-[130px] left-10 right-10 glass border border-white/50 rounded-[56px] p-6 flex items-center gap-8 shadow-[0_30px_80px_rgba(0,0,0,0.15)] z-[70] cursor-pointer group md:left-20 md:right-20 lg:w-[600px] lg:mx-auto"
        >
          <div className="w-20 h-20 rounded-[36px] bg-[#6750A4]/10 overflow-hidden flex-shrink-0 relative">
            {currentTrack.coverArt ? <img src={currentTrack.coverArt} className="w-full h-full object-cover" /> : <Music className="w-full h-full p-6 text-[#6750A4] opacity-20" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-black text-2xl truncate tracking-tight">{currentTrack.title}</h4>
            <p className="text-lg font-bold opacity-30 truncate tracking-tight">{currentTrack.artist}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-20 h-20 rounded-full bg-[#21005D] text-white flex items-center justify-center shadow-2xl active:scale-90 transition-transform"
          >
            {playerState.isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current translate-x-1" />}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MiniPlayer;
