import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MoreVertical, Music, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, ListMusic, Volume2, Share2 } from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
import Waveform from './Waveform';

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
}

const formatTime = (time: number) => {
  if (!time || isNaN(time)) return "0:00";
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const FullPlayer: React.FC<FullPlayerProps> = ({
  currentTrack, playerState, isPlayerOpen, onClose, togglePlay, nextTrack, prevTrack, setPlayerState, currentTime, duration, handleSeek, themeColor
}) => {
  return (
    <AnimatePresence>
      {isPlayerOpen && currentTrack && (
        <motion.div
          drag="y"
          dragConstraints={{ top: 0 }}
          onDragEnd={(_, info) => info.offset.y > 150 && onClose()}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 0.8 }}
          className="fixed inset-0 bg-surface z-[100] flex flex-col p-6 safe-area-top safe-area-bottom overflow-y-auto"
        >
          {/* Ambient Background */}
          <div className="absolute inset-0 -z-10 opacity-[0.15]" style={{ background: `radial-gradient(circle at center 30%, ${themeColor}, transparent 70%)` }} />

          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <button onClick={onClose} className="w-12 h-12 rounded-full hover:bg-surface-on/5 flex items-center justify-center transition-colors">
              <ChevronDown className="w-8 h-8 text-surface-on" />
            </button>
            <div className="text-center opacity-0 md:opacity-100 transition-opacity">
              <span className="text-label-medium text-surface-on-variant uppercase tracking-widest">Now Playing</span>
            </div>
            <button className="w-12 h-12 rounded-full hover:bg-surface-on/5 flex items-center justify-center transition-colors">
              <MoreVertical className="w-6 h-6 text-surface-on" />
            </button>
          </div>

          <div className="flex-1 flex flex-col max-w-lg mx-auto w-full">
            {/* Album Art */}
            <motion.div
              layoutId="artwork"
              className="w-full aspect-square rounded-3xl shadow-elevation-4 overflow-hidden mb-12 bg-surface-container-high flex items-center justify-center relative ring-1 ring-white/10"
            >
              {currentTrack.coverArt ? (
                <img src={currentTrack.coverArt} className="w-full h-full object-cover" />
              ) : (
                <Music className="w-32 h-32 text-surface-on-variant opacity-20" />
              )}
            </motion.div>

            {/* Track Info */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex-1 min-w-0 pr-4">
                <motion.h2 className="text-headline-medium font-medium text-surface-on truncate mb-1">
                  {currentTrack.title}
                </motion.h2>
                <motion.p className="text-title-medium text-surface-on-variant truncate">
                  {currentTrack.artist}
                </motion.p>
              </div>
              <button className="w-12 h-12 rounded-full hover:bg-surface-on/5 flex items-center justify-center transition-colors flex-shrink-0">
                <Heart className="w-7 h-7 text-surface-on-variant" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full mb-10 group">
              <div className="relative h-4 flex items-center">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute w-full h-full opacity-0 cursor-pointer z-30"
                />
                <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden relative">
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-primary"
                    style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                  />
                </div>
                {/* Thumb indicator only visible on hover/drag or just create a nice visual one */}
                <div
                  className="absolute w-3 h-3 bg-primary rounded-full shadow-sm z-20 pointer-events-none transition-transform group-hover:scale-150"
                  style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-label-small text-surface-on-variant font-medium tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration || 0)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mb-12">
              <button
                onClick={() => setPlayerState(p => ({ ...p, shuffle: !p.shuffle }))}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${playerState.shuffle ? 'bg-primary-container text-primary-on-container' : 'text-surface-on-variant hover:bg-surface-on/5'}`}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-8">
                <button onClick={prevTrack} className="text-surface-on hover:text-primary transition-colors active:scale-95">
                  <SkipBack className="w-9 h-9 fill-current" />
                </button>

                <button
                  onClick={togglePlay}
                  className="w-20 h-20 rounded-[28px] bg-primary text-on-primary flex items-center justify-center shadow-elevation-3 hover:shadow-elevation-4 active:scale-95 transition-all"
                >
                  {playerState.isPlaying ? (
                    <Pause className="w-8 h-8 fill-current" />
                  ) : (
                    <Play className="w-8 h-8 fill-current translate-x-1" />
                  )}
                </button>

                <button onClick={nextTrack} className="text-surface-on hover:text-primary transition-colors active:scale-95">
                  <SkipForward className="w-9 h-9 fill-current" />
                </button>
              </div>

              <button
                onClick={() => setPlayerState(p => ({ ...p, repeat: p.repeat === RepeatMode.OFF ? RepeatMode.ALL : p.repeat === RepeatMode.ALL ? RepeatMode.ONE : RepeatMode.OFF }))}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors relative ${playerState.repeat !== RepeatMode.OFF ? 'bg-primary-container text-primary-on-container' : 'text-surface-on-variant hover:bg-surface-on/5'}`}
              >
                <Repeat className="w-5 h-5" />
                {playerState.repeat === RepeatMode.ONE && (
                  <span className="absolute text-[8px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[1px]">1</span>
                )}
              </button>
            </div>

            <div className="flex justify-center">
                 <div className="bg-secondary-container/50 px-6 py-2 rounded-full">
                     <Waveform isPlaying={playerState.isPlaying} />
                 </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPlayer;
