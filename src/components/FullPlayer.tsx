import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from 'framer-motion';
import { Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, ListMusic } from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
import QueueList from './QueueList';
import { dbService } from '../db';

interface FullPlayerProps {
  currentTrack: Track | null;
  playerState: PlayerState;
  isPlayerOpen: boolean;
  onClose: () => void;
  togglePlay: () => void;
  playTrack: (id: string, options?: any) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
  currentTime: number;
  duration: number;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleShuffle: () => void;
  onRemoveTrack: (trackId: string) => void;
  themeColor?: string;
}

const formatTime = (time: number): string => {
  if (!time || isNaN(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const FullPlayer: React.FC<FullPlayerProps> = React.memo(({
  currentTrack, playerState, isPlayerOpen, onClose,
  togglePlay, playTrack, nextTrack, prevTrack, currentTime,
  duration, handleSeek, toggleShuffle, onRemoveTrack, setPlayerState
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 768);

  // Local state for smooth seeking
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync scrubValue with actual time ONLY when NOT scrubbing
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

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

  if (!currentTrack) return null;

  const toggleRepeat = () => {
      const modes: RepeatMode[] = ['OFF', 'ALL', 'ONE'];
      const currentIdx = modes.indexOf(playerState.repeat);
      const nextMode = modes[(currentIdx + 1) % modes.length];

      setPlayerState(prev => ({...prev, repeat: nextMode}));
      dbService.setSetting('repeat', nextMode);
  };

  // -- HANDLERS --
  
  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScrubValue(parseFloat(e.target.value));
  };

  const handlePointerDown = () => {
    setIsScrubbing(true);
  };

  const handlePointerUp = () => {
     setIsScrubbing(false);
     const syntheticEvent = {
        target: { value: scrubValue.toString() },
        currentTarget: { value: scrubValue.toString() }
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleSeek(syntheticEvent);
  };

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
          
          // CRITICAL FIX: Disable global drag listener. 
          // This prevents the modal from stealing clicks from buttons/queue.
          dragListener={false} 
          
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.1}
          onDragEnd={(_, info) => { if (info.offset.y > 150) onClose(); }}
          style={{ y: dragY, opacity }}
          className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden"
        >
          {/* Dynamic Background */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <motion.img 
              key={currentTrack.coverArt}
              src={currentTrack.coverArt} 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ duration: 1 }}
              className="w-full h-full object-cover blur-[100px] scale-125"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* DRAG HANDLE - Only this area starts the drag now */}
          <div
            className="relative z-10 flex flex-col items-center pt-safe pb-6 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <button onClick={onClose} className="w-full h-10 flex items-center justify-center">
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </button>
          </div>

          <main className="relative z-10 flex-1 flex flex-col md:flex-row md:items-center md:gap-12 md:px-12 px-8 max-w-7xl mx-auto w-full h-full pb-safe-bottom">

            <AnimatePresence mode="wait">
              {(!showQueue || isLargeScreen) && (
                 <motion.div
                   key="art"
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className={`flex-1 flex flex-col justify-center ${showQueue ? 'hidden md:flex' : ''}`}
                 >
                   {/* Album Art - We allow dragging from here too if queue is closed */}
                   <motion.div
                     onPointerDown={(e) => !showQueue && dragControls.start(e)}
                     animate={{ scale: playerState.isPlaying ? 1 : 0.85 }}
                     transition={{ type: "spring", stiffness: 80, damping: 15 }}
                     className="aspect-square w-full max-w-md mx-auto rounded-[2rem] overflow-hidden shadow-2xl mb-8 md:mb-0 cursor-grab active:cursor-grabbing"
                   >
                     <img src={currentTrack.coverArt} className="w-full h-full object-cover" alt="Cover" />
                   </motion.div>
                   
                   <div className="mt-8 md:hidden text-center">
                     <h1 className="text-3xl font-bold text-white truncate">{currentTrack.title}</h1>
                     <p className="text-xl text-white/50 truncate">{currentTrack.artist}</p>
                   </div>
                 </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {showQueue && (
                <motion.div 
                  key="queue" 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  // Ensure scrolling works
                  className="flex-1 overflow-y-auto bg-white/5 rounded-3xl mb-8 p-4 md:order-last w-full h-full backdrop-blur-md"
                >
                  <QueueList 
                    queue={playerState.queue} 
                    currentTrackId={currentTrack.id} 
                    tracks={tracks} 
                    onReorder={(newQueue) => setPlayerState(prev => ({ ...prev, queue: newQueue }))}
                    onPlay={(id) => playTrack(id, { fromQueue: true })}
                    onRemove={onRemoveTrack}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`flex flex-col justify-center w-full md:w-1/2 md:max-w-md ${showQueue ? 'md:hidden' : ''} md:flex`}>

               <div className="hidden md:block mb-8">
                  <h1 className="text-4xl font-bold text-white truncate">{currentTrack.title}</h1>
                  <p className="text-2xl text-white/50 truncate mt-2">{currentTrack.artist}</p>
               </div>

              {/* Slider & Controls */}
              <div className="pb-12 md:pb-0">
                <div className="relative w-full h-1.5 bg-white/10 rounded-full mb-8 group touch-none">
                  <div
                    className="absolute h-full bg-white rounded-full z-0 pointer-events-none"
                    style={{ width: `${(scrubValue / duration) * 100}%` }}
                  />
                  
                  <input
                    type="range"
                    step="0.01"
                    min="0"
                    max={duration || 0}
                    value={scrubValue}
                    onChange={handleScrubChange}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    style={{ touchAction: 'none' }} 
                  />

                  <div className="flex justify-between mt-4 text-xs text-white/40 font-mono">
                    <span>{formatTime(scrubValue)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {/* Buttons now use standard onClick because dragListener={false} */}
                  <button onClick={toggleShuffle} className={`p-2 transition-colors ${playerState.shuffle ? 'text-primary' : 'text-white/40 hover:text-white'}`}>
                    <Shuffle size={20} />
                  </button>

                  <div className="flex items-center gap-8">
                    <button onClick={prevTrack} className="p-2 hover:scale-110 active:scale-95 transition-transform">
                        <SkipBack size={32} fill="white" />
                    </button>
                    
                    <button onClick={togglePlay} className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-white/20">
                      {playerState.isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
                    </button>
                    
                    <button onClick={nextTrack} className="p-2 hover:scale-110 active:scale-95 transition-transform">
                        <SkipForward size={32} fill="white" />
                    </button>
                  </div>

                  <button onClick={toggleRepeat} className={`p-2 transition-colors relative ${playerState.repeat !== 'OFF' ? 'text-primary' : 'text-white/40 hover:text-white'}`}>
                    <Repeat size={20} />
                    {playerState.repeat === 'ONE' && (
                        <span className="absolute text-[8px] font-bold top-2 left-1/2 -translate-x-1/2">1</span>
                    )}
                  </button>
                </div>

                <div className="flex justify-center mt-10">
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
