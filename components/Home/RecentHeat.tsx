
import React from 'react';
import { motion } from 'framer-motion';
import { TrackList } from '../Library/TrackList';
import { Track } from '../../types';

interface RecentHeatProps {
  tracks: Track[];
  onPlayAll: () => void;
  onPlayTrack: (id: string) => void;
}

export const RecentHeat: React.FC<RecentHeatProps> = ({ tracks, onPlayAll, onPlayTrack }) => {
  return (
    <section>
      <div className="flex justify-between items-end mb-10">
        <h2 className="text-4xl font-black tracking-tight">Recent Heat</h2>
        <button onClick={onPlayAll} className="text-lg font-bold text-[#6750A4] bg-[#EADDFF] px-8 py-3 rounded-full hover:bg-[#D1C4E9] transition-colors">Play All</button>
      </div>
      <TrackList tracks={tracks.slice(0, 10)} currentTrackId={null} isPlaying={false} onPlay={onPlayTrack} onDelete={() => {}} viewMode="grid" />
    </section>
  );
};
