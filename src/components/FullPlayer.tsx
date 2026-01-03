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
  Mic2,
} from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
import { dbService } from '../db';
import QueueList from './QueueList';
import LyricsView from './LyricsView';

// Helper to format time (mm:ss)
const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// --- PROPS INTERFACE ---
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
  handleSeek: (time: number) => void;
  onVolumeChange?: (volume: number) => void; // Kept in interface to prevent parent errors, but unused in UI
  toggleShuffle: () => void;
  onRemoveTrack?: (id: string) => void;
}

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
  const [showLyrics, setShowLyrics] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const scrubValueRef = React.useRef(scrubValue);

  // Use a timeout to prevent jumping back after seek
  const ignoreTimeUpdateRef = React.useRef(false);

  // Keep ref in sync for global listeners
  useEffect(() => {
    scrubValueRef.current = scrubValue;
  }, [scrubValue]);

  const safeDuration = Math.max(duration, 0.01);
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);

  // --- Media Session API (iOS Control Center) ---
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        artwork: [
          { src: currentTrack.coverArt, sizes: '96x96', type: 'image/png' },
          { src: currentTrack.coverArt, sizes: '128x128', type: 'image/png' },
          { src: currentTrack.coverArt, sizes: '192x192', type: 'image/png' },
          { src: currentTrack.coverArt, sizes: '256x256', type: 'image/png' },
          { src: currentTrack.coverArt, sizes: '512x512', type: 'image/png' },
        ],
      });

      // Update Playback State
      if (safeDuration > 0.01 && !isNaN(currentTime)) {
        navigator.mediaSession.setPositionState({
          duration: safeDuration,
          playbackRate: 1.0,
          position: Math.min(Math.max(0, currentTime), safeDuration),
        });
      }
    } catch (e) {
      console.warn("Media Session update failed", e);
    }

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
      catch (e) { /* Ignore unsupported actions */ }
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try { navigator.mediaSession.setActionHandler(action as any, null); } catch (e) {}
      });
    };
  }, [currentTrack, playerState.isPlaying, safeDuration, currentTime, togglePlay, prevTrack, nextTrack, handleSeek]);

  // --- Scrubbing Sync ---
  useEffect(() => {
    if (!isScrubbing && !ignoreTimeUpdateRef.current) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setScrubValue(value);
    scrubValueRef.current = value;
  };

  // Fixed: Handles both Mouse and Touch end events
  const handleSeekCommit = React.useCallback(() => {
    const seekTime = scrubValueRef.current;

    // 1. Perform Seek
    handleSeek(seekTime);

    // 2. Temporarily ignore updates to prevent jumping back
    ignoreTimeUpdateRef.current = true;
    setTimeout(() => {
        ignoreTimeUpdateRef.current = false;
    }, 500); // 500ms should be enough for the audio engine to catch up

    setIsScrubbing(false);
  }, [handleSeek]);

  // Global pointer up to catch drags ending outside the input
  useEffect(() => {
    if (isScrubbing) {
      const onEnd = () => handleSeekCommit();
      window.addEventListener('pointerup', onEnd, { once: true });
      return () => {
        window.removeEventListener('pointerup', onEnd);
      };
    }
  }, [isScrubbing, handleSeekCommit]);

  // --- Fetch Tracks ---
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
        console.error("Failed to load tracks:", error);
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

  const handleReorder = (newQueue: string[]) => {
    setPlayerState(prev => ({ ...prev, queue: newQueue }));
  };

  const handleQueuePlayNext = (trackId: string) => {
    setPlayerState(prev => {
      // Logic: remove track from current pos (if in future) and insert after current
      const q = [...prev.queue];
      const currentIdx = q.indexOf(prev.currentTrackId || '');
      // If track is already in queue, we might want to move it?
      // Simple approach: insert after current. Duplicates handled by unique keys in QueueList if we allow them.
      // But typically we remove the old instance if it's "move to play next"

      const existingIdx = q.indexOf(trackId);
      if (existingIdx !== -1) {
        q.splice(existingIdx, 1);
      }

      // Re-find current index as it might have shifted
      let newCurrentIdx = q.indexOf(prev.currentTrackId || '');
      if (newCurrentIdx === -1) newCurrentIdx = 0;

      q.splice(newCurrentIdx + 1, 0, trackId);

      return { ...prev, queue: q };
    });
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
          dragListener={false} // Only drag via handle
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

          {/* Drag Handle - This starts the modal drag */}
          <div 
            onPointerDown={(e) => dragControls.start(e)}
            className="h-12 w-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20"
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors" />
          </div>

          <main className="flex-1 px-8 pb-10 flex flex-col landscape:flex-row items-center justify-center gap-8 landscape:gap-16">
            
            {/* Left: Artwork */}
            <div className="w-full max-w-[360px] landscape:max-w-[400px] aspect-square relative flex items-center justify-center">
              <AnimatePresence mode="wait">
                {showLyrics ? (
                  <motion.div
                     key="lyrics"
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     className="absolute inset-0 rounded-2xl overflow-hidden"
                  >
                     <LyricsView
                       track={currentTrack}
                       currentTime={currentTime}
                       onSeek={handleSeek}
                       onClose={() => setShowLyrics(false)}
                     />
                  </motion.div>
                ) : showQueue ? (
                  <motion.div
                    key="queue"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col"
                  >
                    <QueueList
                      queue={playerState.queue}
                      currentTrackId={playerState.currentTrackId}
                      tracks={tracks}
                      onReorder={handleReorder}
                      onPlay={(id) => playTrack(id, { fromQueue: true })}
                      onRemove={onRemoveTrack || (() => {})}
                      onPlayNext={handleQueuePlayNext}
                      onClose={() => setShowQueue(false)}
                    />
                  </motion.div>
                ) : (
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

              {/* Progress Slider (FIXED FOR IOS) */}
              <div className="group relative pt-4 pb-2">
                <div className="relative h-1 w-full bg-white/20 rounded-full group-hover:h-2 transition-all">
                  <div 
                    className="absolute h-full bg-white rounded-full transition-all" 
                    style={{ width: `${(scrubValue / safeDuration) * 100}%` }}
                  />
                  {/* The Input - Improved z-index and event handling */}
                  <input
                    type="range"
                    min={0}
                    max={safeDuration}
                    step={0.1}
                    value={scrubValue}
                    onChange={handleSeekChange}
                    // CRITICAL: Stop propagation so we don't drag the modal
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setIsScrubbing(true);
                    }}
                    onPointerUp={handleSeekCommit}
                    className="absolute inset-0 w-full h-6 -top-2.5 opacity-0 cursor-pointer z-50"
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
                >
                  <Shuffle size={20} />
                </button>

                <div className="flex items-center gap-6">
                  <button onClick={prevTrack} className="text-white/90 hover:text-white active:scale-95 transition-transform">
                    <SkipBack size={28} fill="currentColor" />
                  </button>
                  
                  <button 
                    onClick={togglePlay} 
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    {playerState.isPlaying ? 
                      <Pause size={32} fill="currentColor" /> : 
                      <Play size={32} fill="currentColor" className="ml-1" />
                    }
                  </button>
                  
                  <button onClick={nextTrack} className="text-white/90 hover:text-white active:scale-95 transition-transform">
                    <SkipForward size={28} fill="currentColor" />
                  </button>
                </div>

                <button 
                    onClick={toggleRepeat} 
                    className={`p-2 relative rounded-full transition-colors ${playerState.repeat !== 'OFF' ? 'text-green-400 bg-white/10' : 'text-white/60 hover:text-white'}`}
                >
                  <Repeat size={20} />
                  {playerState.repeat === 'ONE' && (
                    <span className="absolute top-1 right-1.5 text-[7px] bg-green-400 text-black px-0.5 rounded-[2px] font-bold leading-none">1</span>
                  )}
                </button>
              </div>

              {/* Bottom Row (Queue & Lyrics) */}
              <div className="flex items-center justify-between mt-4 px-1">
                <button
                  onClick={() => {
                    setShowLyrics(!showLyrics);
                    if (!showLyrics) setShowQueue(false);
                  }}
                  className={`p-2.5 rounded-full transition-all ${showLyrics ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  <Mic2 size={20} />
                </button>

                <button 
                  onClick={() => {
                    setShowQueue(!showQueue);
                    if (!showQueue) setShowLyrics(false);
                  }}
                  className={`p-2.5 rounded-full transition-all ${showQueue ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}
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
