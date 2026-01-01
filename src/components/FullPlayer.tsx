import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, ListMusic, Music } from 'lucide-react';
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
  toggleShuffle?: () => void;
  onRemoveTrack?: (trackId: string) => void;
}

const formatTime = (time: number): string => {
  if (!time || isNaN(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Drag to close logic
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);

  // --- Lockscreen & Media Session API ---
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [{ src: currentTrack.coverArt || '', sizes: '512x512', type: 'image/png' }]
      });

      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
      
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          const e = { target: { value: details.seekTime } } as any;
          handleSeek(e);
        }
      });
    }
  }, [currentTrack, togglePlay, prevTrack, nextTrack, handleSeek]);

  // Sync seek position to system
  useEffect(() => {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && duration > 0) {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1,
        position: currentTime
      });
    }
  }, [currentTime, duration]);

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
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => { if (info.offset.y > 150) onClose(); }}
          style={{ y: dragY, opacity }}
          className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden touch-none"
        >
          {/* Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <motion.img 
              src={currentTrack.coverArt} 
              className="w-full h-full object-cover blur-[100px] opacity-40 scale-125"
            />
          </div>

          {/* Close Grabber */}
          <div className="relative z-10 flex flex-col items-center pt-2 pb-6">
            <button onClick={onClose} className="w-full h-10 flex items-center justify-center">
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </button>
          </div>

          <main className="relative z-10 flex-1 flex flex-col px-8 max-w-lg mx-auto w-full">
            <AnimatePresence mode="wait">
              {!showQueue ? (
                <motion.div 
                  key="art"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex-1 flex flex-col justify-center"
                >
                  <div className="aspect-square w-full rounded-[2rem] overflow-hidden shadow-2xl mb-12">
                    <img src={currentTrack.coverArt} className="w-full h-full object-cover" />
                  </div>
                  <div className="mb-10">
                    <h1 className="text-3xl font-bold text-white truncate">{currentTrack.title}</h1>
                    <p className="text-xl text-white/50 truncate">{currentTrack.artist}</p>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="queue" className="flex-1 overflow-hidden bg-white/5 rounded-3xl mb-8">
                  <QueueList 
                    queue={playerState.queue} 
                    currentTrackId={currentTrack.id} 
                    tracks={tracks} 
                    onReorder={() => {}} 
                    onPlay={() => {}}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slider & Controls */}
            <div className="pb-12">
              <div className="relative w-full h-1.5 bg-white/10 rounded-full mb-8">
                <div 
                  className="absolute h-full bg-white rounded-full" 
                  style={{ width: `${(currentTime / duration) * 100}%` }} 
                />
                <input 
                  type="range" step="0.1" min="0" max={duration || 0} value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex justify-between mt-4 text-xs text-white/40 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Shuffle size={20} className="text-white/40" />
                <div className="flex items-center gap-8">
                  <SkipBack size={32} fill="white" onClick={prevTrack} />
                  <button onClick={togglePlay} className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                    {playerState.isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
                  </button>
                  <SkipForward size={32} fill="white" onClick={nextTrack} />
                </div>
                <Repeat size={20} className="text-white/40" />
              </div>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default FullPlayer;
