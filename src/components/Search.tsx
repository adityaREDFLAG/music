import React from 'react';
import { motion } from 'framer-motion';
import { Music, PlayCircle, Search as SearchIcon, X } from 'lucide-react';
import { Track } from '../types';

interface SearchProps {
  activeTab: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTracks: Track[];
  playTrack: (id: string) => void;
}

const Search: React.FC<SearchProps> = ({ activeTab, searchQuery, setSearchQuery, filteredTracks, playTrack }) => {
  return (
    <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 pt-2">
      <div className="sticky top-0 z-20 pt-2 pb-4 bg-surface/95 backdrop-blur-sm">
        <div className="relative group rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors flex items-center h-14 px-4 shadow-sm">
          <SearchIcon className="text-surface-on-variant w-6 h-6 mr-3" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Find your frequency..."
            className="flex-1 bg-transparent text-body-large text-surface-on placeholder:text-surface-on-variant/50 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-2 text-surface-on-variant hover:text-surface-on">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filteredTracks.map(t => (
          <motion.div
            key={t.id}
            whileTap={{ backgroundColor: 'var(--m3-surface-container-highest)' }}
            onClick={() => playTrack(t.id, { customQueue: filteredTracks.map(t => t.id) })}
            className="flex items-center gap-4 p-2 pr-4 rounded-xl cursor-pointer hover:bg-surface-container-high transition-colors"
          >
            <div className="w-14 h-14 bg-surface-container-highest rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {t.coverArt ? <img src={t.coverArt} className="w-full h-full object-cover"/> : <Music className="w-6 h-6 text-surface-on-variant/50" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-body-large font-medium text-surface-on truncate">{t.title}</h4>
              <p className="text-body-medium text-surface-on-variant truncate">{t.artist}</p>
            </div>
          </motion.div>
        ))}
        {searchQuery && filteredTracks.length === 0 && (
            <div className="text-center py-10 text-surface-on-variant">
                <p>No tracks found matching "{searchQuery}"</p>
            </div>
        )}
      </div>
    </motion.div>
  );
};

export default Search;
