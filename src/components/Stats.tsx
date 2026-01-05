import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Music, X, Play, Pause } from 'lucide-react';
import { dbService } from '../db';
import { Track } from '../types';

// --- RETRO GRAPHICS COMPONENTS (MATCHING VIDEO) ---

const RetroWaves = () => (
  <svg viewBox="0 0 1440 320" className="absolute bottom-0 left-0 w-full h-auto text-[#FF2E2E] opacity-100" preserveAspectRatio="none">
    <path fill="transparent" stroke="currentColor" strokeWidth="40" d="M0,160 C320,300,420,0,740,160 C1060,320,1160,0,1480,160" />
    <path fill="transparent" stroke="currentColor" strokeWidth="40" d="M0,260 C320,400,420,100,740,260 C1060,420,1160,100,1480,260" />
  </svg>
);

const RetroArches = () => (
  <svg viewBox="0 0 500 500" className="absolute bottom-[-10%] left-1/2 transform -translate-x-1/2 w-full max-w-md text-[#FF2E2E]">
    <path d="M50 500 A 200 200 0 0 1 450 500" fill="transparent" stroke="currentColor" strokeWidth="30" />
    <path d="M100 500 A 150 150 0 0 1 400 500" fill="transparent" stroke="currentColor" strokeWidth="30" />
    <path d="M150 500 A 100 100 0 0 1 350 500" fill="transparent" stroke="currentColor" strokeWidth="30" />
    <path d="M200 500 A 50 50 0 0 1 300 500" fill="transparent" stroke="currentColor" strokeWidth="30" />
  </svg>
);

const RetroBurst = () => (
  <svg viewBox="0 0 200 200" className="absolute bottom-[-50px] left-1/2 transform -translate-x-1/2 w-64 h-64 text-[#FF2E2E]">
    <path fill="currentColor" d="M100 0 L120 80 L200 100 L120 120 L100 200 L80 120 L0 100 L80 80 Z" />
  </svg>
);

// --- ADI RETROGRADE (WRAPPED) COMPONENT ---

