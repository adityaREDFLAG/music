import React, { useState, useEffect, useRef } from 'react';
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
  handleSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  toggleShuffle: () => void;
  onRemoveTrack: (trackId: string) => void;
  themeColor?: string;
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
  onVolumeChange,
  toggleShuffle,
  onRemoveTrack,
  themeColor,
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});

  // -- Seek State --
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const scrubValueRef = useRef(0);

  // -- Volume State --
  const [isVolumeScrubbing, setIsVolumeScrubbing] = useState(false);
  const [localVolume, setLocalVolume] = useState(playerState.volume);
  const localVolumeRef = useRef(playerState.volume);

  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);

  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  // Reset drag position when opened
  useEffect(() => {
    if (isPlayerOpen) dragY.set(0);
  }, [isPlayerOpen, dragY]);

  // Sync seek state
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
      scrubValueRef.current = currentTime;
    }
  }, [currentTime, isScrubbing]);

  // Sync volume state
  useEffect(() => {
    if (!isVolumeScrubbing) {
      setLocalVolume(playerState.volume);
      localVolumeRef.current = playerState.volume;
    }
  }, [playerState.volume, isVolumeScrubbing]);

  // Fetch Tracks for Queue
  useEffect(() => {
    if (!isPlayerOpen) return;
    const fetchTracks = async () => {
      const all = await dbService.getAllTracks();
      const map: Record<string, Track> = {};
      all.forEach((t) => (map[t.id] = t));
      setTracks(map);
    };
    fetchTracks();
  }, [isPlayerOpen]);

  if (!currentTrack) return null;

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['OFF', 'ALL', 'ONE'];
    const next = modes[(modes.indexOf(playerState.repeat) + 1) % modes.length];
    setPlayerState((p) => ({ ...p, repeat: next }));
    dbService.setSetting('repeat', next);
  };

  // --- HANDLERS ---
  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setScrubValue(val);
    scrubValueRef.current = val;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setLocalVolume(val);
    localVolumeRef.current = val;
    onVolumeChange(val); // Real-time feedback
  };

  // Global Pointer Up Logic
  useEffect(() => {
    if (!isScrubbing && !isVolumeScrubbing) return;

    const onGlobalPointerUp = () => {
      if (isScrubbing) {
        handleSeek(scrubValueRef.current);
        setTimeout(() => setIsScrubbing(false), 50);
      }
      if (isVolumeScrubbing) {
        setIsVolumeScrubbing(false);
      }
    };

    window.addEventListener('pointerup', onGlobalPointerUp);
    return () => window.removeEventListener('pointerup', onGlobalPointerUp);
  }, [isScrubbing, isVolumeScrubbing, handleSeek]);

  const maxDuration = Math.max(duration, 0.01);
  const sliderValue = isScrubbing ? scrubValue : currentTime;
  const progressPercent = (sliderValue / maxDuration) * 100;
  const displayVolume = isVolumeScrubbing ? localVolume : playerState.volume;

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
          key="player"
          initial={{ y: windowHeight }}
          animate={{ y: 0 }}
          exit={{ y: windowHeight }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          drag="y"
          dragControls={dragControls}
          dragConstraints={{ top: 0 }}
          dragElastic={0.1}
          style={{ opacity }}
          onDrag={(_, i) => dragY.set(i.offset.y)}
          onDragEnd={(_, i) => {
            if (i.offset.y > 150) onClose();
            else dragY.set(0);
          }}
          className="fixed inset-0 z-[600] bg-black flex flex-col touch-none"
        >
          {/* Background Layer */}
          <div className="absolute inset-0 -z-10 overflow-hidden bg-zinc-900">
            <AnimatePresence>
              {currentTrack.coverArt && (
                <motion.img
                  key={currentTrack.coverArt}
                  src={currentTrack.coverArt}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8 }}
                  className="w-full h-full object-cover blur-[100px] scale-125"
                />
              )}
            </AnimatePresence>
            <div className="absolute inset-0 bg-black/40" />
          </div>

          {/* Drag Handle Area */}
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="h-14 flex items-center justify-center cursor-grab active:cursor-grabbing flex-shrink-0"
          >
            <div className="w-12 h-1.5 bg-white/30 rounded-full" />
          </div>

          <main className="flex-1 px-6 pb-10 flex flex-col landscape:flex-row landscape:items-center landscape:justify-center landscape:gap-12 landscape:px-12 relative z-10 w-full overflow-hidden">
            {/* LEFT SIDE: Artwork or Queue */}
            <div className="flex-1 flex flex-col justify-center landscape:max-w-lg relative h-full">
              <AnimatePresence mode="wait">
                {!showQueue ? (
                  <motion.div
                    key="art-view"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex-1 flex items-center justify-center py-4"
                  >
                    <img
                      src={currentTrack.coverArt}
                      alt={currentTrack.title}
                      className="w-full max-w-[80vw] aspect-square rounded-3xl shadow-2xl object-cover landscape:max-w-full"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="queue-view"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex-1 flex flex-col bg-white/5 rounded-3xl p-4 backdrop-blur-xl h-full max-h-[60vh] landscape:max-h-[80vh] overflow-hidden"
                  >
                    <QueueList
                      queue={playerState.queue}
                      currentTrackId={currentTrack.id}
                      tracks={tracks}
                      onPlay={(id) => playTrack(id, { fromQueue: true })}
                      onRemove={onRemoveTrack}
                      onPlayNext={(id) => playTrack(id, { immediate: false })}
                      onReorder={(q) => setPlayerState((p) => ({ ...p, queue: q }))}
                      onClose={() => setShowQueue(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* RIGHT SIDE: Information & Controls */}
            <div className="flex flex-col landscape:flex-1 landscape:max-w-md">
              {!showQueue && (
                <div className="text-center mt-4 landscape:text-left">
                  <h1 className="text-2xl font-bold text-white truncate landscape:text-4xl">
                    {currentTrack.title}
                  </h1>
                  <p className="text-white/50 truncate text-lg landscape:text-xl">
                    {currentTrack.artist}
                  </p>
                </div>
              )}

              {/* Progress Slider */}
              <div className="mt-8" onPointerDown={(e) => e.stopPropagation()}>
                <div className="relative h-1.5 bg-white/10 rounded-full group">
                  <div
                    className="absolute h-full bg-white rounded-full transition-all duration-75"
                    style={{ width: `${progressPercent}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={maxDuration}
                    step={0.1}
                    value={sliderValue}
                    onPointerDown={() => setIsScrubbing(true)}
                    onChange={handleScrubChange}
                    className="absolute inset-0 opacity-0 w-full h-6 -top-2 cursor-pointer touch-none"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-white/40 mt-2 font-mono">
                  <span>{formatTime(sliderValue)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Volume */}
              <div className="mt-6 flex items-center gap-4" onPointerDown={(e) => e.stopPropagation()}>
                <button onClick={() => onVolumeChange(displayVolume === 0 ? 0.5 : 0)} className="text-white/50">
                  {displayVolume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <div className="flex-1 relative h-1 bg-white/10 rounded-full">
                  <div className="absolute h-full bg-white/60 rounded-full" style={{ width: `${displayVolume * 100}%` }} />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={displayVolume}
                    onPointerDown={() => setIsVolumeScrubbing(true)}
                    onChange={handleVolumeChange}
                    className="absolute inset-0 w-full h-4 -top-1.5 opacity-0 cursor-pointer touch-none"
                  />
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-between mt-8">
                <button onClick={toggleShuffle} className="p-2">
                  <Shuffle size={20} className={playerState.shuffle ? 'text-green-400' : 'text-white/40'} />
                </button>

                <div className="flex items-center gap-8">
                  <button onClick={prevTrack}><SkipBack size={32} fill="white" /></button>
                  <button
                    onClick={togglePlay}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-black"
                  >
                    {playerState.isPlaying ? <Pause fill="black" size={28} /> : <Play fill="black" size={28} className="ml-1" />}
                  </button>
                  <button onClick={nextTrack}><SkipForward size={32} fill="white" /></button>
                </div>

                <button onClick={toggleRepeat} className="p-2 relative">
                  <Repeat size={20} className={playerState.repeat !== 'OFF' ? 'text-green-400' : 'text-white/40'} />
                  {playerState.repeat === 'ONE' && (
                    <span className="absolute top-1 right-0 text-[8px] bg-green-400 text-black rounded-full w-3 h-3 flex items-center justify-center font-bold">1</span>
                  )}
                </button>
              </div>

              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setShowQueue(!showQueue)}
                  className="bg-white/10 p-3 rounded-full"
                >
                  {showQueue ? <ChevronDown /> : <ListMusic />}
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
