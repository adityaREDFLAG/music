import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from 'framer-motion';
import { Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, ListMusic } from 'lucide-react';
import { Track, PlayerState } from '../types';
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
  togglePlay, nextTrack, prevTrack, currentTime, 
  duration
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 768);

  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadTracks = async () => {
      try {
        const allTracks = await dbService.getAllTracks();
        const trackMap = allTracks.reduce((acc, track) => {
          acc[track.id] = track;
          return acc;
        }, {} as Record<string, Track>);
        setTracks(trackMap);
      } catch (err) {
        console.error("Failed to load tracks for queue", err);
      }
    };
    if (isPlayerOpen) loadTracks();
  }, [isPlayerOpen]);

  // Media Session API: Disable seeking on lockscreen
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

      // Disable seeking
      navigator.mediaSession.setActionHandler('seekto', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
    }
  }, [currentTrack, togglePlay, prevTrack, nextTrack]);

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
          dragControls={dragControls}
          dragListener={!showQueue}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => { if (info.offset.y > 150) onClose(); }}
          style={{ y: dragY, opacity }}
          className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden"
        >
          <div className="absolute inset-0 z-0 pointer-events-none">
            <motion.img 
              src={currentTrack.coverArt} 
              className="w-full h-full object-cover blur-[100px] opacity-40 scale-125"
            />
          </div>

          <div
            className="relative z-10 flex flex-col items-center pt-2 pb-4 cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <button onClick={onClose} className="w-full h-10 flex items-center justify-center">
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </button>
          </div>

          <main className="relative z-10 flex-1 flex flex-col md:flex-row md:items-center md:gap-12 md:px-12 px-6 max-w-7xl mx-auto w-full min-h-0 pb-8">
            
            {/* Artwork Section */}
            <AnimatePresence mode="wait">
              {(!showQueue || isLargeScreen) && (
                 <motion.div
                   key="art"
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className={`flex-1 flex flex-col justify-center ${showQueue ? 'hidden md:flex' : ''}`}
                 >
                   <div className="aspect-square w-full max-w-md mx-auto rounded-[2.5rem] overflow-hidden shadow-2xl">
                     <img src={currentTrack.coverArt} className="w-full h-full object-cover" alt="Cover" />
                   </div>
                   <div className="mt-8 md:hidden">
                     <h1 className="text-3xl font-bold text-white truncate">{currentTrack.title}</h1>
                     <p className="text-xl text-white/50 truncate">{currentTrack.artist}</p>
                   </div>
                 </motion.div>
              )}
            </AnimatePresence>

            {/* Queue View - Updated with min-h-0 to enable scroll */}
            <AnimatePresence mode="wait">
              {showQueue && (
                <motion.div 
                  key="queue" 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="flex-1 min-h-0 overflow-hidden bg-white/5 rounded-3xl md:order-last w-full"
                >
                  <QueueList 
                    queue={playerState.queue} 
                    currentTrackId={currentTrack.id} 
                    tracks={tracks} 
                    onReorder={(newQueue) => setPlayerState(prev => ({ ...prev, queue: newQueue }))} 
                    onPlay={() => {}}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`flex flex-col justify-center w-full md:w-1/2 md:max-w-md ${showQueue ? 'mt-4 md:mt-0' : 'mt-0'}`}>
               <div className="hidden md:block mb-8">
                  <h1 className="text-4xl font-bold text-white truncate">{currentTrack.title}</h1>
                  <p className="text-2xl text-white/50 truncate mt-2">{currentTrack.artist}</p>
               </div>

              <div className="pb-4">
                <div className="relative w-full h-1.5 bg-white/10 rounded-full mb-8">
                  <div
                    className="absolute h-full bg-white rounded-full z-0"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                  {/* Seeking disabled in UI */}
                  <input
                    type="range"
                    value={currentTime}
                    readOnly
                    className="absolute inset-0 w-full h-full opacity-0 cursor-default pointer-events-none"
                  />
                  <div className="flex justify-between mt-4 text-xs text-white/40 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Shuffle size={20} className="text-white/40 cursor-pointer" />
                  <div className="flex items-center gap-8">
                    <SkipBack size={32} fill="white" className="cursor-pointer" onClick={prevTrack} />
                    <button onClick={togglePlay} className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                      {playerState.isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
                    </button>
                    <SkipForward size={32} fill="white" className="cursor-pointer" onClick={nextTrack} />
                  </div>
                  <Repeat size={20} className="text-white/40 cursor-pointer" />
                </div>

                <div className="flex justify-center mt-6">
                  <button
                    onClick={() => setShowQueue(!showQueue)}
                    className={`p-3 rounded-full transition-colors ${showQueue ? 'bg-white/20 text-white' : 'text-white/40'}`}
                  >
                    <ListMusic size={24} />
                  </button>
                </div>
              </div>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default FullPlayer;
