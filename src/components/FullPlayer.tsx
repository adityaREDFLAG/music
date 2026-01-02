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
  X,
  GripVertical,
} from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
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
  audioRef: React.RefObject<HTMLAudioElement>;
}

const formatTime = (time: number) => {
  if (!time || isNaN(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Proper QueueList Component
const QueueList: React.FC<{
  queue: string[];
  currentTrackId: string;
  tracks: Record<string, Track>;
  onPlay: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (queue: string[]) => void;
  onClose: () => void;
}> = ({ queue, currentTrackId, tracks, onPlay, onRemove, onReorder, onClose }) => {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, trackId: string) => {
    setDraggedItem(trackId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(trackId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;

    const newQueue = [...queue];
    const draggedIndex = newQueue.indexOf(draggedItem);
    const targetIndex = newQueue.indexOf(targetId);

    newQueue.splice(draggedIndex, 1);
    newQueue.splice(targetIndex, 0, draggedItem);

    onReorder(newQueue);
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-white text-lg font-semibold">Queue ({queue.length})</h2>
        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {queue.map((trackId) => {
          const track = tracks[trackId];
          if (!track) return null;
          
          const isPlaying = trackId === currentTrackId;
          const isDragging = draggedItem === trackId;
          const isDragOver = dragOverItem === trackId;

          return (
            <div
              key={trackId}
              draggable
              onDragStart={(e) => handleDragStart(e, trackId)}
              onDragOver={(e) => handleDragOver(e, trackId)}
              onDrop={(e) => handleDrop(e, trackId)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${
                isPlaying ? 'bg-white/10' : ''
              } ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'border-t-2 border-t-white' : ''}`}
              onClick={() => onPlay(trackId)}
            >
              <div className="cursor-grab active:cursor-grabbing text-white/30">
                <GripVertical size={16} />
              </div>
              
              <img
                src={track.coverArt}
                alt={track.title}
                className="w-12 h-12 rounded object-cover"
              />
              
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isPlaying ? 'text-green-400' : 'text-white'}`}>
                  {track.title}
                </div>
                <div className="text-xs text-white/50 truncate">{track.artist}</div>
              </div>

              {isPlaying && (
                <div className="text-green-400">
                  <Play size={16} fill="currentColor" />
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(trackId);
                }}
                className="text-white/30 hover:text-red-400 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
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
  audioRef,
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const [fadeOutEnabled, setFadeOutEnabled] = useState(false);

  const safeDuration = Math.max(duration, 0.01);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodes = useRef<Map<HTMLAudioElement, MediaElementAudioSourceNode>>(new Map());
  const gainNodes = useRef<Map<HTMLAudioElement, GainNode>>(new Map());

  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 300], [1, 0]);
  const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 1000;

  const initWebAudio = (element: HTMLAudioElement) => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;

    if (!sourceNodes.current.has(element)) {
      const source = ctx.createMediaElementSource(element);
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      
      sourceNodes.current.set(element, source);
      gainNodes.current.set(element, gain);
    }
    return gainNodes.current.get(element);
  };

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      artwork: [{ src: currentTrack.coverArt, sizes: '512x512', type: 'image/png' }],
    });

    navigator.mediaSession.setActionHandler('play', () => !playerState.isPlaying && togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => playerState.isPlaying && togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') handleSeek(details.seekTime);
    });
  }, [currentTrack, playerState.isPlaying, togglePlay, prevTrack, nextTrack, handleSeek]);

  useEffect(() => {
    if ('mediaSession' in navigator && safeDuration > 0.01) {
      navigator.mediaSession.setPositionState({
        duration: safeDuration,
        playbackRate: 1.0,
        position: currentTime,
      });
    }
  }, [currentTime, safeDuration]);

  useEffect(() => {
    if (!fadeOutEnabled || !audioRef.current) return;
    
    const gain = initWebAudio(audioRef.current);
    if (!gain || !audioCtxRef.current) return;

    const FADE_TIME = 3; 
    if (duration > FADE_TIME && currentTime >= duration - FADE_TIME) {
      const now = audioCtxRef.current.currentTime;
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.001, now + FADE_TIME);
    } else {
      gain.gain.setTargetAtTime(1.0, audioCtxRef.current.currentTime, 0.1);
    }
  }, [currentTime, duration, fadeOutEnabled, audioRef]);

  useEffect(() => {
    if (!isScrubbing) setScrubValue(currentTime);
  }, [currentTime, isScrubbing]);

  useEffect(() => {
    if (!isPlayerOpen) return;
    (async () => {
      const all = await dbService.getAllTracks();
      const map: Record<string, Track> = {};
      all.forEach(t => (map[t.id] = t));
      setTracks(map);
      
      const cfSetting = await dbService.getSetting('fadeOutAtEnd');
      setFadeOutEnabled(!!cfSetting);
    })();
  }, [isPlayerOpen]);

  if (!currentTrack) return null;

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['OFF', 'ALL', 'ONE'];
    const next = modes[(modes.indexOf(playerState.repeat) + 1) % modes.length];
    setPlayerState(p => ({ ...p, repeat: next }));
    dbService.setSetting('repeat', next);
  };

  const handlePointerDown = () => {
    setIsScrubbing(true);
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setScrubValue(value);
    if (isScrubbing) {
      handleSeek(value);
    }
  };

  const handleSeekPointerUp = () => {
    setIsScrubbing(false);
  };

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
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={0.2}
          style={{ opacity, y: dragY }}
          onDragEnd={(_, i) => {
            if (i.offset.y > 150 || i.velocity.y > 500) onClose();
            else dragY.set(0);
          }}
          className="fixed inset-0 z-[100] bg-black flex flex-col touch-none overflow-hidden"
        >
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <motion.div
              key={currentTrack.coverArt}
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 0.4, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <img
                src={currentTrack.coverArt}
                alt=""
                className="w-full h-full object-cover blur-[80px] scale-125"
              />
            </motion.div>
            <div className="absolute inset-0 bg-black/60" />
          </div>

          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="h-12 flex items-center justify-center cursor-grab active:cursor-grabbing flex-shrink-0"
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mt-2" />
          </div>

          <main className="flex-1 px-6 pb-8 flex flex-col landscape:flex-row landscape:items-center landscape:justify-center landscape:gap-12 min-h-0">
            
            <div className="flex-1 flex flex-col min-h-0 landscape:h-full landscape:justify-center landscape:w-1/2 landscape:max-w-lg">
              <AnimatePresence mode="wait">
                {!showQueue ? (
                  <motion.div
                    key={currentTrack.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: 1, 
                      scale: playerState.isPlaying ? 1 : 0.94,
                    }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex-1 flex items-center justify-center p-4"
                  >
                    <motion.img
                      layoutId="albumArt"
                      src={currentTrack.coverArt}
                      className="w-full max-w-[320px] aspect-square rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] object-cover landscape:max-h-[60vh] landscape:max-w-none"
                      alt={currentTrack.title}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="queue-view"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 40 }}
                    className="flex-1 flex flex-col bg-white/5 rounded-3xl backdrop-blur-xl overflow-hidden border border-white/10"
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

            <div className="flex flex-col landscape:w-1/2 landscape:max-w-md pt-6">
              {!showQueue && (
                <motion.div 
                    key={currentTrack.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-4 landscape:text-left text-center"
                >
                  <h1 className="text-2xl font-bold text-white truncate landscape:text-4xl">
                    {currentTrack.title}
                  </h1>
                  <p className="text-white/50 truncate text-lg landscape:text-xl">
                    {currentTrack.artist}
                  </p>
                </motion.div>
              )}

              {/* Progress Slider - FIXED */}
              <div className="mt-4">
                <div className="relative h-1.5 bg-white/10 rounded-full group">
                  <motion.div 
                    className="absolute h-full bg-white rounded-full pointer-events-none"
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
                    className="absolute inset-0 opacity-0 w-full h-8 -top-3 cursor-pointer"
                    style={{ touchAction: 'none' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-white/40 mt-3 font-mono">
                  <span>{formatTime(scrubValue)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Fade Control - Volume slider REMOVED */}
              <div className="mt-6 flex items-center justify-center px-2">
                <button 
                  onClick={() => {
                    const next = !fadeOutEnabled;
                    setFadeOutEnabled(next);
                    dbService.setSetting('fadeOutAtEnd', next);
                  }}
                  className={`text-[10px] px-3 py-1.5 rounded border transition-colors ${fadeOutEnabled ? 'bg-white text-black border-white' : 'text-white/40 border-white/20'}`}
                >
                  FADE OUT {fadeOutEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-between mt-8">
                <motion.button whileTap={{ scale: 0.8 }} onClick={toggleShuffle} className="p-2">
                  <Shuffle size={20} className={playerState.shuffle ? 'text-green-400' : 'text-white/30'} />
                </motion.button>

                <div className="flex items-center gap-6">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={prevTrack} className="text-white">
                    <SkipBack size={32} fill="currentColor" />
                  </motion.button>
                  
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={togglePlay} 
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl"
                  >
                    {playerState.isPlaying ? 
                        <Pause fill="black" size={28} className="text-black" /> : 
                        <Play fill="black" size={28} className="ml-1 text-black" />
                    }
                  </motion.button>

                  <motion.button whileTap={{ scale: 0.9 }} onClick={nextTrack} className="text-white">
                    <SkipForward size={32} fill="currentColor" />
                  </motion.button>
                </div>

                <motion.button whileTap={{ scale: 0.8 }} onClick={toggleRepeat} className="p-2 relative">
                  <Repeat size={20} className={playerState.repeat !== 'OFF' ? 'text-green-400' : 'text-white/30'} />
                  {playerState.repeat === 'ONE' && (
                    <span className="absolute top-1 right-1 text-[8px] bg-green-400 text-black font-bold px-0.5 rounded-sm">1</span>
                  )}
                </motion.button>
              </div>

              <div className="flex justify-center mt-6">
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowQueue(!showQueue)}
                  className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
                >
                  {showQueue ? <ChevronDown /> : <ListMusic />}
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