const AdiRetrograde: React.FC<{ isOpen: boolean; onClose: () => void; stats: any }> = ({ isOpen, onClose, stats }) => {
  const [slide, setSlide] = useState(0);

  // Auto-advance logic
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (slide < 3) setSlide(s => s + 1);
      else onClose();
    }, 5000); // 5 seconds per slide
    return () => clearTimeout(timer);
  }, [slide, isOpen, onClose]);

  const slideVariants = {
    enter: { x: 100, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -100, opacity: 0 }
  };

  const slides = [
    // SLIDE 1: INTRO (Waves)
    {
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 relative z-10">
          <motion.div
            initial={{ scale: 0.8, rotate: -5 }}
            animate={{ scale: 1, rotate: 0 }}
            className="font-black text-6xl md:text-7xl text-[#FF2E2E] leading-tight tracking-tighter drop-shadow-sm"
            style={{ fontFamily: '"Arial Black", sans-serif' }} // Fallback for bubbly font
          >
            <div>Music</div>
            <div>retrograde</div>
            <div className="text-5xl mt-4">2026</div>
          </motion.div>
        </div>
      ),
      graphic: <RetroWaves />,
      bg: "bg-[#FFFDF8]" // Warm white
    },
    
    // SLIDE 2: TOP SONG (Arches) - "Clearly you were on something"
    {
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 relative z-10 pb-32">
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="font-black text-4xl text-[#FF2E2E] mb-8 leading-tight tracking-tight"
          >
            Clearly you<br/>were on<br/>something
          </motion.h2>

          {stats.topTrack && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="bg-[#FF2E2E] p-4 rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rotate-[-2deg]"
            >
              <img 
                src={stats.topTrack.coverArt} 
                className="w-48 h-48 rounded-xl border-4 border-white object-cover" 
              />
              <div className="mt-4 text-white font-bold text-lg">{stats.topTrack.title}</div>
              <div className="text-white/80 text-sm font-mono">{stats.topTrack.playCount} PLAYS</div>
            </motion.div>
          )}
        </div>
      ),
      graphic: <RetroArches />,
      bg: "bg-[#FFFDF8]"
    },

    // SLIDE 3: STATS (Drum Roll)
    {
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 relative z-10">
           <motion.h2 
            className="font-black text-5xl text-[#FF2E2E] mb-2 tracking-tight"
          >
            your stats
          </motion.h2>
          <motion.div 
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
            className="text-xl font-bold text-black mb-12 bg-gray-200 px-4 py-1 rounded-full"
          >
            🥁 Drum-roll
          </motion.div>

          <div className="grid grid-cols-1 gap-6 w-full max-w-xs">
            <div className="bg-[#FF2E2E] text-white p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-black">
              <div className="text-5xl font-black">{stats.totalPlays}</div>
              <div className="text-sm font-mono uppercase">Total Tracks</div>
            </div>
            
            <div className="bg-white text-[#FF2E2E] p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-2 border-[#FF2E2E]">
              <div className="text-5xl font-black">{Math.floor(stats.totalTime / 60)}</div>
              <div className="text-sm font-mono uppercase text-black">Minutes</div>
            </div>
          </div>
        </div>
      ),
      graphic: <div className="absolute left-0 top-0 bottom-0 w-8 bg-[#FF2E2E]" />, // Side strip
      bg: "bg-[#FFFDF8]"
    },

    // SLIDE 4: OUTRO (Burst)
    {
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 relative z-10 pb-40">
           <motion.h2 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="font-black text-4xl md:text-5xl text-[#FF2E2E] leading-snug tracking-tight"
          >
            Maybe it's<br/>more to<br/>expect<br/>next year?
          </motion.h2>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="mt-12 px-8 py-3 bg-black text-white font-bold rounded-full font-mono text-lg"
          >
            REPLAY ↺
          </motion.button>
        </div>
      ),
      graphic: <RetroBurst />,
      bg: "bg-[#FFFDF8]"
    }
  ];

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col bg-black"
    >
      {/* Container simulating mobile screen aspect ratio if on desktop */}
      <div className="w-full h-full max-w-md mx-auto relative overflow-hidden bg-white shadow-2xl">
        
        {/* Progress Bars */}
        <div className="absolute top-2 left-0 right-0 flex gap-1 px-2 z-50">
          {slides.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#FF2E2E]"
                initial={{ width: "0%" }}
                animate={{ width: i < slide ? "100%" : i === slide ? "100%" : "0%" }}
                transition={i === slide ? { duration: 5, ease: "linear" } : { duration: 0 }}
              />
            </div>
          ))}
        </div>

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-6 right-4 z-50 p-2 text-black/50 hover:text-[#FF2E2E]">
          <X size={28} strokeWidth={3} />
        </button>

        {/* Slide Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`absolute inset-0 flex flex-col ${slides[slide].bg}`}
            onClick={(e) => {
               // Tap navigation logic
               const width = e.currentTarget.offsetWidth;
               const x = e.nativeEvent.offsetX;
               if (x > width / 2) {
                 if (slide < slides.length - 1) setSlide(s => s + 1);
                 else onClose();
               } else {
                 if (slide > 0) setSlide(s => s - 1);
               }
            }}
          >
            {slides[slide].content}
            {slides[slide].graphic}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};


// --- MAIN STATS TAB COMPONENT ---

interface StatsProps {
  playTrack: (id: string) => void;
}

const Stats: React.FC<StatsProps> = ({ playTrack }) => {
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [topArtists, setTopArtists] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalPlays: 0, totalTime: 0, uniqueArtists: 0 });
  const [showWrapped, setShowWrapped] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      const allTracks = await dbService.getAllTracks();
      const playedTracks = allTracks.filter(t => (t.playCount || 0) > 0);

      // Top Tracks Logic
      const sortedTracks = [...playedTracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
      setTopTracks(sortedTracks.slice(0, 10));

      // Top Artists Logic
      const artistMap = new Map();
      playedTracks.forEach(t => {
        const current = artistMap.get(t.artist) || { count: 0, cover: t.coverArt || '' };
        artistMap.set(t.artist, { count: current.count + (t.playCount || 0), cover: current.cover || t.coverArt });
      });
      const sortedArtists = Array.from(artistMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setTopArtists(sortedArtists);

      // Totals
      setStats({
        totalPlays: playedTracks.reduce((acc, t) => acc + (t.playCount || 0), 0),
        totalTime: playedTracks.reduce((acc, t) => acc + ((t.playCount || 0) * t.duration), 0),
        uniqueArtists: artistMap.size
      });
    };
    loadStats();
  }, []);

  return (
    <div className="px-6 pt-24 pb-32 min-h-screen bg-black">
      <AnimatePresence>
         {showWrapped && (
             <AdiRetrograde
                isOpen={showWrapped}
                onClose={() => setShowWrapped(false)}
                stats={{ topTrack: topTracks[0], topArtist: topArtists[0], ...stats }}
             />
         )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        
        {/* Header Area */}
        <div className="flex flex-col gap-4 mb-8">
            <h2 className="text-4xl font-black text-white tracking-tighter">Your Stats</h2>
            
            {/* The Retrograde Trigger Button */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowWrapped(true)}
                className="w-full bg-[#FF2E2E] text-white p-6 rounded-2xl relative overflow-hidden group shadow-lg"
            >
                {/* Decorative BG Waves for button */}
                <div className="absolute bottom-[-20px] left-0 w-full opacity-30 group-hover:opacity-50 transition-opacity">
                    <svg viewBox="0 0 1440 320" className="w-full h-24 text-black fill-current">
                         <path d="M0,160 C320,300,420,0,740,160 C1060,320,1160,0,1480,160 L1480,320 L0,320 Z" />
                    </svg>
                </div>
                
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="text-xl font-black uppercase tracking-widest mb-1">Play</div>
                        <div className="text-3xl font-black font-serif">RETROGRADE '26</div>
                    </div>
                    <div className="bg-black/20 p-3 rounded-full">
                        <Play fill="white" size={32} />
                    </div>
                </div>
            </motion.button>
        </div>

        {/* Standard List Stats (Keeping dark mode for the list view) */}
        <div className="space-y-8">
             {/* Totals */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-[#FF2E2E] text-2xl font-black">{stats.totalPlays}</div>
                    <div className="text-zinc-500 text-xs font-bold uppercase">Plays</div>
                </div>
                <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-[#FF2E2E] text-2xl font-black">{Math.floor(stats.totalTime / 60)}</div>
                    <div className="text-zinc-500 text-xs font-bold uppercase">Minutes</div>
                </div>
            </div>

            {/* Top Songs List */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                   <Music size={20} className="text-[#FF2E2E]" /> Top Songs
                </h3>
                <div className="space-y-3">
                    {topTracks.map((track, i) => (
                        <div key={track.id} onClick={() => playTrack(track.id)} className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                            <span className="font-mono text-[#FF2E2E] font-bold w-6 text-center">{i + 1}</span>
                            <img src={track.coverArt} className="w-12 h-12 rounded bg-zinc-800 object-cover" />
                            <div className="flex-1 min-w-0">
                                <div className="text-white font-bold truncate">{track.title}</div>
                                <div className="text-zinc-500 text-sm truncate">{track.artist}</div>
                            </div>
                            <span className="text-xs font-bold bg-zinc-800 text-zinc-400 px-2 py-1 rounded">{track.playCount}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

      </motion.div>
    </div>
  );
};

export default Stats;
