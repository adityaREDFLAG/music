
import React from 'react';
import { motion } from 'framer-motion';
import { Music, Play, PlayCircle, Trash2, PlusCircle, Loader2 } from 'lucide-react';
import { Track, Playlist, LibraryState } from '../../types';

interface TrackListProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (id: string) => void;
  onDelete: (id: string) => void;
  viewMode?: 'list' | 'grid';
}

export const TrackList: React.FC<TrackListProps> = ({ tracks, currentTrackId, isPlaying, onPlay, onDelete, viewMode = 'list' }) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10">
        {tracks.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onPlay(t.id)}
            className="p-5 rounded-[56px] bg-white shadow-xl shadow-black/[0.03] cursor-pointer group hover:shadow-2xl hover:shadow-[#6750A4]/10 transition-all"
          >
            <div className="aspect-square rounded-[44px] bg-gradient-to-br from-[#F3EDF7] to-[#EADDFF] mb-6 overflow-hidden flex items-center justify-center relative">
              {t.coverArt ? <img src={t.coverArt} className="w-full h-full object-cover" /> : <Music className="w-14 h-14 text-[#6750A4] opacity-20 group-hover:scale-110 transition-transform duration-500" />}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center transition-all">
                <Play className="w-12 h-12 text-white fill-white opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            </div>
            <h3 className="font-black truncate text-xl mb-1 tracking-tight">{t.title}</h3>
            <p className="text-base font-bold text-[#49454F] opacity-40 truncate">{t.artist}</p>
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {tracks.map((t, i) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onPlay(t.id)}
          className={`flex items-center gap-8 p-6 rounded-[48px] cursor-pointer transition-all ${currentTrackId === t.id ? 'bg-[#EADDFF] shadow-lg' : 'hover:bg-white border border-transparent hover:border-black/[0.03]'}`}
        >
          <div className="w-20 h-20 rounded-[32px] bg-white/60 flex items-center justify-center shadow-inner relative overflow-hidden flex-shrink-0">
            {t.coverArt ? <img src={t.coverArt} className="w-full h-full object-cover" /> : <Music className={`w-10 h-10 ${currentTrackId === t.id ? 'text-[#6750A4]' : 'opacity-10'}`} />}
            {currentTrackId === t.id && isPlaying && (
              <div className="absolute inset-0 bg-[#6750A4]/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#6750A4] animate-spin" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-2xl font-black truncate leading-tight tracking-tight">{t.title}</h4>
            <p className="text-lg font-bold opacity-30 truncate tracking-tight">{t.artist}</p>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); onDelete(t.id); }} className="p-5 text-red-300 hover:text-red-500 rounded-full hover:bg-red-50 transition-all"><Trash2 className="w-7 h-7" /></button>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
