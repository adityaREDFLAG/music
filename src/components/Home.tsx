import React from 'react';
import { motion } from 'framer-motion';
import { Music, Play, PlusCircle } from 'lucide-react';
import { Track, LibraryState, PlayerState, Playlist } from '../types';

interface HomeProps {
  filteredTracks: Track[];
  playTrack: (id: string) => void;
  activeTab: string;
}

const Home: React.FC<HomeProps> = ({ filteredTracks, playTrack, activeTab }) => {
  if (activeTab !== 'home') return null;

  return (
    <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-16">
      <section>
        <div className="flex justify-between items-end mb-10">
          <h2 className="text-4xl font-black tracking-tight">Recent Heat</h2>
          <button onClick={() => filteredTracks[0] && playTrack(filteredTracks[0].id)} className="text-lg font-bold text-[#6750A4] bg-[#EADDFF] px-8 py-3 rounded-full hover:bg-[#D1C4E9] transition-colors">Play All</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10">
          {filteredTracks.slice(0, 10).map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => playTrack(t.id)}
              className="p-5 rounded-[56px] bg-white shadow-xl shadow-black/[0.03] cursor-pointer group hover:shadow-2xl hover:shadow-[#6750A4]/10 transition-all"
            >
              <div className="aspect-square rounded-[44px] bg-gradient-to-br from-[#F3EDF7] to-[#EADDFF] mb-6 overflow-hidden flex items-center justify-center relative">
                <Music className="w-14 h-14 text-[#6750A4] opacity-20 group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center transition-all">
                  <Play className="w-12 h-12 text-white fill-white opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              </div>
              <h3 className="font-black truncate text-xl mb-1 tracking-tight">{t.title}</h3>
              <p className="text-base font-bold text-[#49454F] opacity-40 truncate">{t.artist}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </motion.div>
  );
};

export default Home;
