import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Search as SearchIcon, X, Disc, Globe, PlayCircle } from 'lucide-react';
import { Track } from '../types';

interface SearchProps {
  activeTab: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTracks: Track[];
  playTrack: (id: string, options?: { customQueue: string[] }) => void;
}

const Search: React.FC<SearchProps> = ({ 
  activeTab, 
  searchQuery, 
  setSearchQuery, 
  filteredTracks, 
  playTrack 
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isWebMode, setIsWebMode] = useState(false);

  // Auto-focus input when tab becomes active
  useEffect(() => {
    if (activeTab === 'search') {
      inputRef.current?.focus();
    }
  }, [activeTab]);

  // Handle Escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      inputRef.current?.blur();
    }
  };

  // Optimize click handler to prevent array recreation in the loop
  const handleTrackClick = useCallback((trackId: string) => {
    const queue = filteredTracks.map(t => t.id);
    playTrack(trackId, { customQueue: queue });
  }, [filteredTracks, playTrack]);

  // Detect SoundCloud URL
  const isSoundCloudUrl = (url: string) => {
    return url.match(/^https?:\/\/(soundcloud\.com|snd\.sc)\/(.*)$/);
  };

  const handleWebPlay = () => {
    // We can't really "play" it immediately without creating a track object first.
    // However, playTrack expects an ID that exists in the library OR we need to handle ad-hoc tracks.
    // Since the current architecture requires tracks to be in the library/queue,
    // we should create a temporary "Web Track" and add it to the library or handle it.
    // BUT: The app is built around `libraryTracks` and IndexedDB.
    // For now, we will assume we need to add it to the library as a "Web Track".
    // Or we can modify `playTrack` or `App.tsx` to handle ephemeral tracks?
    // Let's create a "virtual" track ID and pass it?
    // Wait, `playTrack` takes an ID and looks it up in `libraryTracks`.
    // So we must add it to the library first.
    // This requires `dbService.saveTrack` but we don't have metadata yet.
    // WE CAN USE A HACK: Pass a special ID and have `App` or `useAudioPlayer` handle it?
    // No, `useAudioPlayer` looks up `libraryTracks[id]`.

    // Better: Trigger a "Import from URL" flow.
    // Since we are in Search, we can just call an import function if we had one.
    // Let's dispatch a custom event for App.tsx to handle adding the web track.

    if (!searchQuery) return;

    const evt = new CustomEvent('add-web-track', {
        detail: { url: searchQuery }
    });
    window.dispatchEvent(evt);
    setSearchQuery('');
  };

  const showWebResult = isWebMode || isSoundCloudUrl(searchQuery);

  return (
    <motion.div 
      key="search" 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="space-y-6 pt-2 h-full flex flex-col"
    >
      {/* Search Bar - Sticky Header */}
      <div className="sticky top-0 z-20 pt-2 pb-4 bg-surface/95 backdrop-blur-md">
        <div className="flex flex-col gap-2">
            <div className="relative group rounded-full bg-surface-container-high focus-within:bg-surface-container-highest transition-colors flex items-center h-14 px-4 shadow-sm ring-1 ring-white/5">
            <SearchIcon className="text-surface-on-variant w-6 h-6 mr-3 transition-colors group-focus-within:text-primary" />
            <input
                ref={inputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isWebMode ? "Paste SoundCloud URL..." : "Find your frequency..."}
                className="flex-1 bg-transparent text-body-large text-surface-on placeholder:text-surface-on-variant/50 outline-none"
                style={{ fontSize: '16px' }} // Prevent iOS zoom
            />
            <AnimatePresence>
                {searchQuery && (
                <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => {
                    setSearchQuery('');
                    inputRef.current?.focus();
                    }}
                    className="p-2 text-surface-on-variant hover:text-surface-on hover:bg-surface-container-highest/50 rounded-full transition-colors active:scale-90"
                >
                    <X className="w-5 h-5" />
                </motion.button>
                )}
            </AnimatePresence>
            </div>

            {/* Mode Toggle */}
             <div className="flex items-center justify-end px-2">
                <button
                    onClick={() => setIsWebMode(!isWebMode)}
                    className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                        isWebMode ? 'bg-primary/20 text-primary' : 'text-surface-on-variant hover:text-surface-on'
                    }`}
                >
                    {isWebMode ? 'Web Playback Active' : 'Switch to Web Mode'}
                </button>
            </div>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 flex flex-col gap-2 pb-24">

        {/* Web Result */}
        <AnimatePresence>
            {showWebResult && searchQuery.length > 5 && (
                 <motion.div
                 initial={{ opacity: 0, y: -10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, height: 0 }}
                 onClick={handleWebPlay}
                 className="mx-2 mb-4 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-orange-600/10 border border-orange-500/20 cursor-pointer hover:bg-orange-500/20 transition-colors group"
               >
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform">
                        <Globe size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-body-large font-bold text-orange-100">Play from Web</h4>
                        <p className="text-body-small text-orange-200/60 truncate">{searchQuery}</p>
                    </div>
                    <PlayCircle className="text-orange-500 w-8 h-8 opacity-50 group-hover:opacity-100 transition-opacity" />
                 </div>
               </motion.div>
            )}
        </AnimatePresence>

        <AnimatePresence mode='popLayout'>
          {filteredTracks.map(t => (
            <motion.div
              layout // Enables smooth position transitions when filtering
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={t.id}
              whileTap={{ scale: 0.98, backgroundColor: 'var(--surface-container-highest)' }}
              onClick={() => handleTrackClick(t.id)}
              className="group flex items-center gap-4 p-2 pr-4 rounded-xl cursor-pointer hover:bg-surface-container-high transition-colors active:scale-[0.98]"
            >
              {/* Cover Art */}
              <div className="w-14 h-14 bg-surface-container-highest rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm relative">
                {t.coverArt ? (
                  <img src={t.coverArt} alt={t.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                ) : (
                  <Music className="w-6 h-6 text-surface-on-variant/50" />
                )}
                {/* Play Overlay on Hover */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <div className="bg-surface-on text-surface-inverse p-1.5 rounded-full">
                      <Music className="w-4 h-4" />
                   </div>
                </div>
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-body-large font-medium text-surface-on truncate group-hover:text-primary transition-colors flex items-center gap-2">
                  {t.title}
                  {t.source === 'soundcloud' && (
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/30">WEB</span>
                  )}
                </h4>
                <p className="text-body-medium text-surface-on-variant truncate">
                  {t.artist}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {searchQuery && filteredTracks.length === 0 && !showWebResult && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-surface-on-variant/60"
          >
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4">
              <Disc className="w-8 h-8 opacity-50" />
            </div>
            <p className="text-body-large font-medium">No tracks found</p>
            <p className="text-body-small">Try searching for a different artist or song</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default Search;
