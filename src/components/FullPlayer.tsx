import React, { useState, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useDragControls,
} from 'framer-motion';
import {
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  ListMusic,
  ChevronDown,
} from 'lucide-react';
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
  handleSeek: (e: any) => void;
  toggleShuffle: () => void;
  onRemoveTrack: (trackId: string) => void;
}

const formatTime = (time: number) => {
  if (!time || isNaN(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const FullPlayer: React.FC<FullPlayerProps> = ({
  currentTrack,
  playerState,
  isPlayerOpen,
  onClose,
  togglePlay,
  playTrack,
  nextTrack,
  prevTrack,
  setPlayerState,
  currentTime,
  duration,
  handleSeek,
  toggleShuffle,
  onRemoveTrack,
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  
  // -- Seek State --
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);

  const windowHeight =
    typeof window !== 'undefined' ? window.innerHeight : 1000;

  useEffect(() => {
    dragY.set(0);
  }, [isPlayerOpen]);

  // Only sync external time when NOT scrubbing
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  useEffect(() => {
    if (!isPlayerOpen) return;
    (async () => {
      const all = await dbService.getAllTracks();
      const map: Record<string, Track> = {};
      all.forEach(t => (map[t.id] = t));
      setTracks(map);
    })();
  }, [isPlayerOpen]);

  if (!currentTrack) return null;

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['OFF', 'ALL', 'ONE'];
    const next =
      modes[(modes.indexOf(playerState.repeat) + 1) % modes.length];
    setPlayerState(p => ({ ...p, repeat: next }));
    dbService.setSetting('repeat', next);
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setScrubValue(value);
  };

  const handleScrubStart = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => {
    // CRITICAL FIX: Stop the parent motion.div from detecting a drag
    e.stopPropagation(); 
    setIsScrubbing(true);
  };

  const handleScrubEnd = () => {
    handleSeek({ target: { value: scrubValue } });
    setTimeout(() => {
        setIsScrubbing(false);
    }, 50);
  };

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
          key="player"
          initial={{ y: windowHeight }}
          animate={{ y: 0 }}
          exit={{ y: windowHeight }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.12}
          style={{ opacity }}
          onDrag={(_, i) => dragY.set(i.offset.y)}
          onDragEnd={(_, i) => {
            if (i.offset.y > 100) onClose(); // Reduced threshold for easier closing
            else dragY.set(0);
          }}
          className="fixed inset-0 z-[100] bg-black flex flex-col"
        >
          {/* background */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <motion.div
              key={currentTrack.coverArt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ duration: 1 }}
              className="absolute inset-0"
            >
              <img
                src={currentTrack.coverArt}
                className="w-full h-full object-cover blur-[120px] scale-125"
              />
            </motion.div>
            <div className="absolute inset-0 bg-black/50" />
          </div>

          {/* Header with Close Button and Drag Handle */}
          <div 
             className="flex items-center justify-between px-6 pt-6 pb-2 shrink-0"
             onPointerDown={e => dragControls.start(e)} // Entire header triggers drag
          >
             <button 
               onClick={onClose} 
               className="p-2 -ml-2 text-white/70 hover:text-white active:scale-90 transition"
             >
                <ChevronDown size={32} />
             </button>
             
             {/* Visual Drag Handle */}
             <div className="w-12 h-1.5 bg-white/30 rounded-full cursor-grab active:cursor-grabbing" />
             
             {/* Spacer for symmetry or Menu button */}
             <div className="w-10" /> 
          </div>

          <main className="flex-1 px-6 pb-10 flex flex-col landscape:flex-row landscape:items-center landscape:justify-center landscape:gap-12 landscape:px-12">
            
            {/* LEFT SIDE: Art or Queue */}
            <div className="flex-1 flex flex-col landscape:h-full landscape:justify-center landscape:w-1/2 landscape:max-w-lg relative">
              <AnimatePresence mode="wait">
                {!showQueue ? (
                  <motion.div
                    key="art-view"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex items-center justify-center py-8 landscape:py-0"
                  >
                    <motion.div
                      key={currentTrack.id}
                      initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                      className="w-full flex justify-center"
                    >
                      <img
                        src={currentTrack.coverArt}
                        className="w-full max-w-[85vw] aspect-square rounded-3xl shadow-2xl object-cover landscape:max-w-full landscape:h-auto landscape:max-h-[70vh]"
                      />
                    </motion.div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="queue-view"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 overflow-y-auto bg-white/5 rounded-3xl p-4 backdrop-blur scrollbar-hide h-full max-h-[70vh] landscape:max-h-full"
                  >
                    <QueueList
                      queue={playerState.queue}
                      currentTrackId={currentTrack.id}
                      tracks={tracks}
                      onPlay={id => playTrack(id, { fromQueue: true })}
                      onRemove={onRemoveTrack}
                      onReorder={q =>
                        setPlayerState(p => ({ ...p, queue: q }))
                      }
                      onClose={() => setShowQueue(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT SIDE: Controls & Info */}
            <div className="flex flex-col landscape:w-1/2 landscape:max-w-md landscape:justify-center">
              
              {!showQueue && (
                  <div className="text-center mt-6 mb-2 landscape:mt-0 landscape:mb-8 landscape:text-left">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentTrack.title}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h1 className="text-2xl font-bold text-white truncate px-4 landscape:px-0 landscape:text-4xl">
                          {currentTrack.title}
                        </h1>
                        <p className="text-white/50 truncate px-4 text-lg landscape:px-0 landscape:text-xl">
                          {currentTrack.artist}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
              )}

              {/* Slider */}
              {/* Added pointer-events-auto and onPointerDown stopPropagation */}
              <div 
                className="mt-8 landscape:mt-4 pointer-events-auto"
                onPointerDown={(e) => e.stopPropagation()} 
              >
                <div className="relative h-1.5 bg-white/10 rounded-full group cursor-pointer touch-none">
                  {/* Visual Progress Bar */}
                  <motion.div
                    className="absolute h-full bg-white rounded-full pointer-events-none"
                    style={{
                      width: `${(scrubValue / Math.max(duration, 0.01)) * 100}%`,
                    }}
                    layoutId="progressBar"
                  />
                  
                  {/* Interactive Slider Input */}
                  <input
                    type="range"
                    min={0}
                    max={Math.max(duration, 0.01)}
                    step={0.01}
                    value={scrubValue}
                    onChange={handleScrubChange}
                    onPointerDown={handleScrubStart}
                    onMouseDown={handleScrubStart}
                    onTouchStart={handleScrubStart}
                    onPointerUp={handleScrubEnd}
                    onMouseUp={handleScrubEnd}
                    onTouchEnd={handleScrubEnd}
                    className="absolute inset-0 opacity-0 w-full h-4 -top-1.5 cursor-pointer touch-none z-50"
                  />
                </div>

                <div className="flex justify-between text-xs text-white/40 mt-2 font-mono font-medium">
                  <span>{formatTime(scrubValue)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between mt-6 landscape:mt-8">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleShuffle}
                  className="p-2"
                >
                  <Shuffle
                    className={
                      playerState.shuffle ? 'text-green-400' : 'text-white/40'
                    }
                    size={20}
                  />
                </motion.button>

                <div className="flex items-center gap-6">
                  <motion.button
                    whileTap={{ scale: 0.8 }}
                    onClick={prevTrack}
                  >
                    <SkipBack size={32} fill="white" className="text-white" />
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={togglePlay}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg shadow-white/10"
                  >
                    <AnimatePresence mode="wait">
                      {playerState.isPlaying ? (
                        <motion.div
                          key="pause"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.1 }}
                        >
                          <Pause fill="black" size={32} className="text-black" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="play"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.5, opacity: 0 }}
                          transition={{ duration: 0.1 }}
                        >
                          <Play fill="black" size={32} className="text-black ml-1" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.8 }}
                    onClick={nextTrack}
                  >
                    <SkipForward size={32} fill="white" className="text-white" />
                  </motion.button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleRepeat}
                  className="p-2 relative"
                >
                  <Repeat
                    size={20}
                    className={
                      playerState.repeat !== 'OFF'
                        ? 'text-green-400'
                        : 'text-white/40'
                    }
                  />
                  {playerState.repeat === 'ONE' && (
                    <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold text-black bg-green-400 rounded-full w-3 h-3 flex items-center justify-center">
                      1
                    </span>
                  )}
                </motion.button>
              </div>

              <div className="flex justify-center mt-6 landscape:justify-start">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowQueue(v => !v)}
                  className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition-colors"
                >
                  {showQueue ? (
                    <ListMusic className="text-green-400" />
                  ) : (
                    <ListMusic className="text-white" />
                  )}
                </motion.button>
              </div>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPlayer;
