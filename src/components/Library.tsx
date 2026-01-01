import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, Shuffle, ListFilter, Settings, Trash2, PlusCircle, Loader2, MoreVertical } from 'lucide-react';
import { Track, PlayerState } from '../types';
import { dbService } from '../db';

type LibraryTab = 'Songs' | 'Albums' | 'Artists' | 'Playlists';

interface LibraryProps {
  activeTab: string;
  libraryTab: LibraryTab;
  setLibraryTab: (tab: LibraryTab) => void;
  filteredTracks: Track[];
  playerState: PlayerState;
  playTrack: (id: string) => void;
  refreshLibrary: () => void;
  isLoading?: boolean;
}

// --- M3 LIST SKELETON ---
const SkeletonRow = () => (
  <div className="flex items-center gap-4 py-2 animate-pulse px-2">
    <div className="w-14 h-14 rounded-[12px] bg-surface-container-highest/50 flex-shrink-0 relative overflow-hidden">
       {/* "imreallyadi" Watermark */}
       <span className="text-[10px] text-surface-on-variant/20 font-bold absolute inset-0 flex items-center justify-center -rotate-12 select-none">
        imreallyadi
      </span>
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-surface-on/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
    </div>
    <div className="flex-1 space-y-2">
      <div className="h-4 w-1/2 bg-surface-container-highest/50 rounded-full" />
      <div className="h-3 w-1/3 bg-surface-container-highest/30 rounded-full" />
    </div>
    <div className="w-8 h-8 rounded-full bg-surface-container-highest/20" />
  </div>
);

