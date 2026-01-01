import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, ListMusic, Volume2, Music } from 'lucide-react';
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
  themeColor?: string;
  toggleShuffle?: () => void;
  onRemoveTrack?: (trackId: string) => void;
}

const formatTime = (time: number): string => {
  if (!time || isNaN(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- Sub-component: Progress Slider ---
// Separated to prevent parent re-renders on every second update
const ProgressBar = ({ current, total, onSeek, isScrubbing, setIsScrubbing }: any) => {
  const [localValue, setLocalValue] = useState(current);

  useEffect(() => {
    if (!isScrubbing) setLocalValue(current);
  }, [current, isScrubbing]);

  const percentage = (localValue / (total || 1)) * 100;

  return (
    <div className="mb-8 group relative w-full">
      <div className="relative h-1.5 w-full bg-white/10 rounded-full overflow-hidden group-hover:h-2 transition-all">
        <div 
          className="absolute h-full bg-white/40 rounded-full transition-all" 
          style={{ width: `${percentage}%` }} 
        />
      </div>
      <input
        type="range"
        min="0"
        max={total || 0}
        value={localValue}
        onMouseDown={() => setIsScrubbing(true)}
        onTouchStart={() => setIsScrubbing(true)}
        onMouseUp={() => setIsScrubbing(false)}
        onTouchEnd={() => setIsScrubbing(false)}
        onChange={(e) => {
          setLocalValue(Number(e.target.value));
          onSeek(e);
        }}
        className="absolute -top-1 inset-x-0 w-full h-4 opacity-0 cursor-pointer z-10"
      />
      <div className="flex justify-between mt-3 text-[12px] font-bold text-white/40 tabular-nums tracking-wider">
        <span>{formatTime(localValue)}</span>
        <span>{formatTime(total)}</span>
      </div>
    </div>
  );
};

const FullPlayer: React.FC<FullPlayerProps> = React.memo(({
  currentTrack, playerState, isPlayerOpen, onClose,
  togglePlay, nextTrack, prevTrack, setPlayerState,
  currentTime, duration, handleSeek, toggleShuffle,
  onRemoveTrack
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Load tracks efficiently
  useEffect(() => {
    if (showQueue && Object.keys(tracks).length === 0) {
      dbService.getAllTracks().then(t => {
        const trackMap = t.reduce((acc, tr) => ({ ...acc, [tr.id]: tr }), {});
        setTracks(trackMap);
      });
    }
  }, [showQueue, tracks]);

  const handleShuffleClick = useCallback(() => {
    toggleShuffle ? toggleShuffle() : setPlayerState(p => ({ ...p, shuffle: !p.shuffle }));
  }, [toggleShuffle, setPlayerState]);

  const cycleRepeat = useCallback(() => {
    setPlayerState(p => {
      const modes = [RepeatMode.OFF, RepeatMode.ALL, RepeatMode.ONE];
      const nextMode = modes[(modes.indexOf(p.repeat) + 1) % modes.length];
      return { ...p, repeat: nextMode };
    });
  }, [setPlayerState]);

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
          className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden"
        >
          {/* Background Layer */}
          <div className="absolute inset-0 z-0">
            <motion.img 
              key={currentTrack.coverArt}
              src={currentTrack.coverArt} 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="w-full h-full object-cover blur-[100px] scale-150"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black" />
          </div>

          {/* Header/Grabber */}
          <div className="relative z-10 flex flex-col items-center pt-2 pb-6">
            <button
              onClick={onClose}
              className="w-full h-8 flex items-center justify-center mb-4 cursor-pointer"
              aria-label="Close player"
            >
              <div className="w-12 h-1.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors" />
            </button>
            <div className="w-full px-8 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Playing from Library</span>
                <button 
                  onClick={() => setShowQueue(!showQueue)}
                  className={`p-2 rounded-full transition-all ${showQueue ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
                >
                  <ListMusic size={20} />
                </button>
            </div>
          </div>

          <main className="relative z-10 flex-1 flex flex-col px-8 max-w-lg mx-auto w-full">
            <AnimatePresence mode="wait">
              {showQueue ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex-1 overflow-hidden bg-white/5 rounded-[2rem] border border-white/10 backdrop-blur-2xl mb-8"
                >
                  <QueueList
                    queue={playerState.queue}
                    currentTrackId={currentTrack.id}
                    tracks={tracks}
                    onReorder={(newQueue) => setPlayerState(p => ({ ...p, queue: newQueue }))}
                    onPlay={(id) => setPlayerState(p => ({ ...p, currentTrackId: id, isPlaying: true }))}
                    onRemove={onRemoveTrack}
                  />
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col justify-center"
                >
                  {/* Artwork */}
                  <motion.div
                    layoutId="main-artwork"
                    animate={{ scale: playerState.isPlaying ? 1 : 0.9 }}
                    className="relative aspect-square w-full rounded-[2rem] shadow-2xl shadow-black/50 overflow-hidden mb-12"
                  >
                    {currentTrack.coverArt ? (
                      <img src={currentTrack.coverArt} className="w-full h-full object-cover" alt={currentTrack.title} />
                    ) : (
                      <div className="w-full h-full bg-white/5 flex items-center justify-center"><Music size={64} /></div>
                    )}
                  </motion.div>

                  {/* Info */}
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-3xl font-bold text-white truncate">{currentTrack.title}</h1>
                      <p className="text-xl text-white/50 truncate mt-1">{currentTrack.artist}</p>
                    </div>
                    <button className="ml-4 p-3 rounded-full bg-white/5 text-white/40 hover:text-red-500 transition-colors">
                      <Heart size={24} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Common Controls Area */}
            <div className="pb-12">
              <ProgressBar 
                current={currentTime} 
                total={duration} 
                onSeek={handleSeek}
                isScrubbing={isScrubbing}
                setIsScrubbing={setIsScrubbing}
              />

              <div className="flex items-center justify-between">
                <button onClick={handleShuffleClick} className={`${playerState.shuffle ? 'text-primary' : 'text-white/40'}`}>
                  <Shuffle size={20} />
                </button>

                <div className="flex items-center gap-6">
                  <button onClick={prevTrack} className="text-white hover:scale-110 active:scale-90 transition-transform">
                    <SkipBack size={32} fill="white" />
                  </button>
                  <button 
                    onClick={togglePlay}
                    className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
                  >
                    {playerState.isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
                  </button>
                  <button onClick={nextTrack} className="text-white hover:scale-110 active:scale-90 transition-transform">
                    <SkipForward size={32} fill="white" />
                  </button>
                </div>

                <button onClick={cycleRepeat} className={`${playerState.repeat !== RepeatMode.OFF ? 'text-primary' : 'text-white/40'}`}>
                  <Repeat size={20} />
                  {playerState.repeat === RepeatMode.ONE && <div className="absolute top-0 -right-1 w-1 h-1 bg-current rounded-full" />}
                </button>
              </div>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

FullPlayer.displayName = 'FullPlayer';
export default FullPlayer;
