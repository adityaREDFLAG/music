import React, { useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MoreVertical, Music, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, ListMusic } from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
import QueueList from './QueueList';
import { dbService } from '../db';

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
  toggleShuffle?: () => void; // Added optional prop for shuffle toggle
}

const formatTime = (time: number): string => {
  if (!time || isNaN(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Animation Variants
const artVariants = {
  hidden: { opacity: 0, scale: 0.9, filter: 'blur(10px)' },
  visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.1, filter: 'blur(10px)' }
};

const textVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

const FullPlayer: React.FC<FullPlayerProps> = React.memo(({
  currentTrack, 
  playerState, 
  isPlayerOpen, 
  onClose, 
  togglePlay, 
  nextTrack, 
  prevTrack, 
  setPlayerState, 
  currentTime, 
  duration, 
  handleSeek,
  toggleShuffle
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});

  // Load tracks for queue display
  React.useEffect(() => {
      if (showQueue) {
          dbService.getAllTracks().then(t => {
              setTracks(t.reduce((acc, tr) => ({ ...acc, [tr.id]: tr }), {}));
          });
      }
  }, [showQueue]);

  const progress = useMemo(() => 
    (currentTime / (duration || 1)) * 100, 
    [currentTime, duration]
  );
   
  const formattedCurrentTime = useMemo(() => formatTime(currentTime), [currentTime]);
  const formattedDuration = useMemo(() => formatTime(duration), [duration]);

  const handleShuffleClick = useCallback(() => {
    if (toggleShuffle) {
        toggleShuffle();
    } else {
        // Fallback (though ideally should not happen if updated correctly)
        setPlayerState(p => ({ ...p, shuffle: !p.shuffle }));
    }
  }, [toggleShuffle, setPlayerState]);

  const cycleRepeat = useCallback(() => {
    setPlayerState(p => ({ 
      ...p, 
      repeat: p.repeat === RepeatMode.OFF 
        ? RepeatMode.ALL 
        : p.repeat === RepeatMode.ALL 
        ? RepeatMode.ONE 
        : RepeatMode.OFF 
    }));
  }, [setPlayerState]);

  if (!isPlayerOpen || !currentTrack) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="full-player-overlay"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 0.8 }}
        className="fixed inset-0 bg-background z-[100] flex flex-col safe-area-top safe-area-bottom overflow-hidden"
        role="dialog"
        aria-label="Full screen player"
      >
        {/* Dynamic Background with Crossfade */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {currentTrack.coverArt && (
              <motion.img 
                key={currentTrack.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: "easeInOut" }}
                src={currentTrack.coverArt}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-[100px] scale-150 grayscale-[0.3]"
              />
            )}
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/60 to-background" />
        </div>

        <div className="relative z-10 flex flex-col h-full p-6 md:px-12 md:max-w-2xl md:mx-auto w-full">
          {/* Header */}
          <header className="flex justify-between items-center mb-8 pt-4">
            <button 
              onClick={onClose} 
              className="p-3 -ml-3 text-on-surface/80 hover:text-on-surface rounded-full active:bg-surface-variant/20 transition-all"
            >
              <ChevronDown size={32} />
            </button>
            <div className="text-center opacity-0 md:opacity-100 transition-opacity">
              <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface/50 font-bold mb-0.5">
                {showQueue ? 'Queue' : 'Now Playing'}
              </p>
            </div>
            <button
                onClick={() => setShowQueue(!showQueue)}
                className={`p-3 -mr-3 rounded-full transition-all ${showQueue ? 'text-primary bg-primary/10' : 'text-on-surface/80 hover:text-on-surface'}`}
            >
              <ListMusic size={24} />
            </button>
          </header>

          {showQueue ? (
             <div className="flex-1 overflow-hidden min-h-0 bg-surface/50 rounded-3xl mb-8 backdrop-blur-md border border-white/5">
                 <QueueList
                    queue={playerState.queue}
                    currentTrackId={currentTrack.id}
                    tracks={tracks}
                    onReorder={(newQueue) => setPlayerState(p => ({ ...p, queue: newQueue }))}
                    onPlay={(id) => {
                        setPlayerState(p => ({ ...p, currentTrackId: id, isPlaying: true }));
                    }}
                 />
             </div>
          ) : (
            <>
            {/* Artwork Section with Transition */}
            <div className="flex-1 flex items-center justify-center py-2 min-h-0">
                <div className="relative aspect-square w-full h-auto max-h-[400px] max-w-[400px]">
                <AnimatePresence mode="popLayout">
                    <motion.div
                    key={currentTrack.id}
                    variants={artVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ type: "spring", stiffness: 200, damping: 25 }}
                    className="absolute inset-0"
                    >
                    <motion.div
                        animate={{
                        scale: playerState.isPlaying ? 1 : 0.92,
                        }}
                        transition={{ duration: 0.6, type: "spring" }}
                        className="w-full h-full rounded-[2rem] md:rounded-[3rem] shadow-[0_32px_64px_rgba(0,0,0,0.4)] overflow-hidden border border-white/5 bg-surface-variant"
                    >
                        {currentTrack.coverArt ? (
                        <img
                            src={currentTrack.coverArt}
                            className="w-full h-full object-cover"
                            alt={`${currentTrack.title} album art`}
                        />
                        ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-variant">
                            <Music className="w-24 h-24 text-on-surface/10" />
                        </div>
                        )}
                    </motion.div>
                    </motion.div>
                </AnimatePresence>
                </div>
            </div>

            {/* Track Metadata with Slide Animation */}
            <div className="mt-10 flex justify-between items-end gap-6">
                <div className="flex-1 min-w-0 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                    key={`${currentTrack.id}-meta`}
                    variants={textVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.3 }}
                    >
                    <h1 className="text-2xl md:text-3xl font-bold text-on-surface truncate leading-tight">
                        {currentTrack.title}
                    </h1>
                    <p className="text-lg md:text-xl text-on-surface/60 truncate mt-1">
                        {currentTrack.artist}
                    </p>
                    </motion.div>
                </AnimatePresence>
                </div>
                <motion.button
                whileTap={{ scale: 0.8 }}
                className="p-3 text-on-surface/60 hover:text-primary transition-colors flex-shrink-0"
                >
                <Heart size={28} />
                </motion.button>
            </div>
            </>
          )}

          {/* Seek Bar */}
          <div className="mt-8 group">
             <div className="relative h-2 w-full bg-surface-variant/50 rounded-full overflow-hidden">
              <motion.div 
                className="absolute h-full bg-primary rounded-full"
                style={{ width: `${progress}%` }}
                layoutId="progressBar"
              />
               <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
            </div>
            <div className="flex justify-between mt-2 text-xs font-medium text-on-surface/40 tabular-nums tracking-wider">
              <time>{formattedCurrentTime}</time>
              <time>{formattedDuration}</time>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="mt-8 mb-8 md:mb-12 flex items-center justify-between">
            <button
              onClick={handleShuffleClick}
              className={`transition-all p-3 rounded-full ${playerState.shuffle ? "text-primary bg-primary/10" : "text-on-surface/40 hover:text-on-surface/80"}`}
            >
              <Shuffle size={24} />
            </button>

            <div className="flex items-center gap-6">
              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={prevTrack} 
                className="text-on-surface p-2 hover:text-primary transition-colors"
              >
                <SkipBack size={42} fill="currentColor" />
              </motion.button>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={togglePlay}
                className="w-20 h-20 bg-primary rounded-2xl md:rounded-[28px] flex items-center justify-center text-primary-container shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-shadow"
              >
                {playerState.isPlaying ? (
                  <Pause size={36} fill="currentColor" />
                ) : (
                  <Play size={36} fill="currentColor" className="ml-1" />
                )}
              </motion.button>

              <motion.button 
                whileTap={{ scale: 0.9 }}
                onClick={nextTrack} 
                className="text-on-surface p-2 hover:text-primary transition-colors"
              >
                <SkipForward size={42} fill="currentColor" />
              </motion.button>
            </div>

            <button
              onClick={cycleRepeat}
              className={`transition-all relative p-3 rounded-full ${
                playerState.repeat !== RepeatMode.OFF ? "text-primary bg-primary/10" : "text-on-surface/40 hover:text-on-surface/80"
              }`}
            >
              <Repeat size={24} />
              {playerState.repeat === RepeatMode.ONE && (
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-current rounded-full ring-2 ring-background" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

FullPlayer.displayName = 'FullPlayer';

export default FullPlayer;
