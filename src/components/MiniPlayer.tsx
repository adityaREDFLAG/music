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
  onNext?: () => void;
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

  if (!currentTrack) return null;

  return (
    <motion.div
      initial={{ y: 150, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 150, opacity: 0, scale: 0.9 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 280, damping: 24, mass: 0.8 }}
      onClick={onOpen}
      className="fixed bottom-[calc(92px+env(safe-area-inset-bottom))] left-3 right-3 md:left-auto md:right-6 md:w-[420px]
                 h-[76px] bg-[#1c1c1e]/80 backdrop-blur-[32px] saturate-[180%] rounded-[24px]
                 flex items-center pl-3 pr-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-[500] cursor-pointer
                 border border-white/10 overflow-hidden group hover:shadow-[0_12px_48px_rgba(0,0,0,0.5)] transition-shadow"
      layoutId="mini-player"
    >
      {/* Subtle Progress Bar at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 pointer-events-none">
         <motion.div
            className="h-full bg-white/80 rounded-r-full"
            style={{ width: `${progress * 100}%` }}
            transition={{ type: 'tween', ease: 'linear', duration: 0.2 }}
         />
      </div>

      {/* Album Art */}
      <motion.div
        layoutId={`artwork-${currentTrack.id}`}
        className="relative w-[52px] h-[52px] rounded-[14px] overflow-hidden flex-shrink-0 shadow-lg ring-1 ring-white/10"
      >
        {!imgError && currentTrack.coverArt ? (
          <img
            src={currentTrack.coverArt}
            className="w-full h-full object-cover"
            alt={currentTrack.title}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <Music className="w-6 h-6 text-zinc-500" />
          </div>
        )}
      </motion.div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-4 gap-0.5">
        <motion.h4
           layoutId={`title-${currentTrack.id}`}
           className="text-[16px] font-semibold text-white truncate leading-tight tracking-tight"
        >
          {currentTrack.title}
        </motion.h4>
        <motion.p
           layoutId={`artist-${currentTrack.id}`}
           className="text-[14px] text-zinc-400 truncate leading-tight font-medium"
        >
          {currentTrack.artist}
        </motion.p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
         <motion.button
           onClick={handleTogglePlay}
           whileTap={{ scale: 0.85 }}
           className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black shadow-sm"
         >
            {playerState.isPlaying ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" className="ml-0.5" />
            )}
         </motion.button>

         {onNext && (
           <motion.button
             onClick={handleNext}
             whileTap={{ scale: 0.85 }}
             className="w-10 h-10 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
           >
             <SkipForward size={24} fill="currentColor" />
           </motion.button>
         )}
      </div>

    </motion.div>
  );
});

MiniPlayer.displayName = 'MiniPlayer';

export default MiniPlayer;