// --- TRACK ROW COMPONENT ---
const TrackRow = memo(({ 
  track, 
  index, 
  onPlay, 
  isPlaying, 
  isCurrentTrack, 
  onDelete 
}: { 
  track: Track; 
  index: number; 
  onPlay: (id: string) => void;
  isPlaying: boolean; // Global playing state
  isCurrentTrack: boolean; // Is this specific track active?
  onDelete: (id: string) => void;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ delay: index * 0.02, type: "spring", stiffness: 400, damping: 30 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => onPlay(track.id)}
    className={`group relative flex items-center gap-4 p-2 rounded-2xl transition-all cursor-pointer border border-transparent ${
      isCurrentTrack 
        ? 'bg-secondary-container/40 border-outline-variant/10' 
        : 'hover:bg-surface-container-highest/30'
    }`}
  >
    {/* Thumbnail Image */}
    <div className="relative w-14 h-14 flex-shrink-0">
      <div className={`w-full h-full rounded-[12px] overflow-hidden shadow-sm transition-all ${
        isCurrentTrack ? 'bg-secondary-container' : 'bg-surface-container-high'
      }`}>
        {track.coverArt ? (
          <img 
            src={track.coverArt} 
            alt={track.title}
            className={`w-full h-full object-cover transition-opacity ${isCurrentTrack && isPlaying ? 'opacity-40' : 'opacity-100'}`} 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className={`w-6 h-6 ${isCurrentTrack ? 'text-secondary' : 'text-surface-on-variant/50'}`} />
          </div>
        )}
      </div>
      
      {/* Playing Indicator / Hover Overlay */}
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
        isCurrentTrack && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 bg-black/20 rounded-[12px]'
      }`}>
        {isCurrentTrack && isPlaying ? (
           <Loader2 className="w-6 h-6 text-secondary animate-spin drop-shadow-md" />
        ) : (
           <Play className="w-6 h-6 fill-white text-white drop-shadow-md ml-0.5" />
        )}
      </div>
    </div>

    {/* Text Info */}
    <div className="flex-1 min-w-0 flex flex-col justify-center">
      <h3 className={`text-title-medium font-semibold truncate leading-tight ${
        isCurrentTrack ? 'text-secondary' : 'text-surface-on'
      }`}>
        {track.title}
      </h3>
      <p className="text-body-medium text-surface-on-variant truncate mt-0.5">
        {track.artist}
      </p>
    </div>

    {/* Delete Action */}
    <button 
      onClick={(e) => {
        e.stopPropagation();
        onDelete(track.id);
      }}
      className="p-2 rounded-full text-surface-on-variant opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-error-container hover:text-error transition-all"
      title="Delete Track"
    >
      <Trash2 className="w-5 h-5" />
    </button>
  </motion.div>
));

TrackRow.displayName = 'TrackRow';

// --- MAIN LIBRARY COMPONENT ---
const Library: React.FC<LibraryProps> = ({ 
  activeTab, 
  libraryTab, 
  setLibraryTab, 
  filteredTracks, 
  playerState, 
  playTrack, 
  refreshLibrary,
  isLoading = false
}) => {
  if (activeTab !== 'library') return null;

  const handleDelete = (id: string) => {
    if(confirm('Delete track permanently?')) {
       dbService.deleteTrack(id);
       refreshLibrary();
    }
  };

  return (
    <motion.div 
      key="library-screen"
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="flex flex-col h-full pt-4 pb-32 px-4 md:px-6 max-w-4xl mx-auto"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-display-small font-bold text-surface-on">Library</h1>
        <button className="p-2 rounded-full hover:bg-surface-container-highest/50 transition-colors">
          <Settings className="w-6 h-6 text-surface-on" />
        </button>
      </div>

      {/* Tabs / Pills */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar mb-6 pb-2">
        {(['Songs', 'Albums', 'Artists', 'Playlists'] as LibraryTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setLibraryTab(tab)}
            className={`px-5 py-2 rounded-full text-label-large font-medium whitespace-nowrap transition-all ${
              libraryTab === tab
                ? 'bg-primary-container text-primary-on-container shadow-sm' 
                : 'bg-surface-container text-surface-on-variant hover:bg-surface-container-high'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Action Row (Only for Songs) */}
      {libraryTab === 'Songs' && (
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => filteredTracks[0] && playTrack(filteredTracks[0].id)}
            className="flex-1 h-12 rounded-full bg-secondary-container text-secondary-on-container hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 font-medium shadow-sm"
          >
            <Shuffle className="w-5 h-5" />
            <span>Shuffle</span>
          </button>
          
          <button className="h-12 w-12 rounded-full bg-surface-container-high text-surface-on-variant flex items-center justify-center hover:bg-surface-container-highest transition-colors">
            <ListFilter className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* CONTENT AREA */}
      <div className="flex flex-col flex-1 min-h-0">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={`skel-${i}`} />)
        ) : (
          <AnimatePresence mode="popLayout">
            {libraryTab === 'Songs' && (
              <div className="flex flex-col gap-1">
                {filteredTracks.map((track, i) => (
                  <TrackRow 
                    key={track.id} 
                    track={track} 
                    index={i} 
                    onPlay={playTrack}
                    isPlaying={playerState.isPlaying}
                    isCurrentTrack={playerState.currentTrackId === track.id}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {libraryTab === 'Playlists' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 md:grid-cols-3 gap-4"
              >
                {/* New Playlist Card */}
                <div 
                  onClick={() => alert("Playlist creation logic in development")} 
                  className="aspect-square rounded-[24px] border border-dashed border-outline/30 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-surface-container-high/50 active:scale-95 transition-all text-primary group"
                >
                  <div className="p-3 rounded-full bg-primary-container/20 group-hover:bg-primary-container/40 transition-colors">
                    <PlusCircle className="w-8 h-8" strokeWidth={2} />
                  </div>
                  <span className="text-label-large font-medium">New Playlist</span>
                </div>

                {/* 'My Vibe' Card */}
                <div className="aspect-square rounded-[24px] bg-tertiary-container p-5 text-tertiary-on-container flex flex-col justify-end shadow-elevation-1 relative overflow-hidden group cursor-pointer transition-all hover:shadow-elevation-3 hover:-translate-y-1">
                   <Music className="absolute -top-6 -right-6 w-32 h-32 opacity-10 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-700 ease-out" />
                   <h3 className="text-title-large font-bold leading-tight z-10">My Vibe</h3>
                   <p className="text-body-medium opacity-80 z-10 mt-1">{filteredTracks.length} tracks</p>
                </div>
              </motion.div>
            )}

            {!isLoading && filteredTracks.length === 0 && libraryTab === 'Songs' && (
              <div className="flex flex-col items-center justify-center py-20 opacity-60">
                <Music className="w-16 h-16 mb-4 text-surface-variant stroke-[1.5]" />
                <p className="text-title-medium text-surface-on-variant">No tracks found</p>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default Library;
