import React from 'react';
import { motion } from 'framer-motion';
import { Music, PlayCircle, Search as SearchIcon } from 'lucide-react';
import { Track } from '../types';

interface SearchProps {
  activeTab: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTracks: Track[];
  playTrack: (id: string) => void;
}

const Search: React.FC<SearchProps> = ({ activeTab, searchQuery, setSearchQuery, filteredTracks, playTrack }) => {
  if (activeTab !== 'search') return null;

  return (
    <motion.div key="search" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-12">
      <div className="relative group">
        <SearchIcon className="absolute left-10 top-1/2 -translate-y-1/2 text-[#49454F] w-10 h-10 transition-colors group-focus-within:text-[#6750A4]" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Find your frequency..."
          className="w-full bg-[#F3EDF7] rounded-[60px] py-10 pl-24 pr-12 text-3xl font-black outline-none border-4 border-transparent focus:border-[#6750A4]/15 focus:bg-white transition-all shadow-inner"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredTracks.map(t => (
          <motion.div
            key={t.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => playTrack(t.id)}
            className="p-8 bg-white rounded-[56px] shadow-sm flex items-center justify-between border border-black/[0.02] hover:shadow-xl transition-all"
          >
            <div className="flex items-center gap-8">
              <div className="w-20 h-20 bg-[#F3EDF7] rounded-[32px] flex items-center justify-center flex-shrink-0"><Music className="w-10 h-10 opacity-20" /></div>
              <div>
                <h4 className="text-2xl font-black tracking-tight">{t.title}</h4>
                <p className="text-lg font-bold opacity-30 tracking-tight">{t.artist}</p>
              </div>
            </div>
            <PlayCircle className="w-14 h-14 text-[#6750A4] opacity-40" strokeWidth={1.5} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default Search;
