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
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
import { dbService } from '../db';

// Helper to format time (mm:ss)
const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  onVolumeChange,
  toggleShuffle,
  onRemoveTrack,
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [localVolume, setLocalVolume] = useState(1); // Default volume 100%

  const safeDuration = Math.max(duration, 0.01);
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);

  // --- Media Session API ---
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    // Update Metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: [{ src: currentTrack.coverArt, sizes: '512x512', type: 'image/png' }],
    });

    // Update Playback State
    if (safeDuration > 0.01) {
      navigator.mediaSession.setPositionState({
        duration: safeDuration,
        playbackRate: 1.0,
        position: Math.min(currentTime, safeDuration),
      });
    }

    // Handlers
    const actionHandlers = [
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

    actionHandlers.forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action as any, handler as any); } 
      catch (e) { console.error(`MediaSession error on ${action}:`, e); }
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try { navigator.mediaSession.setActionHandler(action as any, null); } catch (e) {}
      });
    };
  }, [currentTrack, playerState.isPlaying, safeDuration, currentTime, togglePlay, prevTrack, nextTrack, handleSeek]);

  // --- Scrubbing Sync ---
  // Only sync scrubValue with actual time if user is NOT currently dragging the slider
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
    handleSeek(scrubValue);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    setLocalVolume(vol);
    if (onVolumeChange) onVolumeChange(vol);
  };

  // --- Fetch Tracks for Queue Lookups ---
  useEffect(() => {
    if (!isPlayerOpen) return;
    let isMounted = true;
    (async () => {
      try {
        const all = await dbService.getAllTracks();
        if (isMounted) {
          const map: Record<string, Track> = {};
          all.forEach(t => (map[t.id] = t));
          setTracks(map);
        }
      } catch (error) {
        console.error("Failed to load tracks for player:", error);
      }
    })();
    return () => { isMounted = false; };
  }, [isPlayerOpen]);

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['OFF', 'ALL', 'ONE'];
    const next = modes[(modes.indexOf(playerState.repeat) + 1) % modes.length];
    setPlayerState(p => ({ ...p, repeat: next }));
    dbService.setSetting('repeat', next);
  };

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
          key="player"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={0.05}
          style={{ opacity, y: dragY }}
          onDragEnd={(_, i) => {
            if (i.offset.y > 100 || i.velocity.y > 500) onClose();
            else dragY.set(0);
          }}
          className="fixed inset-0 z-[100] bg-black flex flex-col touch-none overflow-hidden"
        >
          {/* Background Blur */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <motion.img
              key={currentTrack.coverArt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              src={currentTrack.coverArt}
              className="w-full h-full object-cover blur-[80px] scale-125 brightness-50"
              alt=""
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          </div>

          {/* Drag Handle */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="h-12 w-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20"
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors" />
          </div>

          <main className="flex-1 px-8 pb-10 flex flex-col landscape:flex-row items-center justify-center gap-8 landscape:gap-16">
            
            {/* Left: Artwork / Queue */}
            <div className="w-full max-w-[360px] landscape:max-w-[400px] aspect-square relative flex items-center justify-center">
              <AnimatePresence mode="wait">
                {!showQueue ? (
                  <motion.div
                    key="art"
                    layoutId="albumArt"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: playerState.isPlaying ? 1 : 0.95 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="relative w-full h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden"
                  >
                     <img
                      src={currentTrack.coverArt}
                      className="w-full h-full object-cover"
                      alt="Album Art"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="queue"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col"
                  >
                    {/* Assuming QueueList handles its own scrolling internally */}
                     {/* <QueueList
                      queue={playerState.queue}
                      currentTrackId={currentTrack.id}
                      tracks={tracks}
                      onPlay={id => playTrack(id, { fromQueue: true })}
                      onRemove={onRemoveTrack}
                      onReorder={q => setPlayerState(p => ({ ...p, queue: q }))}
                      onClose={() => setShowQueue(false)}
                    /> */}
                    <div className="p-4 text-center text-white/50">Queue Component Here</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Info & Controls */}
            <div className="w-full max-w-[380px] flex flex-col justify-center gap-6">
              
              {/* Text Info */}
              <div className="text-center landscape:text-left">
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight line-clamp-1" title={currentTrack.title}>
                  {currentTrack.title}
                </h1>
                <p className="text-lg text-white/60 line-clamp-1 mt-1" title={currentTrack.artist}>
                  {currentTrack.artist}
                </p>
              </div>

              {/* Progress Slider */}
              <div className="group">
                <div className="relative h-1 w-full bg-white/20 rounded-full group-hover:h-2 transition-all">
                  <div 
                    className="absolute h-full bg-white rounded-full transition-all" 
                    style={{ width: `${(scrubValue / safeDuration) * 100}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={safeDuration}
                    step={0.1}
                    value={scrubValue}
                    onChange={handleSeekChange}
                    onPointerDown={() => setIsScrubbing(true)}
                    onPointerUp={handleSeekPointerUp}
                    className="absolute inset-0 w-full h-4 -top-1 opacity-0 cursor-pointer"
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs font-medium text-white/40 font-mono">
                  <span>{formatTime(scrubValue)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-between">
                <button 
                    onClick={toggleShuffle} 
                    className={`p-2 rounded-full transition-colors ${playerState.shuffle ? 'text-green-400 bg-white/10' : 'text-white/60 hover:text-white'}`}
                    aria-label="Toggle Shuffle"
                >
                  <Shuffle size={20} />
                </button>

                <div className="flex items-center gap-6">
                  <button onClick={prevTrack} className="text-white/90 hover:text-white transition-transform active:scale-95" aria-label="Previous">
                    <SkipBack size={28} fill="currentColor" />
                  </button>
                  
                  <button 
                    onClick={togglePlay} 
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-lg hover:scale-105 active:scale-95 transition-all"
                    aria-label={playerState.isPlaying ? "Pause" : "Play"}
                  >
                    {playerState.isPlaying ? 
                      <Pause size={32} fill="currentColor" /> : 
                      <Play size={32} fill="currentColor" className="ml-1" />
                    }
                  </button>
                  
                  <button onClick={nextTrack} className="text-white/90 hover:text-white transition-transform active:scale-95" aria-label="Next">
                    <SkipForward size={28} fill="currentColor" />
                  </button>
                </div>

                <button 
                    onClick={toggleRepeat} 
                    className={`p-2 relative rounded-full transition-colors ${playerState.repeat !== 'OFF' ? 'text-green-400 bg-white/10' : 'text-white/60 hover:text-white'}`}
                    aria-label="Toggle Repeat"
                >
                  <Repeat size={20} />
                  {playerState.repeat === 'ONE' && (
                    <span className="absolute top-1 right-1.5 text-[7px] bg-green-400 text-black px-0.5 rounded-[2px] font-bold leading-none">1</span>
                  )}
                </button>
              </div>

              {/* Bottom Row: Volume & Queue Toggle */}
              <div className="flex items-center justify-between mt-4">
                 {/* Volume Control */}
                <div className="flex items-center gap-2 group w-32">
                   <button onClick={() => handleVolumeChange({ target: { value: localVolume > 0 ? 0 : 1 }} as any)} className="text-white/50 hover:text-white">
                      {localVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                   </button>
                   <div className="relative h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="absolute h-full bg-white/80" style={{ width: `${localVolume * 100}%` }} />
                      <input 
                        type="range" min={0} max={1} step={0.05} 
                        value={localVolume} 
                        onChange={handleVolumeChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                   </div>
                </div>

                <button 
                  onClick={() => setShowQueue(!showQueue)}
                  className={`p-2.5 rounded-full transition-all ${showQueue ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  aria-label="Toggle Queue"
                >
                  {showQueue ? <ChevronDown size={20} /> : <ListMusic size={20} />}
                </button>
              </div>

            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPlayer;
