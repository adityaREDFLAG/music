import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useDragControls,
  useSpring,
  PanInfo
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
  MoreHorizontal
} from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
import { dbService } from '../db';
import QueueList from './QueueList';
import LyricsView from './LyricsView';
import { ThemePalette } from '../utils/colors';
import { AudioAnalysis } from '../hooks/useAudioAnalyzer';

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
  startScrub?: () => void;
  scrub?: (time: number) => void;
  endScrub?: () => void;
  onVolumeChange?: (volume: number) => void;
  toggleShuffle: () => void;
  onRemoveTrack?: (id: string) => void;
  onTrackUpdate?: (track: Track) => void;
  theme: ThemePalette | null;
  themeColor?: string;
  analyzerData?: AudioAnalysis; // Accept data from prop
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
  startScrub,
  scrub,
  endScrub,
  toggleShuffle,
  onRemoveTrack,
  onTrackUpdate,
  theme,
  analyzerData
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});

  // Local state for the slider to ensure immediate feedback
  const [localScrubValue, setLocalScrubValue] = useState<number | null>(null);
  const isScrubbing = localScrubValue !== null;

  // Use props directly
  const { beat } = analyzerData || { beat: false };

  // Memoize color values
  const colors = useMemo(() => ({
    primary: theme?.primary || '#ffffff',
    secondary: theme?.secondary || '#a1a1aa',
    muted: theme?.muted || '#71717a',
    background: theme?.background || '#09090b',
    surface: '#18181b', // Standard surface
    surfaceVariant: '#27272a'
  }), [theme]);

  // Beat Animations
  const beatScale = useSpring(1, { stiffness: 300, damping: 10 });
  const glowOpacity = useSpring(0, { stiffness: 200, damping: 20 });

  useEffect(() => {
      if (beat && isPlayerOpen) {
          beatScale.set(1.02); // Subtle Pop
          glowOpacity.set(0.4); // Subtle Flash
          setTimeout(() => {
              beatScale.set(1);
              glowOpacity.set(0);
          }, 100);
      }
  }, [beat, beatScale, glowOpacity, isPlayerOpen]);

  const safeDuration = Math.max(duration, 0.01);
  const isSeekable = duration > 0 && !isNaN(duration);
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);
  const scale = useTransform(dragY, [0, 200], [1, 0.95]);
  const borderRadius = useTransform(dragY, [0, 200], [0, 48]); // Animate corner radius on drag

  // Display value: Use local value while scrubbing, otherwise global currentTime
  const displayValue = isScrubbing ? localScrubValue : currentTime;

  // --- SCRUBBING HANDLERS ---
  const handleScrubStart = () => {
      if (startScrub) startScrub();
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isSeekable) return;
      const value = Number(e.target.value);
      setLocalScrubValue(value);
  };

  const handleScrubEnd = () => {
      if (localScrubValue !== null) {
          handleSeek(localScrubValue);
      }
      setLocalScrubValue(null);
      if (endScrub) endScrub();
  };

  const handleScrubInteractionStart = (e: React.PointerEvent<HTMLInputElement>) => {
      // Prevent drag propagation to sheet
      e.stopPropagation();
      handleScrubStart();

      const onPointerUp = () => {
          handleScrubEnd();
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
      };
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
  };

  // Load tracks for Queue
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

  const toggleRepeat = useCallback(() => {
    const modes: RepeatMode[] = ['OFF', 'ALL', 'ONE'];
    const next = modes[(modes.indexOf(playerState.repeat) + 1) % modes.length];
    setPlayerState(p => ({ ...p, repeat: next }));
    dbService.setSetting('repeat', next);
  }, [playerState.repeat, setPlayerState]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 150 || info.velocity.y > 300) {
      onClose();
    } else {
      dragY.set(0);
    }
  };

  // Prevent background scroll when open
  useEffect(() => {
      if (isPlayerOpen) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = '';
      }
      return () => { document.body.style.overflow = ''; };
  }, [isPlayerOpen]);

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
          key="player-modal"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              mass: 0.8
          }}
          drag="y"
          dragControls={dragControls}
          dragListener={false} // Only drag via handle or specific areas if needed
          dragConstraints={{ top: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          style={{
              y: dragY,
              opacity,
              scale,
              borderTopLeftRadius: borderRadius,
              borderTopRightRadius: borderRadius
          }}
          className="fixed inset-0 z-[600] flex flex-col bg-background touch-none overflow-hidden"
        >
          {/* Dynamic Ambient Background */}
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
             <motion.div
               animate={{ background: `linear-gradient(to bottom, ${colors.primary}30, ${colors.background})` }}
               transition={{ duration: 1 }}
               className="absolute inset-0"
             />
             <motion.img
              key={currentTrack.coverArt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ duration: 1.5 }}
              src={currentTrack.coverArt}
              className="w-full h-full object-cover blur-[120px] scale-150 opacity-30"
              alt=""
            />
            <div className="absolute inset-0 bg-black/20" />
            {/* Grain */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }}
            />
          </div>

          {/* Header / Drag Handle */}
          <div 
             className="flex-none h-14 w-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20"
             onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="w-16 h-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors" />
          </div>

          {/* Main Content */}
          <main className="flex-1 flex flex-col landscape:flex-row items-center justify-center px-6 pb-safe pt-2 gap-8 landscape:gap-16 max-w-7xl mx-auto w-full">
            
            {/* --- LEFT: ARTWORK / QUEUE / LYRICS --- */}
            <div className="w-full max-w-[380px] landscape:max-w-[420px] aspect-square relative flex-shrink-0">
               <AnimatePresence mode="wait">
                 {showLyrics ? (
                   <motion.div
                      key="lyrics"
                      initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 rounded-[32px] overflow-hidden bg-black/20 backdrop-blur-md border border-white/5"
                   >
                      <LyricsView
                        track={currentTrack}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                        onClose={() => setShowLyrics(false)}
                        onTrackUpdate={onTrackUpdate}
                      />
                   </motion.div>
                 ) : showQueue ? (
                    <motion.div
                      key="queue"
                      initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 rounded-[32px] overflow-hidden bg-black/20 backdrop-blur-md border border-white/5 flex flex-col"
                    >
                      <QueueList
                        queue={playerState.queue}
                        currentTrackId={playerState.currentTrackId}
                        tracks={tracks}
                        onReorder={(q) => setPlayerState(p => ({ ...p, queue: q }))}
                        onPlay={(id) => playTrack(id, { fromQueue: true })}
                        onRemove={onRemoveTrack || (() => {})}
                        onPlayNext={(id) => { /* logic */ }}
                        onClose={() => setShowQueue(false)}
                      />
                    </motion.div>
                 ) : (
                   <motion.div
                     key="art"
                     layoutId={`artwork-${currentTrack.id}`} // Shared element match
                     className="relative w-full h-full rounded-[32px] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
                     style={{ scale: playerState.isPlaying ? beatScale : 1 }}
                   >
                     <img
                       src={currentTrack.coverArt}
                       className="w-full h-full object-cover"
                       alt="Album Art"
                     />
                     {/* Beat Flash */}
                     <motion.div
                         style={{ opacity: glowOpacity, background: colors.primary }}
                         className="absolute inset-0 mix-blend-overlay pointer-events-none"
                     />
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>

            {/* --- RIGHT: INFO & CONTROLS --- */}
            <div className="w-full max-w-[380px] flex flex-col gap-8 justify-center">

               {/* Track Info */}
               <div className="flex flex-col gap-1 items-start">
                  <motion.h1
                    layoutId={`title-${currentTrack.id}`}
                    className="text-3xl font-bold leading-tight text-white line-clamp-2 text-left"
                  >
                    {currentTrack.title}
                  </motion.h1>
                  <motion.button
                    layoutId={`artist-${currentTrack.id}`}
                    className="text-xl text-zinc-400 font-medium hover:text-white transition-colors text-left"
                  >
                    {currentTrack.artist}
                  </motion.button>
               </div>

               {/* Seek Slider */}
               <div className="group relative w-full touch-none select-none py-2">
                  {/* Track Background */}
                  <div className="relative h-2 w-full bg-white/10 rounded-full overflow-hidden">
                     {/* Progress Fill */}
                     <motion.div
                        className="absolute top-0 left-0 h-full bg-white rounded-full"
                        style={{ width: `${(displayValue / safeDuration) * 100}%` }}
                     />
                     {/* Beat Pulse */}
                     {playerState.isPlaying && (
                         <motion.div
                            animate={{ opacity: beat ? 0.6 : 0 }}
                            className="absolute inset-0 bg-white mix-blend-overlay"
                         />
                     )}
                  </div>

                  {/* Interaction Input */}
                  <input
                    type="range"
                    min={0}
                    max={safeDuration}
                    step={0.1}
                    value={displayValue}
                    disabled={!isSeekable}
                    onChange={handleScrubChange}
                    onPointerDown={(e) => isSeekable && handleScrubInteractionStart(e)}
                    className="absolute inset-0 w-full h-6 opacity-0 cursor-pointer -top-2"
                  />

                  {/* Time Labels */}
                  <div className="flex justify-between mt-2 text-xs font-medium text-zinc-500 font-mono tracking-wide">
                    <span>{formatTime(displayValue)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
               </div>

               {/* Playback Controls */}
               <div className="flex items-center justify-between -mx-2">
                  <motion.button
                     whileTap={{ scale: 0.9 }}
                     onClick={toggleShuffle}
                     className={`p-3 rounded-full transition-colors ${playerState.shuffle ? 'bg-primary/20 text-primary' : 'text-zinc-500 hover:bg-white/5'}`}
                  >
                    <Shuffle size={22} />
                  </motion.button>

                  <div className="flex items-center gap-6">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={prevTrack}
                      className="text-zinc-200 hover:text-white p-2"
                    >
                      <SkipBack size={36} fill="currentColor" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={togglePlay}
                      animate={{ scale: beat ? 1.05 : 1 }}
                      className="w-20 h-20 rounded-[28px] bg-white text-black flex items-center justify-center shadow-lg shadow-white/10 hover:shadow-white/20 transition-all"
                    >
                      {playerState.isPlaying ?
                        <Pause size={32} fill="currentColor" /> :
                        <Play size={32} fill="currentColor" className="ml-1" />
                      }
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={nextTrack}
                      className="text-zinc-200 hover:text-white p-2"
                    >
                      <SkipForward size={36} fill="currentColor" />
                    </motion.button>
                  </div>

                  <motion.button
                     whileTap={{ scale: 0.9 }}
                     onClick={toggleRepeat}
                     className={`p-3 rounded-full transition-colors relative ${playerState.repeat !== 'OFF' ? 'bg-primary/20 text-primary' : 'text-zinc-500 hover:bg-white/5'}`}
                  >
                    <Repeat size={22} />
                    {playerState.repeat === 'ONE' && (
                        <span className="absolute top-1.5 right-2 text-[8px] font-black">1</span>
                    )}
                  </motion.button>
               </div>

               {/* Bottom Actions (Queue / Lyrics) */}
               <div className="flex items-center justify-center gap-4 mt-2">
                  <div className="h-14 bg-white/5 rounded-full p-1 flex items-center backdrop-blur-md border border-white/5">
                    <button
                       onClick={() => { setShowLyrics(true); setShowQueue(false); }}
                       className={`h-full px-6 rounded-full flex items-center justify-center gap-2 transition-all font-medium text-sm ${showLyrics ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <Mic2 size={18} />
                      Lyrics
                    </button>
                    <div className="w-px h-6 bg-white/10 mx-1" />
                    <button
                       onClick={() => { setShowQueue(true); setShowLyrics(false); }}
                       className={`h-full px-6 rounded-full flex items-center justify-center gap-2 transition-all font-medium text-sm ${showQueue ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <ListMusic size={18} />
                      Queue
                    </button>
                  </div>

                  {/* Close Button (if showing overlay) */}
                  <AnimatePresence>
                     {(showLyrics || showQueue) && (
                       <motion.button
                         initial={{ scale: 0, opacity: 0 }}
                         animate={{ scale: 1, opacity: 1 }}
                         exit={{ scale: 0, opacity: 0 }}
                         onClick={() => { setShowLyrics(false); setShowQueue(false); }}
                         className="h-14 w-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/5"
                       >
                         <ChevronDown size={24} />
                       </motion.button>
                     )}
                  </AnimatePresence>
               </div>
            </div>

          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPlayer;
