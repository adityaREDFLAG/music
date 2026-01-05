import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useDragControls,
  useSpring,
  PanInfo,
  Variants
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
  Mic2
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
  toggleShuffle: () => void;
  onRemoveTrack?: (id: string) => void;
  onTrackUpdate?: (track: Track) => void;
  theme: ThemePalette | null;
  analyzerData?: AudioAnalysis;
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

  // --- SEEKING STATE ---
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  // Sync scrub value with currentTime when NOT scrubbing
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  const { beat } = analyzerData || { beat: false };

  // Memoize color values
  const colors = useMemo(() => ({
    primary: theme?.primary || '#ffffff',
    background: theme?.background || '#09090b',
  }), [theme]);

  // --- ANIMATION CONTROLS ---
  const beatScale = useSpring(1, { stiffness: 300, damping: 10 });
  const glowOpacity = useSpring(0, { stiffness: 200, damping: 20 });
  
  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);
  const scale = useTransform(dragY, [0, 200], [1, 0.9]);
  const borderRadius = useTransform(dragY, [0, 100], [0, 32]);

  // Animation Variants for staggering content
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    },
    exit: { opacity: 0 }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 20 } }
  };

  useEffect(() => {
      if (beat && isPlayerOpen && playerState.isPlaying) {
          beatScale.set(1.02);
          glowOpacity.set(0.4);
          setTimeout(() => {
              beatScale.set(1);
              glowOpacity.set(0);
          }, 100);
      }
  }, [beat, beatScale, glowOpacity, isPlayerOpen, playerState.isPlaying]);

  const safeDuration = Math.max(duration, 1); // Prevent div/0

  // --- IMPROVED SEEK HANDLERS ---
  const onSeekStart = () => {
    setIsScrubbing(true);
    if (startScrub) startScrub();
  };

  const onSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseFloat(e.target.value);
    setScrubValue(newVal);
  };

  const onSeekEnd = useCallback(() => {
    handleSeek(scrubValue);
    setIsScrubbing(false);
    if (endScrub) endScrub();
  }, [handleSeek, scrubValue, endScrub]);

  // Global pointer up listener to ensure seek ends even if released outside the input
  useEffect(() => {
    if (isScrubbing) {
      const handleGlobalUp = () => {
        onSeekEnd();
      };
      window.addEventListener('pointerup', handleGlobalUp);
      window.addEventListener('pointercancel', handleGlobalUp);
      return () => {
        window.removeEventListener('pointerup', handleGlobalUp);
        window.removeEventListener('pointercancel', handleGlobalUp);
      };
    }
  }, [isScrubbing, onSeekEnd]);

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
        console.error("Failed to load tracks", error);
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

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 150 || info.velocity.y > 300) {
      onClose();
    } else {
      dragY.set(0); // Snap back
    }
  };

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
          key="player-modal"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          style={{ 
              y: dragY, 
              opacity, 
              scale,
              borderTopLeftRadius: borderRadius,
              borderTopRightRadius: borderRadius
          }}
          drag="y"
          dragControls={dragControls}
          dragListener={false} // Only drag header
          dragConstraints={{ top: 0 }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          className="fixed inset-0 z-[600] flex flex-col touch-none overflow-hidden"
          style={{ backgroundColor: colors.background }} // Dynamic background color
        >
          {/* --- AMBIENT BACKGROUND --- */}
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
             <motion.div
               animate={{ background: `linear-gradient(to bottom, ${colors.primary}15, ${colors.background}E6)` }}
               transition={{ duration: 1.5 }}
               className="absolute inset-0"
             />
             <motion.img
              key={currentTrack.coverArt}
              initial={{ opacity: 0, scale: 1.2 }}
              animate={{ opacity: 0.4, scale: 1.5 }}
              transition={{ duration: 2 }}
              src={currentTrack.coverArt}
              className="w-full h-full object-cover blur-[100px] opacity-30"
              alt=""
            />
            {/* Noise Grain */}
            <div className="absolute inset-0 opacity-[0.05]"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }}
            />
          </div>

          {/* --- DRAG HANDLE --- */}
          <div 
             className="flex-none h-14 w-full flex items-center justify-center cursor-grab active:cursor-grabbing z-20"
             onPointerDown={(e) => dragControls.start(e)}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors" />
          </div>

          {/* --- MAIN CONTENT --- */}
          <motion.main 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex-1 flex flex-col landscape:flex-row items-center justify-center px-6 pb-10 gap-8 landscape:gap-16 max-w-7xl mx-auto w-full"
          >
            
            {/* LEFT: ARTWORK / QUEUE / LYRICS */}
            <motion.div variants={itemVariants} className="w-full max-w-[360px] landscape:max-w-[420px] aspect-square relative flex-shrink-0">
               <AnimatePresence mode="wait">
                 {showLyrics ? (
                   <motion.div
                     key="lyrics"
                     initial={{ opacity: 0, scale: 0.9 }}
                     animate={{ opacity: 1, scale: 1 }}
                     exit={{ opacity: 0, scale: 0.9 }}
                     className="absolute inset-0 rounded-[32px] overflow-hidden bg-black/30 backdrop-blur-xl border border-white/10"
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
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="absolute inset-0 rounded-[32px] overflow-hidden bg-black/30 backdrop-blur-xl border border-white/10 flex flex-col"
                    >
                      <QueueList
                        queue={playerState.queue}
                        currentTrackId={playerState.currentTrackId}
                        tracks={tracks}
                        onReorder={(q) => setPlayerState(p => ({ ...p, queue: q }))}
                        onPlay={(id) => playTrack(id, { fromQueue: true })}
                        onRemove={onRemoveTrack || (() => {})}
                        onPlayNext={() => {}}
                        onClose={() => setShowQueue(false)}
                      />
                    </motion.div>
                 ) : (
                   <motion.div
                     key="art"
                     layoutId={`artwork-${currentTrack.id}`}
                     className="relative w-full h-full rounded-[32px] overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
                     style={{ scale: playerState.isPlaying ? beatScale : 1 }}
                   >
                     <img
                       src={currentTrack.coverArt}
                       className="w-full h-full object-cover"
                       alt="Album Art"
                     />
                     {/* Beat Flash Overlay */}
                     <motion.div
                         style={{ opacity: glowOpacity, background: colors.primary }}
                         className="absolute inset-0 mix-blend-overlay pointer-events-none"
                     />
                   </motion.div>
                 )}
               </AnimatePresence>
            </motion.div>

            {/* RIGHT: INFO & CONTROLS */}
            <div className="w-full max-w-[360px] flex flex-col gap-6 justify-center">

               {/* Text Info */}
               <motion.div variants={itemVariants} className="flex flex-col gap-1 items-start">
                  <motion.h1
                    layoutId={`title-${currentTrack.id}`}
                    className="text-2xl sm:text-3xl font-bold leading-tight text-white line-clamp-2 text-left"
                  >
                    {currentTrack.title}
                  </motion.h1>
                  <motion.button
                    layoutId={`artist-${currentTrack.id}`}
                    className="text-lg sm:text-xl text-zinc-400 font-medium hover:text-white transition-colors text-left"
                  >
                    {currentTrack.artist}
                  </motion.button>
               </motion.div>

               {/* Seek Slider (THE FIX) */}
               <motion.div variants={itemVariants} className="w-full py-2 group">
                 <div className="relative h-10 flex items-center group cursor-pointer">
                    {/* Visual Track */}
                    <div className="absolute top-1/2 left-0 w-full h-1.5 bg-white/10 rounded-full overflow-hidden -translate-y-1/2 group-hover:h-2.5 transition-all duration-300">
                        {/* Progress Bar */}
                        <motion.div 
                           className="h-full rounded-full relative"
                           style={{ width: `${(scrubValue / safeDuration) * 100}%`, backgroundColor: colors.primary }}
                        >
                            {/* Glow at the tip */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-full shadow-[0_0_10px_2px_rgba(255,255,255,0.5)]" style={{ backgroundColor: colors.primary }} />
                        </motion.div>
                    </div>

                    {/* The Thumb (Visual only, follows calculation) fckin hell */}
                    <div 
                        className="absolute h-4 w-4 rounded-full shadow-lg pointer-events-none transition-transform duration-100 ease-out"
                        style={{ 
                            left: `${(scrubValue / safeDuration) * 100}%`,
                            transform: `translate(-50%, -50%) scale(${isScrubbing ? 1.5 : 0})`,
                            top: '50%',
                            backgroundColor: colors.primary
                        }} 
                    />

                    {/* The Real Input - Invisible but covers touch area */}
                    <input
                      type="range"
                      min={0}
                      max={safeDuration}
                      step={0.1}
                      value={scrubValue}
                      onChange={onSeekChange}
                      onPointerDown={onSeekStart}
                      // onPointerUp removed: handled by global listener
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                 </div>

                 <div className="flex justify-between -mt-1 text-xs font-medium text-zinc-500 font-mono">
                   <span>{formatTime(scrubValue)}</span>
                   <span>{formatTime(duration)}</span>
                 </div>
               </motion.div>

               {/* Playback Controls */}
               <motion.div variants={itemVariants} className="flex items-center justify-between -mx-2">
                  <motion.button
                     whileTap={{ scale: 0.85 }}
                     onClick={toggleShuffle}
                     className={`p-2.5 rounded-full transition-colors ${playerState.shuffle ? 'text-primary bg-primary/10' : 'text-zinc-500 hover:bg-white/5'}`}
                  >
                    <Shuffle size={20} />
                  </motion.button>

                  <div className="flex items-center gap-4 sm:gap-6">
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={prevTrack}
                      className="text-zinc-200 hover:text-white p-2"
                    >
                      <SkipBack size={32} fill="currentColor" />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={togglePlay}
                      animate={{ scale: beat && playerState.isPlaying ? 1.05 : 1 }}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-[24px] sm:rounded-[28px] bg-white text-black flex items-center justify-center shadow-lg hover:shadow-white/25 transition-all"
                    >
                      {playerState.isPlaying ? 
                        <Pause size={32} fill="currentColor" /> : 
                        <Play size={32} fill="currentColor" className="ml-1" />
                      }
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={nextTrack}
                      className="text-zinc-200 hover:text-white p-2"
                    >
                      <SkipForward size={32} fill="currentColor" />
                    </motion.button>
                  </div>

                  <motion.button
                     whileTap={{ scale: 0.85 }}
                     onClick={toggleRepeat}
                     className={`p-2.5 rounded-full transition-colors relative ${playerState.repeat !== 'OFF' ? 'text-primary bg-primary/10' : 'text-zinc-500 hover:bg-white/5'}`}
                  >
                    <Repeat size={20} />
                    {playerState.repeat === 'ONE' && (
                        <span className="absolute top-1 right-1.5 text-[8px] font-black bg-background rounded-full px-0.5">1</span>
                    )}
                  </motion.button>
               </motion.div>

               {/* Bottom Actions */}
               <motion.div variants={itemVariants} className="flex items-center justify-center gap-4 mt-2">
                  <div className="h-12 sm:h-14 bg-white/5 rounded-full p-1 flex items-center backdrop-blur-md border border-white/5 shadow-inner">
                    <button
                       onClick={() => { setShowLyrics(true); setShowQueue(false); }}
                       className={`h-full px-5 sm:px-6 rounded-full flex items-center justify-center gap-2 transition-all font-medium text-sm ${showLyrics ? 'bg-white/15 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <Mic2 size={16} />
                      <span className="hidden sm:inline">Lyrics</span>
                    </button>
                    <div className="w-px h-5 bg-white/10 mx-1" />
                    <button
                       onClick={() => { setShowQueue(true); setShowLyrics(false); }}
                       className={`h-full px-5 sm:px-6 rounded-full flex items-center justify-center gap-2 transition-all font-medium text-sm ${showQueue ? 'bg-white/15 text-white shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                    >
                      <ListMusic size={16} />
                      <span className="hidden sm:inline">Queue</span>
                    </button>
                  </div>

                  <AnimatePresence>
                     {(showLyrics || showQueue) && (
                       <motion.button
                         initial={{ scale: 0, opacity: 0 }}
                         animate={{ scale: 1, opacity: 1 }}
                         exit={{ scale: 0, opacity: 0 }}
                         onClick={() => { setShowLyrics(false); setShowQueue(false); }}
                         className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/5"
                       >
                         <ChevronDown size={22} />
                       </motion.button>
                     )}
                  </AnimatePresence>
               </motion.div>
            </div>

          </motion.main>  
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPlayer;
