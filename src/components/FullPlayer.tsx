import React, { useMemo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MoreVertical, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, ListMusic, Volume2 } from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
import QueueList from './QueueList';
import { dbService } from '../db';

interface FullPlayerProps {
  currentTrack: Track | null;
  playerState: PlayerState;
  isPlayerOpen: boolean;
  onClose: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
  currentTime: number;
  duration: number;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  themeColor: string;
  toggleShuffle?: () => void;
}

const formatTime = (time: number): string => {
  if (!time || isNaN(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const FullPlayer: React.FC<FullPlayerProps> = React.memo(({
  currentTrack, 
  playerState, 
  isPlayerOpen, 
  onClose, 
  togglePlay, 
  nextTrack, 
  prevTrack, 
  setPlayerState, 
  currentTime, 
  duration, 
  handleSeek,
  toggleShuffle
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  // Load tracks for queue
  React.useEffect(() => {
      if (showQueue) {
          dbService.getAllTracks().then(t => {
              setTracks(t.reduce((acc, tr) => ({ ...acc, [tr.id]: tr }), {}));
          });
      }
  }, [showQueue]);

  const progress = useMemo(() => {
    if (isScrubbing) {
        return (scrubValue / (duration || 1)) * 100;
    }
    return (currentTime / (duration || 1)) * 100;
  }, [currentTime, duration, isScrubbing, scrubValue]);

  const handleShuffleClick = useCallback(() => {
    if (toggleShuffle) {
        toggleShuffle();
    } else {
        setPlayerState(p => ({ ...p, shuffle: !p.shuffle }));
    }
  }, [toggleShuffle, setPlayerState]);

  const cycleRepeat = useCallback(() => {
    setPlayerState(p => ({ 
      ...p, 
      repeat: p.repeat === RepeatMode.OFF 
        ? RepeatMode.ALL 
        : p.repeat === RepeatMode.ALL 
        ? RepeatMode.ONE 
        : RepeatMode.OFF 
    }));
  }, [setPlayerState]);

  const onSeekStart = () => setIsScrubbing(true);
  const onSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setScrubValue(Number(e.target.value));
      handleSeek(e);
  };
  const onSeekEnd = () => setIsScrubbing(false);

  if (!isPlayerOpen || !currentTrack) return null;

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
            key="full-player"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-[50px]"
        >
            {/* Ambient Background */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                <motion.div
                    key={currentTrack.id}
                    initial={{ opacity: 0, scale: 1.2 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    transition={{ duration: 1.5 }}
                    className="absolute inset-0 w-full h-full"
                >
                    <img src={currentTrack.coverArt} className="w-full h-full object-cover blur-[80px] opacity-60" alt="" />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
                </motion.div>
            </div>

            {/* Draggable indicator for mobile feel */}
            <div
                className="w-full h-6 flex items-center justify-center cursor-pointer z-20 pt-2"
                onClick={onClose}
            >
                <div className="w-10 h-1 rounded-full bg-on-surface/20" />
            </div>

            <div className="flex-1 flex flex-col px-6 pb-8 md:px-12 max-w-2xl mx-auto w-full relative z-10">

                {/* Header (Hidden visually but keeps layout) */}
                <header className="flex justify-center items-center py-4 mb-4 relative">
                    <button
                        onClick={() => setShowQueue(!showQueue)}
                        className={`absolute right-0 p-2 rounded-full transition-colors ${showQueue ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
                    >
                        <ListMusic size={24} />
                    </button>
                </header>

                {showQueue ? (
                    <div className="flex-1 overflow-hidden min-h-0 bg-surface/30 rounded-[32px] mb-8 backdrop-blur-xl border border-white/5 shadow-2xl">
                         <QueueList
                            queue={playerState.queue}
                            currentTrackId={currentTrack.id}
                            tracks={tracks}
                            onReorder={(newQueue) => setPlayerState(p => ({ ...p, queue: newQueue }))}
                            onPlay={(id) => {
                                setPlayerState(p => ({ ...p, currentTrackId: id, isPlaying: true }));
                            }}
                         />
                    </div>
                ) : (
                    <>
                    {/* Artwork */}
                    <div className="flex-1 flex flex-col items-center justify-center min-h-0 mb-8">
                        <motion.div
                            layoutId={`artwork-${currentTrack.id}`}
                            className={`relative w-full aspect-square max-h-[380px] md:max-h-[450px] rounded-[24px] md:rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden ${playerState.isPlaying ? 'scale-100' : 'scale-90 opacity-80'}`}
                            animate={{ scale: playerState.isPlaying ? 1 : 0.85, opacity: playerState.isPlaying ? 1 : 0.8 }}
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                        >
                             {currentTrack.coverArt ? (
                                <img
                                    src={currentTrack.coverArt}
                                    className="w-full h-full object-cover"
                                    alt={`${currentTrack.title} album art`}
                                />
                                ) : (
                                <div className="w-full h-full flex items-center justify-center bg-surface-variant">
                                    <Music className="w-24 h-24 text-on-surface/10" />
                                </div>
                                )}
                        </motion.div>
                    </div>

                    {/* Metadata */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex-1 min-w-0 mr-4">
                            <motion.h1
                                layoutId={`title-${currentTrack.id}`}
                                className="text-2xl md:text-3xl font-bold text-white truncate leading-snug"
                            >
                                {currentTrack.title}
                            </motion.h1>
                            <motion.p
                                layoutId={`artist-${currentTrack.id}`}
                                className="text-lg md:text-xl text-white/60 truncate font-medium"
                            >
                                {currentTrack.artist}
                            </motion.p>
                        </div>
                        <button className="p-2 text-white/40 hover:text-primary transition-colors">
                            <Heart size={26} />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-8 group">
                        <div className="relative h-1.5 w-full bg-white/10 rounded-full cursor-pointer group-hover:h-2 transition-all duration-300">
                             <div
                                className="absolute h-full bg-white/30 rounded-full"
                                style={{ width: `${progress}%` }}
                             />
                             <div
                                className="absolute h-full bg-white rounded-full flex items-center justify-end"
                                style={{ width: `${progress}%` }}
                             >
                                 <div className="w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform translate-x-1.5" />
                             </div>
                             <input
                                type="range"
                                min="0"
                                max={duration || 0}
                                value={isScrubbing ? scrubValue : currentTime}
                                onMouseDown={onSeekStart}
                                onTouchStart={onSeekStart}
                                onChange={onSeekChange}
                                onMouseUp={onSeekEnd}
                                onTouchEnd={onSeekEnd}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-[12px] font-medium text-white/40 tabular-nums">
                            <span>{formatTime(isScrubbing ? scrubValue : currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between mb-8">
                         <button
                            onClick={handleShuffleClick}
                            className={`p-2 transition-colors ${playerState.shuffle ? 'text-primary' : 'text-white/40 hover:text-white/60'}`}
                        >
                            <Shuffle size={22} />
                        </button>

                        <div className="flex items-center gap-8 md:gap-12">
                            <button
                                onClick={prevTrack}
                                className="text-white/90 hover:scale-110 active:scale-90 transition-transform"
                            >
                                <SkipBack size={36} fill="currentColor" />
                            </button>

                            <button
                                onClick={togglePlay}
                                className="w-20 h-20 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
                            >
                                {playerState.isPlaying ? (
                                    <Pause size={32} fill="currentColor" />
                                ) : (
                                    <Play size={32} fill="currentColor" className="ml-1" />
                                )}
                            </button>

                            <button
                                onClick={nextTrack}
                                className="text-white/90 hover:scale-110 active:scale-90 transition-transform"
                            >
                                <SkipForward size={36} fill="currentColor" />
                            </button>
                        </div>

                        <button
                            onClick={cycleRepeat}
                            className={`p-2 transition-colors relative ${playerState.repeat !== RepeatMode.OFF ? 'text-primary' : 'text-white/40 hover:text-white/60'}`}
                        >
                            <Repeat size={22} />
                            {playerState.repeat === RepeatMode.ONE && (
                                <span className="absolute top-2 right-1.5 w-1 h-1 bg-current rounded-full" />
                            )}
                        </button>
                    </div>

                    {/* Volume (Visual Only for now as requested by UI focus) */}
                    <div className="flex items-center gap-3 px-4">
                        <Volume2 size={16} className="text-white/40" />
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                             <div className="w-[70%] h-full bg-white/40 rounded-full" />
                        </div>
                        <Volume2 size={20} className="text-white/80" />
                    </div>
                    </>
                )}
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

FullPlayer.displayName = 'FullPlayer';

export default FullPlayer;
