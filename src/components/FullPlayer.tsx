import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useDragControls,
  useSpring
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
  // When scrubbing, this is the source of truth for the slider position
  const [localScrubValue, setLocalScrubValue] = useState<number | null>(null);
  const isScrubbing = localScrubValue !== null;

  // Use props directly
  const { beat } = analyzerData || { beat: false };

  // Memoize color values to prevent recalculation
  const colors = useMemo(() => ({
    primary: theme?.primary || '#ffffff',
    secondary: theme?.secondary || '#a1a1aa',
    muted: theme?.muted || '#71717a',
    background: theme?.background || '#09090b'
  }), [theme?.primary, theme?.secondary, theme?.muted, theme?.background]);

  // Beat Animations
  const beatScale = useSpring(1, { stiffness: 300, damping: 10 });
  const glowOpacity = useSpring(0, { stiffness: 200, damping: 20 });

  useEffect(() => {
      if (beat && isPlayerOpen) {
          beatScale.set(1.03); // Pop
          glowOpacity.set(0.6); // Flash
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

  // Display value: Use local value while scrubbing, otherwise global currentTime
  const displayValue = isScrubbing ? localScrubValue : currentTime;

  // --- SCRUBBING HANDLERS ---
  const handleScrubStart = () => {
      if (startScrub) startScrub();
  };

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      if (!isSeekable) return;
      const value = Number((e.target as HTMLInputElement).value);

      // Update local state for slider UI
      setLocalScrubValue(value);

      // Update Audio immediately
      if (scrub) {
          scrub(value);
      } else {
          // Fallback if no scrub prop (should not happen with updated parent)
          handleSeek(value);
      }
  };

  const handleScrubEnd = () => {
      // Commit final value if needed, but scrub() already did it.
      if (endScrub) endScrub();

      // Clear local state so we fallback to currentTime prop
      // We expect currentTime to match localScrubValue now.
      setLocalScrubValue(null);
  };

  // Improved interaction handler to catch releases outside the slider
  const handleScrubInteractionStart = (e: React.PointerEvent<HTMLInputElement>) => {
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

  const handleReorder = useCallback((newQueue: string[]) => {
    setPlayerState(prev => ({ ...prev, queue: newQueue }));
  }, [setPlayerState]);

  const handleQueuePlayNext = useCallback((trackId: string) => {
    setPlayerState(prev => {
      const q = [...prev.queue];
      const existingIdx = q.indexOf(trackId);
      if (existingIdx !== -1) {
        q.splice(existingIdx, 1);
      }
      let newCurrentIdx = q.indexOf(prev.currentTrackId || '');
      if (newCurrentIdx === -1) newCurrentIdx = 0;
      q.splice(newCurrentIdx + 1, 0, trackId);
      return { ...prev, queue: q };
    });
  }, [setPlayerState]);

  if (!currentTrack) return null;

  // Use memoized color values
  const { primary: primaryColor, secondary: secondaryColor, muted: mutedColor, background: backgroundColor } = colors;

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
          style={{ opacity, y: dragY, background: backgroundColor, willChange: 'transform, opacity' }}
          onDragEnd={(_, i) => {
            if (i.offset.y > 100 || i.velocity.y > 500) onClose();
            else dragY.set(0);
          }}
          className="fixed inset-0 z-[100] flex flex-col touch-none overflow-hidden"
        >
          {/* Dynamic Background */}
          <motion.div
            animate={{ background: `linear-gradient(to bottom, ${primaryColor}40, ${backgroundColor})` }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 -z-20"
          />

          {/* Background Blur Image */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <motion.img
              key={currentTrack.coverArt}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              transition={{ duration: 1 }}
              src={currentTrack.coverArt}
              className="w-full h-full object-cover blur-[100px] scale-125 brightness-75"
              alt=""
            />
            {/* Grain Overlay */}
            <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />
          </div>

          {/* Drag Handle */}
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
                       onTrackUpdate={onTrackUpdate}
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
                    animate={{
                        opacity: 1,
                        scale: playerState.isPlaying ? 1 : 0.9
                    }}
                    style={{ scale: playerState.isPlaying ? beatScale : 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
                    className="relative w-full h-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden"
                  >
                     <img
                      src={currentTrack.coverArt}
                      className="w-full h-full object-cover"
                      alt="Album Art"
                    />
                    {/* Beat Glow Flash */}
                    <motion.div
                        style={{ opacity: glowOpacity, background: primaryColor }}
                        className="absolute inset-0 mix-blend-overlay pointer-events-none"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Info & Controls */}
            <div className="w-full max-w-[380px] flex flex-col justify-center gap-6">
              
              {/* Text Info */}
              <div className="text-center landscape:text-left">
                <motion.h1
                    animate={{ color: theme?.primary ? '#ffffff' : '#ffffff' }}
                    className="text-2xl md:text-3xl font-bold leading-tight line-clamp-1"
                    title={currentTrack.title}
                >
                  {currentTrack.title}
                </motion.h1>
                <motion.p
                    animate={{ color: mutedColor }}
                    className="text-lg line-clamp-1 mt-1 font-medium"
                    title={currentTrack.artist}
                >
                  {currentTrack.artist}
                </motion.p>
              </div>

              {/* Progress Slider */}
              <div className="group relative pt-4 pb-2">
                <div className="relative h-1.5 w-full bg-white/10 rounded-full group-hover:h-2 transition-all overflow-visible">
                  <motion.div
                    animate={{ backgroundColor: primaryColor }}
                    className="absolute h-full rounded-full pointer-events-none origin-left"
                    style={{ width: `${(displayValue / safeDuration) * 100}%`, willChange: 'width' }}
                  />
                  {/* Beat Pulse Overlay on Bar */}
                  {playerState.isPlaying && (
                      <motion.div
                        animate={{ opacity: beat ? 0.5 : 0 }}
                        transition={{ duration: 0.1 }}
                        className="absolute h-full w-full bg-white mix-blend-overlay pointer-events-none"
                      />
                  )}
                </div>

                <input
                    type="range"
                    min={0}
                    max={safeDuration}
                    step={0.1} // High resolution for smooth dragging
                    value={displayValue}
                    disabled={!isSeekable}
                    onChange={handleScrubChange}
                    onPointerDown={(e) => isSeekable && handleScrubInteractionStart(e)}
                    className={`absolute -inset-x-0 -top-2.5 w-full h-6 opacity-0 z-50 ${isSeekable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    style={{ pointerEvents: 'auto', bottom: '-8px' }}
                  />

                <div className="flex justify-between mt-2 text-xs font-medium font-mono" style={{ color: mutedColor }}>
                  <span>{formatTime(displayValue)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-between">
                <button 
                    onClick={toggleShuffle} 
                    className={`p-2 rounded-full transition-colors`}
                    style={{ color: playerState.shuffle ? primaryColor : mutedColor, backgroundColor: playerState.shuffle ? `${primaryColor}20` : 'transparent' }}
                >
                  <Shuffle size={20} />
                </button>

                <div className="flex items-center gap-6">
                  <button onClick={prevTrack} className="hover:scale-110 active:scale-90 transition-transform" style={{ color: secondaryColor }}>
                    <SkipBack size={32} fill="currentColor" />
                  </button>
                  
                  <motion.button
                    onClick={togglePlay}
                    whileTap={{ scale: 0.9 }}
                    animate={{ scale: beat ? 1.05 : 1 }}
                    style={{ backgroundColor: primaryColor, color: backgroundColor }}
                    className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-colors"
                  >
                    {playerState.isPlaying ? 
                      <Pause size={36} fill="currentColor" /> :
                      <Play size={36} fill="currentColor" className="ml-1" />
                    }
                  </motion.button>
                  
                  <button onClick={nextTrack} className="hover:scale-110 active:scale-90 transition-transform" style={{ color: secondaryColor }}>
                    <SkipForward size={32} fill="currentColor" />
                  </button>
                </div>

                <button 
                    onClick={toggleRepeat} 
                    className={`p-2 relative rounded-full transition-colors`}
                    style={{ color: playerState.repeat !== 'OFF' ? primaryColor : mutedColor, backgroundColor: playerState.repeat !== 'OFF' ? `${primaryColor}20` : 'transparent' }}
                >
                  <Repeat size={20} />
                  {playerState.repeat === 'ONE' && (
                    <span className="absolute top-1 right-1.5 text-[7px] px-0.5 rounded-[2px] font-bold leading-none" style={{ backgroundColor: primaryColor, color: backgroundColor }}>1</span>
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
                  className={`p-3 rounded-full transition-all`}
                  style={{
                      backgroundColor: showLyrics ? primaryColor : 'rgba(255,255,255,0.05)',
                      color: showLyrics ? backgroundColor : mutedColor
                  }}
                >
                  <Mic2 size={20} />
                </button>

                <button 
                  onClick={() => {
                    setShowQueue(!showQueue);
                    if (!showQueue) setShowLyrics(false);
                  }}
                  className={`p-3 rounded-full transition-all`}
                  style={{
                      backgroundColor: showQueue ? primaryColor : 'rgba(255,255,255,0.05)',
                      color: showQueue ? backgroundColor : mutedColor
                  }}
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
