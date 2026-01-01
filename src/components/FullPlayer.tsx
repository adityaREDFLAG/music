import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, ListMusic } from 'lucide-react';
import { Track, PlayerState } from '../types';
import QueueList from './QueueList';

interface FullPlayerProps {
  currentTrack: Track | null;
  playerState: PlayerState;
  isPlayerOpen: boolean;
  onClose: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  currentTime: number;
  duration: number;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleShuffle?: () => void;
}

const FullPlayer: React.FC<FullPlayerProps> = React.memo(({
  currentTrack, playerState, isPlayerOpen, onClose,
  togglePlay, nextTrack, prevTrack,
  currentTime, duration, handleSeek, toggleShuffle
}) => {
  const [showQueue, setShowQueue] = useState(false);
  
  // Motion Values for smooth drag-to-close
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 300], [1, 0]);
  const scale = useTransform(dragY, [0, 300], [1, 0.9]);

  // Sync MediaSession API
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: [{ src: currentTrack.coverArt || '', sizes: '512x512', type: 'image/png' }]
    });

    const actions: [MediaSessionAction, () => void][] = [
      ['play', togglePlay],
      ['pause', togglePlay],
      ['previoustrack', prevTrack],
      ['nexttrack', nextTrack],
    ];

    actions.forEach(([action, handler]) => navigator.mediaSession.setActionHandler(action, handler));
  }, [currentTrack, togglePlay, prevTrack, nextTrack]);

  // Memoized time formatting for performance
  const timeDisplay = useMemo(() => ({
    current: formatTime(currentTime),
    total: formatTime(duration)
  }), [currentTime, duration]);

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
          key="full-player"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          drag="y"
          dragConstraints={{ top: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => { if (info.offset.y > 150) onClose(); }}
          style={{ y: dragY, opacity, scale }}
          className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 overflow-hidden touch-none"
        >
          {/* Immersive Background Blur */}
          <div className="absolute inset-0 z-0">
            <motion.img 
              key={currentTrack.coverArt}
              src={currentTrack.coverArt} 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              className="w-full h-full object-cover blur-[80px] scale-150"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black" />
          </div>

          {/* Header/Grabber */}
          <header className="relative z-10 flex flex-col items-center pt-4">
            <button 
              onClick={onClose}
              className="group p-4 flex flex-col items-center gap-2 active:scale-95 transition-transform"
            >
              <div className="w-12 h-1.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
            </button>
          </header>

          <main className="relative z-10 flex-1 flex flex-col px-8 max-w-md mx-auto w-full justify-between pb-12">
            
            {/* Toggleable View: Art vs Queue */}
            <div className="flex-1 flex flex-col justify-center py-8">
              <AnimatePresence mode="wait">
                {!showQueue ? (
                  <motion.section
                    key="art-view"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-8"
                  >
                    <div className="aspect-square w-full rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-zinc-900">
                      <img src={currentTrack.coverArt} className="w-full h-full object-cover" alt="Album Art" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-white tracking-tight truncate">{currentTrack.title}</h1>
                      <p className="text-xl text-white/60 truncate">{currentTrack.artist}</p>
                    </div>
                  </motion.section>
                ) : (
                  <motion.section 
                    key="queue-view"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="h-[400px] overflow-hidden bg-white/5 rounded-3xl backdrop-blur-md border border-white/10"
                  >
                     <QueueList queue={playerState.queue} currentTrackId={currentTrack.id} />
                  </motion.section>
                )}
              </AnimatePresence>
            </div>

            {/* Progress & Controls */}
            <footer className="space-y-8">
              <div className="space-y-4">
                <div className="relative w-full group">
                  <input 
                    type="range" step="0.1" min="0" max={duration || 0} value={currentTime}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-2 opacity-0 z-20 cursor-pointer"
                  />
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-white" 
                      style={{ width: `${(currentTime / duration) * 100}%` }} 
                    />
                  </div>
                </div>
                <div className="flex justify-between text-xs font-medium text-white/40 tabular-nums">
                  <span>{timeDisplay.current}</span>
                  <span>{timeDisplay.total}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <ControlBtn icon={Shuffle} active={playerState.isShuffle} onClick={toggleShuffle} />
                
                <div className="flex items-center gap-6">
                  <ControlBtn icon={SkipBack} size={32} onClick={prevTrack} fill />
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    onClick={togglePlay} 
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl active:bg-zinc-200 transition-colors"
                  >
                    {playerState.isPlaying ? <Pause size={36} fill="black" /> : <Play size={36} fill="black" className="ml-1" />}
                  </motion.button>
                  <ControlBtn icon={SkipForward} size={32} onClick={nextTrack} fill />
                </div>

                <ControlBtn 
                  icon={ListMusic} 
                  active={showQueue} 
                  onClick={() => setShowQueue(!showQueue)} 
                />
              </div>
            </footer>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// Helper component for cleaner buttons
const ControlBtn = ({ icon: Icon, onClick, active = false, size = 22, fill = false }: any) => (
  <motion.button
    whileTap={{ scale: 0.8 }}
    onClick={onClick}
    className={`transition-colors ${active ? 'text-green-400' : 'text-white/40 hover:text-white'}`}
  >
    <Icon size={size} fill={fill && !active ? "currentColor" : "none"} />
  </motion.button>
);

const formatTime = (time: number): string => {
  if (!time || isNaN(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default FullPlayer;
