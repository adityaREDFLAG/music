import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, Sparkles, Shuffle } from 'lucide-react';
import { Track } from '../types';

interface HomeProps {
  filteredTracks: Track[];
  playTrack: (id: string) => void;
  activeTab: string;
  isLoading?: boolean;
}

// --- ANIMATION VARIANTS ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 30 }
  },
  exit: { opacity: 0, scale: 0.9 }
};

// --- SKELETON LOADER ---
const SkeletonCard = () => (
  <div className="flex flex-col gap-4">
    <div className="aspect-square rounded-[24px] bg-zinc-800/50 relative overflow-hidden isolate">
      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center z-0 opacity-10">
        <span className="text-white font-black text-xl tracking-[0.2em] -rotate-12 select-none blur-[1px]">
          LOADING
        </span>
      </div>
      {/* Shimmer */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.5s_infinite] z-10" />
    </div>
    <div className="space-y-2 px-1">
      <div className="h-5 w-3/4 bg-zinc-800/50 rounded-full animate-pulse" />
      <div className="h-4 w-1/2 bg-zinc-800/30 rounded-full animate-pulse" />
    </div>
  </div>
);

// --- EXPRESSIVE TRACK CARD ---
const TrackCard = memo(({ track, onPlay }: { track: Track; onPlay: (id: string) => void }) => (
  <motion.div
    variants={cardVariants}
    whileHover="hover"
    whileTap="tap"
    className="group cursor-pointer flex flex-col gap-3 relative"
    onClick={() => onPlay(track.id)} // Parent handles queue
  >
    {/* Image Container */}
    <div className="aspect-square rounded-[24px] bg-zinc-900 overflow-hidden relative shadow-md transition-all duration-500 group-hover:shadow-xl group-hover:shadow-black/40 ring-1 ring-white/5">
      {track.coverArt ? (
        <motion.img 
          src={track.coverArt} 
          alt={track.title}
          className="w-full h-full object-cover"
          variants={{
            hover: { scale: 1.08 },
            tap: { scale: 1 }
          }}
          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <Music className="w-16 h-16 text-zinc-700" />
        </div>
      )}
      
      {/* Play Overlay */}
      <motion.div 
        initial={{ opacity: 0 }}
        variants={{
          hover: { opacity: 1 },
          tap: { opacity: 1 }
        }}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center"
      >
        <motion.div
          variants={{
            hover: { scale: 1, y: 0 },
            hidden: { scale: 0.5, y: 10 }
          }}
          className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center shadow-lg transform transition-transform"
        >
          <Play className="w-6 h-6 fill-current ml-1" />
        </motion.div>
      </motion.div>
    </div>

    {/* Text Content - High Contrast */}
    <div className="px-1 flex flex-col gap-0.5">
      <h3 className="text-base font-bold text-white truncate tracking-tight">
        {track.title}
      </h3>
      <p className="text-sm text-zinc-400 font-medium truncate group-hover:text-white transition-colors">
        {track.artist}
      </p>
    </div>
  </motion.div>
));

TrackCard.displayName = 'TrackCard';

// --- MAIN COMPONENT ---
const Home: React.FC<HomeProps> = ({ filteredTracks, playTrack, activeTab, isLoading = false }) => {
  
  // 1. Randomize tracks for display so it feels like a "Mix"
  const randomMix = useMemo(() => {
    if (isLoading || !filteredTracks.length) return [];
    return [...filteredTracks]
      .sort(() => 0.5 - Math.random()) // Simple shuffle
      .slice(0, 20); // Limit to 20 items
  }, [filteredTracks, isLoading]);

  // 2. Handler for Shuffle Play button
  const handleShufflePlay = () => {
    if (randomMix.length > 0) {
      const randomIndex = Math.floor(Math.random() * randomMix.length);
      playTrack(randomMix[randomIndex].id, { customQueue: randomMix.map(t => t.id) });
    }
  };

  if (activeTab !== 'home') return null;

  return (
    <motion.div 
      key="home-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full overflow-y-auto pt-8 pb-32 px-6 scrollbar-hide safe-area-bottom"
    >
      {/* Expressive Header */}
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div className="space-y-2">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2"
            >
              <Sparkles className="w-3 h-3" />
              <span>Discovery Mix</span>
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
              Fresh Picks
            </h2>
            <p className="text-lg text-zinc-400 max-w-md font-medium">
              A randomized selection from your library, served fresh.
            </p>
          </div>
          
          <div className="flex gap-3">
             {/* New Shuffle Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShufflePlay}
              disabled={isLoading || filteredTracks.length === 0}
              className="h-12 px-6 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-colors flex items-center gap-2"
            >
              <Shuffle className="w-5 h-5" />
              <span>Shuffle</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => randomMix[0] && playTrack(randomMix[0].id, { customQueue: randomMix.map(t => t.id) })}
              disabled={isLoading || filteredTracks.length === 0}
              className="h-12 px-8 rounded-full bg-white text-black font-bold shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Play Mix</span>
            </motion.button>
          </div>
        </header>

        {/* Content Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10"
        >
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <SkeletonCard key={`skel-${i}`} />
            ))
          ) : (
            <AnimatePresence mode="popLayout">
              {randomMix.map((track) => (
                <TrackCard 
                  key={track.id} 
                  track={track} 
                  onPlay={(id) => playTrack(id, { customQueue: randomMix.map(t => t.id) })}
                />
              ))}
            </AnimatePresence>
          )}
        </motion.div>

        {!isLoading && filteredTracks.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-zinc-500"
          >
            <div className="w-24 h-24 rounded-[32px] bg-zinc-900 flex items-center justify-center mb-4">
              <Music className="w-10 h-10 opacity-50" />
            </div>
            <p className="text-xl font-medium text-white">No tracks found</p>
            <p className="text-sm mt-2">Try importing some music to get started.</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default Home;
