import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Repeat 
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
  if (!time || isNaN(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Helper to generate the squiggle path
const SquiggleLine = ({ progress }: { progress: number }) => {
  // Create a repeating sine wave pattern
  const width = 100;
  const points = [];
  for (let i = 0; i <= width; i++) {
    const x = i;
    const y = Math.sin(i * 0.8) * 3 + 5; // Amplitude and Frequency
    points.push(`${x},${y}`);
  }
  const pathData = `M ${points.join(' L ')}`;

  return (
    <svg viewBox="0 0 100 10" className="w-full h-full overflow-visible preserve-3d">
      {/* Background Track (faded) */}
      <path d={pathData} fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20" vectorEffect="non-scaling-stroke" />
      
      {/* Active Progress (solid) - Masked by width */}
      <svg width={`${progress}%`} className="overflow-hidden">
        <path d={pathData} fill="none" stroke="currentColor" strokeWidth="2" className="text-white" vectorEffect="non-scaling-stroke" />
      </svg>
      
      {/* Thumb/Knob */}
      <circle 
        cx={`${progress}%`} 
        cy="50%" 
        r="4" 
        fill="currentColor" 
        className="text-white drop-shadow-md"
      />
    </svg>
  );
};

const FullPlayer: React.FC<FullPlayerProps> = ({
  currentTrack, playerState, isPlayerOpen, onClose, togglePlay, nextTrack, prevTrack, setPlayerState, currentTime, duration, handleSeek
}) => {
  const progress = (currentTime / (duration || 1)) * 100;

  return (
    <AnimatePresence mode="wait">
      {isPlayerOpen && currentTrack && (
        <motion.div
          key="full-player-overlay"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 0.8 }}
          className="fixed inset-0 bg-[#2a1b2a] z-[100] flex flex-col safe-area-top safe-area-bottom overflow-hidden font-sans"
        >
          {/* Dynamic Background with heavy matte overlay */}
          <div className="absolute inset-0 z-0">
            {currentTrack.coverArt && (
              <motion.img 
                key={currentTrack.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                src={currentTrack.coverArt} 
                className="w-full h-full object-cover blur-[80px] scale-125 saturate-150"
              />
            )}
            {/* Dark tint to match the screenshot's high contrast look */}
            <div className="absolute inset-0 bg-[#1e1e1e]/80 mix-blend-multiply" />
          </div>

          <div className="relative z-10 flex flex-col h-full p-6 pb-8">
            
            {/* Header: Chevron, Title, Action Icons */}
            <header className="flex justify-between items-center mb-6">
              <button 
                onClick={onClose} 
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors backdrop-blur-md"
              >
                <ChevronDown size={24} />
              </button>
              
              <div className="text-center">
                <span className="text-sm font-medium text-white/90">Now Playing</span>
              </div>
              
              <div className="flex gap-3">
                 <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors backdrop-blur-md">
                  <MessageSquareQuote size={20} />
                </button>
                <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors backdrop-blur-md">
                  <ListMusic size={20} />
                </button>
              </div>
            </header>

            {/* Album Art */}
            <div className="flex-1 flex items-center justify-center py-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="relative aspect-square w-full max-w-[340px] rounded-[32px] overflow-hidden shadow-2xl"
              >
                {currentTrack.coverArt ? (
                  <img src={currentTrack.coverArt} className="w-full h-full object-cover" alt="Album Art" />
                ) : (
                  <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                    <span className="text-white/20 text-4xl font-bold">Music</span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Track Info */}
            <div className="mt-6 text-center space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight leading-tight px-4 truncate">
                {currentTrack.title}
              </h1>
              <p className="text-lg text-white/60 font-medium truncate">
                {currentTrack.artist}
              </p>
            </div>

            {/* Squiggly Progress Bar */}
            <div className="mt-10 mb-2 px-2 group">
              <div className="relative h-6 w-full flex items-center">
                {/* Visual Squiggle */}
                <div className="absolute inset-0 pointer-events-none">
                  <SquiggleLine progress={progress} />
                </div>
                
                {/* Invisible Touch Target */}
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
              </div>
              
              <div className="flex justify-between mt-2 text-xs font-medium text-white/50 font-mono tracking-widest">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Controls - The "Blocky" Layout */}
            <div className="mt-6 flex items-center justify-center gap-6">
              {/* Previous Button */}
              <button 
                onClick={prevTrack} 
                className="w-20 h-20 rounded-[28px] bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-95"
              >
                <SkipBack size={28} fill="currentColor" className="opacity-90" />
              </button>

              {/* Play/Pause Button - Distinctive */}
              <button 
                onClick={togglePlay}
                className="w-24 h-24 rounded-[32px] bg-[#e0b5d6] text-[#3a1d33] hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(224,181,214,0.3)] flex items-center justify-center transition-all"
              >
                {playerState.isPlaying ? (
                  <Pause size={40} fill="currentColor" />
                ) : (
                  <Play size={40} fill="currentColor" className="ml-1" />
                )}
              </button>

              {/* Next Button */}
              <button 
                onClick={nextTrack} 
                className="w-20 h-20 rounded-[28px] bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center text-white transition-all active:scale-95"
              >
                <SkipForward size={28} fill="currentColor" className="opacity-90" />
              </button>
            </div>

            {/* Bottom Actions Row */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <button 
                onClick={() => setPlayerState(p => ({ ...p, shuffle: !p.shuffle }))}
                className={`h-16 rounded-2xl flex items-center justify-center transition-all ${
                  playerState.shuffle ? "bg-white/20 text-white" : "bg-white/5 text-white/40"
                }`}
              >
                <Shuffle size={24} />
              </button>
              
              <button 
                onClick={() => setPlayerState(p => ({ ...p, repeat: p.repeat === RepeatMode.OFF ? RepeatMode.ALL : p.repeat === RepeatMode.ALL ? RepeatMode.ONE : RepeatMode.OFF }))}
                className={`h-16 rounded-2xl flex items-center justify-center relative transition-all ${
                  playerState.repeat !== RepeatMode.OFF ? "bg-white/20 text-white" : "bg-white/5 text-white/40"
                }`}
              >
                <Repeat size={24} />
                {playerState.repeat === RepeatMode.ONE && (
                  <span className="absolute top-4 right-4 w-1.5 h-1.5 bg-white rounded-full" />
                )}
              </button>

              <button className="h-16 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/10 transition-all">
                <Heart size={24} />
              </button>
            </div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPlayer;
