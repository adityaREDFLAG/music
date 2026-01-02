import React, { useState, useEffect, useCallback } from 'react';
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
  X,
  GripVertical,
} from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
import { dbService } from '../db';

// ... (formatTime and QueueList remain the same, they are logically correct)

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
  onVolumeChange,
  toggleShuffle,
  onRemoveTrack,
  audioRef,
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const safeDuration = Math.max(duration, 0.01);
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 300], [1, 0]);

  // --- FIX 1: Media Session Cleanup & Stability ---
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: [{ src: currentTrack.coverArt, sizes: '512x512', type: 'image/png' }],
    });

    const handlers = [
      ['play', togglePlay],
      ['pause', togglePlay],
      ['previoustrack', prevTrack],
      ['nexttrack', nextTrack],
      ['seekto', (details: any) => {
        if (typeof details.seekTime === 'number') {
           handleSeek(details.seekTime);
           setScrubValue(details.seekTime);
        }
      }],
    ];

    handlers.forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action as any, handler as any); } 
      catch (e) { console.error(e); }
    });

    // Cleanup handlers on unmount or track change
    return () => {
      handlers.forEach(([action]) => {
        navigator.mediaSession.setActionHandler(action as any, null);
      });
    };
  }, [currentTrack, playerState.isPlaying, togglePlay, prevTrack, nextTrack, handleSeek]);

  // Update Media Session Progress
  useEffect(() => {
    if ('mediaSession' in navigator && safeDuration > 0.01) {
      navigator.mediaSession.setPositionState({
        duration: safeDuration,
        playbackRate: 1.0,
        position: Math.min(currentTime, safeDuration),
      });
    }
  }, [currentTime, safeDuration]);

  // --- FIX 2: Smooth Scrubbing Logic ---
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScrubValue(Number(e.target.value));
  };

  const handleSeekPointerUp = () => {
    setIsScrubbing(false);
    handleSeek(scrubValue); // Actually seek only when user lets go
  };

  const handlePointerDown = () => {
    setIsScrubbing(true);
  };

  // --- Data Fetching ---
  useEffect(() => {
    if (!isPlayerOpen) return;
    let isMounted = true;
    (async () => {
      const all = await dbService.getAllTracks();
      if (isMounted) {
        const map: Record<string, Track> = {};
        all.forEach(t => (map[t.id] = t));
        setTracks(map);
      }
    })();
    return () => { isMounted = false; };
  }, [isPlayerOpen]);

  if (!currentTrack) return null;

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['OFF', 'ALL', 'ONE'];
    const next = modes[(modes.indexOf(playerState.repeat) + 1) % modes.length];
    setPlayerState(p => ({ ...p, repeat: next }));
    dbService.setSetting('repeat', next);
  };

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
          key="player"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={0.05}
          style={{ opacity, y: dragY }}
          onDragEnd={(_, i) => {
            if (i.offset.y > 120 || i.velocity.y > 600) onClose();
            else dragY.set(0);
          }}
          className="fixed inset-0 z-[100] bg-black flex flex-col touch-none overflow-hidden"
        >
          {/* Background & Blur */}
          <div className="absolute inset-0 -z-10">
            <motion.img
              key={currentTrack.coverArt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              src={currentTrack.coverArt}
              className="w-full h-full object-cover blur-[100px] scale-150"
              alt=""
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* Drag Handle */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="h-10 flex items-center justify-center cursor-grab active:cursor-grabbing"
          >
            <div className="w-10 h-1 bg-white/30 rounded-full" />
          </div>

          <main className="flex-1 px-8 pb-12 flex flex-col landscape:flex-row items-center justify-center gap-6 landscape:gap-16">
            
            {/* Left Section: Artwork / Queue */}
            <div className="w-full max-w-[360px] landscape:max-w-none landscape:flex-1 aspect-square flex items-center justify-center relative">
              <AnimatePresence mode="wait">
                {!showQueue ? (
                  <motion.img
                    key={currentTrack.id}
                    layoutId="albumArt"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: playerState.isPlaying ? 1 : 0.95 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    src={currentTrack.coverArt}
                    className="w-full h-full object-cover rounded-2xl shadow-2xl"
                  />
                ) : (
                  <motion.div
                    key="queue"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute inset-0 bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 overflow-hidden"
                  >
                    <QueueList
                      queue={playerState.queue}
                      currentTrackId={currentTrack.id}
                      tracks={tracks}
                      onPlay={id => playTrack(id, { fromQueue: true })}
                      onRemove={onRemoveTrack}
                      onReorder={q => setPlayerState(p => ({ ...p, queue: q }))}
                      onClose={() => setShowQueue(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Section: Info & Controls */}
            <div className="w-full max-w-[400px] flex flex-col justify-center">
              <div className="mb-8 text-center landscape:text-left">
                <h1 className="text-3xl font-bold text-white truncate">{currentTrack.title}</h1>
                <p className="text-xl text-white/60 truncate">{currentTrack.artist}</p>
              </div>

              {/* Slider */}
              <div className="mb-8">
                <div className="relative h-1.5 w-full bg-white/20 rounded-full">
                  <div 
                    className="absolute h-full bg-white rounded-full" 
                    style={{ width: `${(scrubValue / safeDuration) * 100}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={safeDuration}
                    step={0.1}
                    value={scrubValue}
                    onChange={handleSeekChange}
                    onMouseDown={handlePointerDown}
                    onTouchStart={handlePointerDown}
                    onMouseUp={handleSeekPointerUp}
                    onTouchEnd={handleSeekPointerUp}
                    className="absolute inset-0 w-full h-6 -top-2 opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs font-mono text-white/40">
                  <span>{formatTime(scrubValue)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <button onClick={toggleShuffle} className={playerState.shuffle ? 'text-green-400' : 'text-white/40'}>
                  <Shuffle size={20} />
                </button>
                <div className="flex items-center gap-8">
                  <button onClick={prevTrack} className="text-white"><SkipBack size={32} fill="currentColor" /></button>
                  <button onClick={togglePlay} className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black">
                    {playerState.isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
                  </button>
                  <button onClick={nextTrack} className="text-white"><SkipForward size={32} fill="currentColor" /></button>
                </div>
                <button onClick={toggleRepeat} className={`relative ${playerState.repeat !== 'OFF' ? 'text-green-400' : 'text-white/40'}`}>
                  <Repeat size={20} />
                  {playerState.repeat === 'ONE' && <span className="absolute -top-1 -right-1 text-[8px] bg-green-400 text-black px-0.5 rounded-sm font-bold">1</span>}
                </button>
              </div>

              <button 
                onClick={() => setShowQueue(!showQueue)}
                className="mt-10 mx-auto p-3 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
              >
                {showQueue ? <ChevronDown /> : <ListMusic />}
              </button>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
  // ... (rest of your component code)

  );
};

// This line is what the error is complaining about:
export default FullPlayer;
