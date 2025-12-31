
import React from 'react';
import { motion } from 'framer-motion';
import { Music, PlusCircle } from 'lucide-react';
import { Playlist } from '../../types';

interface PlaylistGridProps {
  playlists: Playlist[];
  trackCount: number;
  onCreate: () => void;
}

export const PlaylistGrid: React.FC<PlaylistGridProps> = ({ playlists, trackCount, onCreate }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div onClick={onCreate} className="aspect-square rounded-[60px] border-4 border-dashed border-black/10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[#6750A4] hover:text-[#6750A4] transition-all">
        <PlusCircle className="w-16 h-16" strokeWidth={1} /><span className="text-2xl font-black">Craft Playlist</span>
      </div>
      <div className="aspect-square rounded-[60px] bg-[#21005D] p-12 text-white flex flex-col justify-end shadow-2xl relative overflow-hidden group">
          <Music className="absolute -top-10 -right-10 w-48 h-48 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
          <h3 className="text-4xl font-black leading-tight">My Vibe</h3>
          <p className="text-xl font-bold opacity-60">{trackCount} tracks</p>
      </div>
      {/* Real playlists mapping would go here */}
    </div>
  );
};
