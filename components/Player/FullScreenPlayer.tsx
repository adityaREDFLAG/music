
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, ChevronDown, Heart, MoreVertical, Music, ListMusic, Volume2, Share2 } from 'lucide-react';
import { Track, RepeatMode } from '../../types';
import { Waveform } from '../Shared/SharedComponents';

interface FullScreenPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isOpen: boolean;
  onClose: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onShuffle: () => void;
  onRepeat: () => void;
  shuffle: boolean;
  repeat: RepeatMode;
  currentTime: number;
  duration: number;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  themeColor: string;
}

export const FullScreenPlayer: React.FC<FullScreenPlayerProps> = ({
  currentTrack,
  isPlaying,
  isOpen,
  onClose,
  onTogglePlay,
  onNext,
  onPrev,
  onShuffle,
  onRepeat,
  shuffle,
  repeat,
  currentTime,
  duration,
  onSeek,
  themeColor
}) => {
  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && currentTrack && (
        <motion.div
          drag="y"
          dragConstraints={{ top: 0 }}
          onDragEnd={(_, info) => info.offset.y > 150 && onClose()}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200, mass: 0.8 }}
          className="fixed inset-0 bg-[#FEF7FF] z-[100] flex flex-col p-12 pb-20 safe-area-top overflow-y-auto no-scrollbar"
        >
          <div className="absolute inset-0 -z-10 opacity-[0.2]" style={{ background: `radial-gradient(circle at center, ${themeColor}, transparent 70%)` }} />

          <div className="flex justify-between items-center mb-16 flex-shrink-0">
            <button onClick={onClose} className="w-20 h-20 rounded-[38px] glass flex items-center justify-center border border-black/[0.03] shadow-sm"><ChevronDown className="w-12 h-12" /></button>
            <div className="text-center">
              <p className="text-xs font-black tracking-[0.4em] uppercase text-[#6750A4] mb-1 opacity-60">Frequency Active</p>
              <h2 className="text-base font-black tracking-tight">{currentTrack.album}</h2>
            </div>
            <button className="w-20 h-20 rounded-[38px] glass flex items-center justify-center border border-black/[0.03] shadow-sm"><MoreVertical className="w-8 h-8" /></button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
            <motion.div
              layoutId="artwork"
              drag="x"
              onDragEnd={(_, info) => info.offset.x > 100 ? onPrev() : info.offset.x < -100 && onNext()}
              className="w-full aspect-square rounded-[100px] shadow-[0_60px_120px_-20px_rgba(0,0,0,0.4)] overflow-hidden mb-20 bg-gradient-to-br from-[#EADDFF] to-[#6750A4] flex items-center justify-center relative ring-[16px] ring-white/10 flex-shrink-0"
            >
              {currentTrack.coverArt ? <img src={currentTrack.coverArt} className="w-full h-full object-cover" /> : <Music className="w-48 h-48 text-white opacity-20" />}
              <div className="absolute bottom-16 inset-x-0 flex justify-center text-white/40"><Waveform isPlaying={isPlaying} /></div>
            </motion.div>

            <div className="w-full flex justify-between items-end mb-16 flex-shrink-0">
              <div className="flex-1 min-w-0 pr-10">
                <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-7xl font-black tracking-tighter truncate leading-[0.8] mb-4">{currentTrack.title}</motion.h2>
                <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-3xl font-bold text-[#6750A4] opacity-50 tracking-tight">{currentTrack.artist}</motion.p>
              </div>
              <button className="w-24 h-24 rounded-[44px] bg-[#EADDFF] text-[#6750A4] flex items-center justify-center shadow-xl flex-shrink-0"><Heart className="w-12 h-12 fill-[#6750A4]" strokeWidth={3} /></button>
            </div>

            <div className="w-full mb-16 px-4 flex-shrink-0">
              <div className="relative h-8 flex items-center">
                <input type="range" min="0" max={duration || 0} value={currentTime} onChange={onSeek} className="absolute w-full h-full opacity-0 cursor-pointer z-30" />
                <div className="w-full h-8 bg-[#E7E0EB] rounded-full overflow-hidden relative shadow-inner">
                  <motion.div className="absolute inset-y-0 left-0 bg-[#6750A4] shadow-[0_0_20px_rgba(103,80,164,0.4)]" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
                </div>
                <div className="absolute w-12 h-12 bg-[#21005D] border-[8px] border-white rounded-full shadow-2xl z-20 pointer-events-none" style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 24px)` }} />
              </div>
              <div className="flex justify-between mt-8 text-sm font-black opacity-30 tracking-[0.3em] tabular-nums uppercase">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration || 0)}</span>
              </div>
            </div>

            <div className="w-full flex items-center justify-between mb-20 flex-shrink-0">
              <button onClick={onShuffle} className={`w-24 h-24 rounded-full flex items-center justify-center ${shuffle ? 'bg-[#EADDFF] text-[#6750A4]' : 'opacity-20'}`}><Shuffle className="w-10 h-10" strokeWidth={3} /></button>
              <div className="flex items-center gap-12">
                <SkipBack onClick={onPrev} className="w-20 h-20 fill-current cursor-pointer active:scale-90 transition-transform" />
                <button onClick={onTogglePlay} className="w-48 h-48 rounded-[72px] bg-[#21005D] text-white flex items-center justify-center shadow-[0_40px_80px_-10px_rgba(33,0,93,0.5)] active:scale-95 transition-all">
                  {isPlaying ? <Pause className="w-24 h-24 fill-current" /> : <Play className="w-24 h-24 fill-current translate-x-2" />}
                </button>
                <SkipForward onClick={onNext} className="w-20 h-20 fill-current cursor-pointer active:scale-90 transition-transform" />
              </div>
              <button onClick={onRepeat} className={`w-24 h-24 rounded-full flex items-center justify-center ${repeat !== RepeatMode.OFF ? 'bg-[#EADDFF] text-[#6750A4]' : 'opacity-20'}`}><Repeat className="w-10 h-10" strokeWidth={3} /></button>
            </div>
          </div>

          <div className="flex justify-around pt-12 border-t border-black/[0.03] max-w-lg mx-auto w-full opacity-40 flex-shrink-0">
            <div className="flex flex-col items-center gap-3"><ListMusic className="w-10 h-10" /><span className="text-xs font-black uppercase tracking-[0.3em]">Queue</span></div>
            <div className="flex flex-col items-center gap-3"><Volume2 className="w-10 h-10" /><span className="text-xs font-black uppercase tracking-[0.3em]">Device</span></div>
            <div className="flex flex-col items-center gap-3"><Share2 className="w-10 h-10" /><span className="text-xs font-black uppercase tracking-[0.3em]">Share</span></div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
