import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Search as SearchIcon, X, Disc, Globe, PlayCircle, Youtube, Plus, ListPlus, Check } from 'lucide-react';
import { Track, Playlist } from '../types';
import { searchYouTube, YouTubeTrack } from '../utils/youtube';
import AddToPlaylistModal from './AddToPlaylistModal';

interface SearchProps {
  activeTab: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTracks: Track[];
  playTrack: (id: string, options?: { customQueue: string[] }) => void;
  onAddWebTrack?: (url: string, metadata?: YouTubeTrack) => void;

  libraryTracks: Record<string, Track>;
  playlists: Playlist[];
  onAddYouTubeTrack: (track: YouTubeTrack) => void;
  onAddYouTubeToPlaylist: (playlistId: string, track: YouTubeTrack) => void;
  onCreatePlaylist: (name: string) => void;
}

const Search: React.FC<SearchProps> = ({ 
  activeTab, 
  searchQuery, 
  setSearchQuery, 
  filteredTracks, 
  playTrack,
  onAddWebTrack,
  libraryTracks,
  playlists,
  onAddYouTubeTrack,
  onAddYouTubeToPlaylist,
  onCreatePlaylist
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isWebMode, setIsWebMode] = useState(false);
  const [webTracks, setWebTracks] = useState<YouTubeTrack[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);

  // Modal State
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState<YouTubeTrack | null>(null);

  // Auto-focus input when tab becomes active
  useEffect(() => {
    if (activeTab === 'search') {
      inputRef.current?.focus();
    }
  }, [activeTab]);

  // Handle Escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClearSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setWebTracks([]);
    inputRef.current?.focus();
  };

  // Optimize click handler to prevent array recreation in the loop
  const handleTrackClick = useCallback((trackId: string) => {
    const queue = filteredTracks.map(t => t.id);
    playTrack(trackId, { customQueue: queue });
  }, [filteredTracks, playTrack]);

  // Detect YouTube URL
  const isYouTubeUrl = (url: string) => {
    return url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/);
  };

  // YouTube Search Effect
  useEffect(() => {
    if (!isWebMode || !searchQuery || isYouTubeUrl(searchQuery)) {
        setWebTracks([]);
        return;
    }

    const timer = setTimeout(async () => {
        setIsSearchingWeb(true);
        const results = await searchYouTube(searchQuery);
        setWebTracks(results);
        setIsSearchingWeb(false);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, isWebMode]);


  const handleWebPlay = (url: string, metadata?: YouTubeTrack) => {
    if (onAddWebTrack) {
        onAddWebTrack(url, metadata);
    }
  };

  const showWebInputResult = isYouTubeUrl(searchQuery);

  // Helper to check if a YouTube track is in library
  const isTrackInLibrary = (ytTrack: YouTubeTrack) => {
      return Object.values(libraryTracks).some(t => t.source === 'youtube' && t.externalUrl === ytTrack.url);
  };

  return (
    <>
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
                placeholder={isWebMode ? "Paste YouTube URL..." : "Find your frequency..."}
                className="flex-1 bg-transparent text-body-large text-surface-on placeholder:text-surface-on-variant/50 outline-none"
                style={{ fontSize: '16px' }} // Prevent iOS zoom
            />
            <AnimatePresence>
                {searchQuery && (
                <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={handleClearSearch}
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
                    onClick={() => {
                        setIsWebMode(!isWebMode);
                        setWebTracks([]);
                    }}
                    className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                        isWebMode ? 'bg-red-500/20 text-red-500' : 'text-surface-on-variant hover:text-surface-on'
                    }`}
                >
                    {isWebMode ? 'YouTube Search Active' : 'Switch to YouTube'}
                </button>
            </div>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 flex flex-col gap-2 pb-24">

        {/* Web Result (Direct URL) */}
        <AnimatePresence>
            {showWebInputResult && searchQuery.length > 5 && (
                 <motion.div
                 initial={{ opacity: 0, y: -10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, height: 0 }}
                 onClick={() => handleWebPlay(searchQuery)}
                 className="mx-2 mb-4 p-4 rounded-xl bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors group"
               >
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                        <Youtube size={24} />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-body-large font-bold text-red-100">Play from YouTube</h4>
                        <p className="text-body-small text-red-200/60 truncate">{searchQuery}</p>
                    </div>
                    <PlayCircle className="text-red-500 w-8 h-8 opacity-50 group-hover:opacity-100 transition-opacity" />
                 </div>
               </motion.div>
            )}
        </AnimatePresence>

        {/* YouTube Results */}
        {isWebMode && (
            <AnimatePresence mode='popLayout'>
                {isSearchingWeb && (
                    <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                {webTracks.map(t => {
                    const added = isTrackInLibrary(t);
                    return (
                    <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={t.id}
                        className="group flex items-center gap-4 p-2 pr-2 rounded-xl hover:bg-surface-container-high transition-colors"
                    >
                        {/* Artwork & Play */}
                        <div
                            className="w-14 h-14 bg-surface-container-highest rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm relative cursor-pointer"
                            onClick={() => handleWebPlay(t.url, t)}
                        >
                            {t.thumbnail ? (
                                <img src={t.thumbnail} alt={t.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"/>
                            ) : (
                                <Globe className="w-6 h-6 text-red-500/50" />
                            )}
                             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="bg-red-500 text-white p-1.5 rounded-full">
                                    <PlayCircle className="w-4 h-4" />
                                </div>
                            </div>
                        </div>

                        {/* Text Info */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleWebPlay(t.url, t)}>
                            <h4 className="text-body-large font-medium text-surface-on truncate group-hover:text-red-500 transition-colors flex items-center gap-2">
                                {t.title}
                            </h4>
                            <p className="text-body-medium text-surface-on-variant truncate">
                                {t.channel}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                             <span className="text-[10px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 mr-2">WEB</span>

                             <button
                                onClick={() => {
                                    setSelectedTrackForPlaylist(t);
                                    setIsPlaylistModalOpen(true);
                                }}
                                className="p-2 text-surface-on-variant hover:text-surface-on hover:bg-surface-container-highest rounded-full transition-colors"
                                title="Add to Playlist"
                             >
                                <ListPlus className="w-5 h-5" />
                             </button>

                             <button
                                onClick={() => !added && onAddYouTubeTrack(t)}
                                disabled={added}
                                className={`p-2 rounded-full transition-colors ${
                                    added
                                    ? 'text-green-500 cursor-default'
                                    : 'text-surface-on-variant hover:text-primary hover:bg-surface-container-highest'
                                }`}
                                title={added ? "Already in Library" : "Add to Library"}
                             >
                                {added ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                             </button>
                        </div>
                    </motion.div>
                )})}
            </AnimatePresence>
        )}

        {/* Local Results */}
        {!isWebMode && (
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
                    {t.source === 'youtube' && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/30">WEB</span>
                    )}
                    </h4>
                    <p className="text-body-medium text-surface-on-variant truncate">
                    {t.artist}
                    </p>
                </div>
                </motion.div>
            ))}
            </AnimatePresence>
        )}

        {/* Empty State */}
        {searchQuery && ((!isWebMode && filteredTracks.length === 0) || (isWebMode && webTracks.length === 0 && !isSearchingWeb)) && !showWebInputResult && (
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

    <AddToPlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        playlists={playlists}
        onSelectPlaylist={(playlistId) => {
            if (selectedTrackForPlaylist) {
                onAddYouTubeToPlaylist(playlistId, selectedTrackForPlaylist);
                setIsPlaylistModalOpen(false);
            }
        }}
        onCreatePlaylist={(name) => onCreatePlaylist(name)}
    />
    </>
  );
};

export default Search;
