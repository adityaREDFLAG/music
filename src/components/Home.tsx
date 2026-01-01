import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, MoreVertical, Shuffle, ListFilter, Settings } from 'lucide-react';
import { Track } from '../types';

interface HomeProps {
  filteredTracks: Track[];
  playTrack: (id: string) => void;
  activeTab: string;
  isLoading?: boolean;
}

// --- M3 LIST SKELETON (Horizontal Row) ---
const SkeletonRow = () => (
  <div className="flex items-center gap-4 py-2 animate-pulse px-2">
    {/* Album Art Skeleton */}
    <div className="w-14 h-14 rounded-[12px] bg-surface-container-highest/50 flex-shrink-0 relative overflow-hidden">
       {/* "imreallyadi" Watermark */}
       <span className="text-[10px] text-surface-on-variant/20 font-bold absolute inset-0 flex items-center justify-center -rotate-12 select-none">
        imreallyadi
      </span>
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-surface-on/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
    </div>
    
    {/* Text Lines */}
    <div className="flex-1 space-y-2">
      <div className="h-4 w-1/2 bg-surface-container-highest/50 rounded-full" />
      <div className="h-3 w-1/3 bg-surface-container-highest/30 rounded-full" />
    </div>

    {/* Kebab Menu Skeleton */}
    <div className="w-8 h-8 rounded-full bg-surface-container-highest/20" />
  </div>
);

// --- M3 LIST ITEM (Row Style) ---
const TrackRow = memo(({ track, index, onPlay }: { track: Track; index: number; onPlay: (id: string) => void }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ 
      delay: index * 0.03, 
      type: "spring", 
      stiffness: 400, 
      damping: 30 
    }}
    whileTap={{ scale: 0.98, backgroundColor: "rgba(var(--surface-on-variant), 0.08)" }}
    onClick={() => onPlay(track.id)}
    className="group relative flex items-center gap-4 p-2 rounded-2xl transition-colors hover:bg-surface-container-highest/30 cursor-pointer"
  >
    {/* Thumbnail Image */}
    <div className="relative w-14 h-14 flex-shrink-0">
      <div className="w-full h-full rounded-[12px] overflow-hidden shadow-sm bg-surface-container-high">
        {track.coverArt ? (
          <img 
            src={track.coverArt} 
            alt={track.title}
            className="w-full h-full object-cover" 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-container-highest">
            <Music className="w-6 h-6 text-surface-on-variant/50" />
          </div>
        )}
      </div>
      
      {/* Playing Indicator / Hover Overlay */}
      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-[12px] flex items-center justify-center">
        <Play className="w-6 h-6 fill-white text-white drop-shadow-md" />
      </div>
    </div>

    {/* Text Info */}
    <div className="flex-1 min-w-0 flex flex-col justify-center">
      <h3 className="text-title-medium font-semibold text-surface-on truncate leading-tight">
        {track.title}
      </h3>
      <p className="text-body-medium text-surface-on-variant truncate mt-0.5">
        {track.artist}
      </p>
    </div>

    {/* Actions (Kebab Menu) */}
    <button 
      className="p-2 rounded-full text-surface-on-variant hover:bg-surface-on-variant/10 active:bg-surface-on-variant/20 transition-colors"
      onClick={(e) => e.stopPropagation()} // Prevent playing when clicking menu
    >
      <MoreVertical className="w-5 h-5" />
    </button>
  </motion.div>
));

TrackRow.displayName = 'TrackRow';

// --- MAIN COMPONENT ---
const Home: React.FC<HomeProps> = ({ filteredTracks, playTrack, activeTab, isLoading = false }) => {
  if (activeTab !== 'home') return null;

  return (
    <motion.div 
      key="library-screen"
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="flex flex-col h-full pt-4 pb-32 px-4 md:px-6 max-w-4xl mx-auto"
    >
      {/* Top Header: Library & Settings */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-display-small font-bold text-surface-on">Library</h1>
        <button className="p-2 rounded-full hover:bg-surface-container-highest/50 transition-colors">
          <Settings className="w-6 h-6 text-surface-on" />
        </button>
      </div>

      {/* Tabs / Pills */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar mb-6 pb-2">
        {['Songs', 'Albums', 'Artist', 'Playlists'].map((tab, i) => (
          <button
            key={tab}
            className={`px-5 py-2 rounded-full text-label-large font-medium whitespace-nowrap transition-all ${
              i === 0 
                ? 'bg-primary-container text-primary-on-container shadow-sm' 
                : 'bg-surface-container text-surface-on-variant hover:bg-surface-container-high'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Action Row: Shuffle & Filter */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => filteredTracks[0] && playTrack(filteredTracks[0].id)}
          disabled={isLoading || filteredTracks.length === 0}
          className="flex-1 h-12 rounded-full bg-primary-container/40 text-primary hover:bg-primary-container/60 active:scale-[0.99] transition-all flex items-center justify-center gap-2 font-medium"
        >
          <Shuffle className="w-5 h-5" />
          <span>Shuffle</span>
        </button>
        
        <button className="h-12 w-12 rounded-full bg-surface-container-high text-surface-on-variant flex items-center justify-center hover:bg-surface-container-highest transition-colors">
          <ListFilter className="w-5 h-5" />
        </button>
      </div>

      {/* Track List */}
      <div className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={`skel-${i}`} />
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredTracks.length > 0 ? (
              filteredTracks.map((track, i) => (
                <TrackRow 
                  key={track.id} 
                  track={track} 
                  index={i} 
                  onPlay={playTrack} 
                />
              ))
            ) : (
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

export default Home;
