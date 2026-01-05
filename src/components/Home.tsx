import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, Sparkles, Shuffle, List } from 'lucide-react';
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
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 25, mass: 0.8 }
  },
  hover: { scale: 1.03, y: -5, transition: { type: "spring", stiffness: 400, damping: 20 } },
  tap: { scale: 0.96 }
};

// --- SKELETON LOADER ---
const SkeletonCard = () => (
  <div className="flex flex-col gap-4">
    <div className="aspect-square rounded-[32px] bg-zinc-800/50 relative overflow-hidden isolate">
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_1.5s_infinite] z-10" />
    </div>
    <div className="space-y-2 px-2">
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
    className="group cursor-pointer flex flex-col gap-4 relative"
    onClick={() => onPlay(track.id)}
  >
    {/* Image Container */}
    <div className="aspect-square rounded-[32px] bg-zinc-900 overflow-hidden relative shadow-lg ring-1 ring-white/5 isolate">
      {track.coverArt ? (
        <motion.img 
          src={track.coverArt} 
          alt={track.title}
          className="w-full h-full object-cover transition-transform duration-500 will-change-transform"
          variants={{
             hover: { scale: 1.05 }
          }}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
          <Music className="w-20 h-20 text-zinc-700" />
        </div>
      )}
      
      {/* Play Overlay - Only visible on hover/focus */}
      <motion.div 
        initial={{ opacity: 0 }}
        variants={{
          hover: { opacity: 1 },
          tap: { opacity: 1 }
        }}
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center transition-opacity"
      >
        <motion.div
          variants={{
            hover: { scale: 1, opacity: 1 },
            hidden: { scale: 0.8, opacity: 0 }
          }}
          className="w-16 h-16 bg-white/90 text-black rounded-full flex items-center justify-center shadow-xl backdrop-blur-md"
        >
          <Play className="w-7 h-7 fill-current ml-1" />
        </motion.div>
      </motion.div>
    </div>

    {/* Text Content */}
    <div className="px-2 flex flex-col gap-1">
      <h3 className="text-[17px] font-bold text-white truncate leading-tight tracking-tight">
        {track.title}
      </h3>
      <p className="text-[15px] text-zinc-400 font-medium truncate group-hover:text-zinc-200 transition-colors">
        {track.artist}
      </p>
    </div>
  </motion.div>
));

TrackCard.displayName = 'TrackCard';

// --- MAIN COMPONENT ---
const Home: React.FC<HomeProps> = ({ filteredTracks, playTrack, activeTab, isLoading = false }) => {
  
  const randomMix = useMemo(() => {
    if (isLoading || !filteredTracks.length) return [];
    return [...filteredTracks]
      .sort(() => 0.5 - Math.random())
      .slice(0, 20);
  }, [filteredTracks, isLoading]);

  const handleShufflePlay = () => {
    if (randomMix.length > 0) {
      const randomIndex = Math.floor(Math.random() * randomMix.length);
      playTrack(randomMix[randomIndex].id, { customQueue: randomMix.map(t => t.id) });
    }
  };

  return (
    <motion.div 
      key="home-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full overflow-y-auto pt-safe pb-40 px-6 scrollbar-hide"
    >
      <div className="max-w-[1400px] mx-auto space-y-12 py-8">

        {/* Expressive Header */}
        <header className="flex flex-col lg:flex-row justify-between lg:items-end gap-8">
          <div className="space-y-3">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Discovery Mix</span>
            </motion.div>
            <h2 className="text-5xl md:text-7xl font-bold text-white tracking-tighter leading-[0.9]">
              Fresh <br className="hidden md:block" /> Picks
            </h2>
            <p className="text-xl text-zinc-400 max-w-lg font-medium leading-relaxed pt-2">
              A curated selection from your library, served fresh every time you visit.
            </p>
          </div>
          
          <div className="flex gap-4 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleShufflePlay}
              disabled={isLoading || filteredTracks.length === 0}
              className="h-14 px-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-colors flex items-center gap-3 text-lg"
            >
              <Shuffle className="w-6 h-6" />
              <span>Shuffle</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => randomMix[0] && playTrack(randomMix[0].id, { customQueue: randomMix.map(t => t.id) })}
              disabled={isLoading || filteredTracks.length === 0}
              className="h-14 px-10 rounded-full bg-white text-black font-bold shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_-10px_rgba(255,255,255,0.5)] transition-all flex items-center gap-3 text-lg disabled:opacity-50"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>Play</span>
            </motion.button>
          </div>
        </header>

        {/* Content Grid */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-12"
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
            className="flex flex-col items-center justify-center py-32 text-zinc-500"
          >
            <div className="w-32 h-32 rounded-[40px] bg-zinc-900 flex items-center justify-center mb-6">
              <Music className="w-16 h-16 opacity-30" />
            </div>
            <p className="text-2xl font-bold text-white">No tracks found</p>
            <p className="text-lg mt-2 text-zinc-400">Import music to get started.</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default Home;
