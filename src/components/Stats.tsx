import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart2, TrendingUp, Music, Disc, X } from 'lucide-react';
import { dbService } from '../db';
import { Track } from '../types';

// --- ADI RETROGRADE (WRAPPED) COMPONENT ---
const AdiRetrograde: React.FC<{ isOpen: boolean; onClose: () => void; stats: any }> = ({ isOpen, onClose, stats }) => {
  const [slide, setSlide] = useState(0);

  const slides = [
    // INTRO
    {
      content: (
        <div className="flex flex-col items-center justify-center text-center p-8">
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
                className="w-48 h-48 rounded-full bg-gradient-to-tr from-primary to-purple-500 mb-8 flex items-center justify-center shadow-[0_0_60px_rgba(250,80,80,0.5)]"
            >
                <TrendingUp size={80} className="text-white" />
            </motion.div>
            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl font-bold mb-4 font-display"
            >
                Adi Retrograde
            </motion.h1>
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-xl text-white/60"
            >
                Your musical journey in review.
            </motion.p>
        </div>
      ),
      bg: "bg-black"
    },
    // TOP SONG
    {
        content: (
            <div className="flex flex-col items-center justify-center text-center p-8 w-full">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-primary font-bold uppercase tracking-widest mb-8"
                >
                    Top Song
                </motion.div>

                {stats.topTrack ? (
                    <>
                        <motion.img
                            src={stats.topTrack.coverArt || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=512&h=512&fit=crop'}
                            className="w-64 h-64 rounded-2xl shadow-2xl mb-8 object-cover"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring" }}
                        />
                        <motion.h2 className="text-3xl font-bold mb-2">{stats.topTrack.title}</motion.h2>
                        <motion.p className="text-xl text-white/60 mb-6">{stats.topTrack.artist}</motion.p>
                        <motion.div className="bg-white/10 px-6 py-3 rounded-full text-sm font-bold backdrop-blur-md">
                            Played {stats.topTrack.playCount} times
                        </motion.div>
                    </>
                ) : (
                    <p>No data yet</p>
                )}
            </div>
        ),
        bg: "bg-zinc-900"
    },
    // TOP ARTIST
    {
        content: (
            <div className="flex flex-col items-center justify-center text-center p-8 w-full">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-purple-400 font-bold uppercase tracking-widest mb-8"
                >
                    Top Artist
                </motion.div>

                {stats.topArtist ? (
                    <>
                         <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-64 h-64 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-8 shadow-2xl text-6xl font-bold"
                         >
                            {stats.topArtist.name.charAt(0)}
                         </motion.div>
                        <motion.h2 className="text-4xl font-bold mb-6">{stats.topArtist.name}</motion.h2>
                        <motion.div className="bg-purple-500/20 px-6 py-3 rounded-full text-sm font-bold backdrop-blur-md text-purple-200 border border-purple-500/30">
                            {stats.topArtist.count} plays total
                        </motion.div>
                    </>
                ) : (
                    <p>No data yet</p>
                )}
            </div>
        ),
        bg: "bg-indigo-950"
    },
    // SUMMARY
    {
        content: (
            <div className="flex flex-col items-center justify-center text-center p-8 w-full">
                <motion.h1 className="text-3xl font-bold mb-12">The Numbers</motion.h1>

                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                    <motion.div className="bg-white/5 p-6 rounded-2xl backdrop-blur-sm" whileHover={{ scale: 1.05 }}>
                        <div className="text-3xl font-bold text-primary mb-1">{stats.totalPlays}</div>
                        <div className="text-xs text-white/50 uppercase tracking-wider">Total Plays</div>
                    </motion.div>
                    <motion.div className="bg-white/5 p-6 rounded-2xl backdrop-blur-sm" whileHover={{ scale: 1.05 }}>
                        <div className="text-3xl font-bold text-blue-400 mb-1">{stats.uniqueArtists}</div>
                        <div className="text-xs text-white/50 uppercase tracking-wider">Artists</div>
                    </motion.div>
                    <motion.div className="bg-white/5 p-6 rounded-2xl backdrop-blur-sm col-span-2" whileHover={{ scale: 1.02 }}>
                         <div className="text-3xl font-bold text-green-400 mb-1">{Math.floor(stats.totalTime / 60)}</div>
                         <div className="text-xs text-white/50 uppercase tracking-wider">Minutes Listened</div>
                    </motion.div>
                </div>

                <motion.button
                    onClick={onClose}
                    className="mt-12 px-8 py-3 bg-white text-black font-bold rounded-full hover:scale-105 active:scale-95 transition-transform"
                >
                    Keep Listening
                </motion.button>
            </div>
        ),
        bg: "bg-zinc-950"
    }
  ];

  if (!isOpen) return null;

  return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black overflow-hidden"
    >
        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 flex p-2 gap-2 z-20 pb-safe pt-safe">
            {slides.map((_, i) => (
                <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-white"
                        initial={{ width: "0%" }}
                        animate={{ width: i < slide ? "100%" : i === slide ? "100%" : "0%" }}
                        transition={i === slide ? { duration: 5, ease: "linear" } : { duration: 0 }}
                        onAnimationComplete={() => {
                            if (i === slide && slide < slides.length - 1) {
                                setSlide(s => s + 1);
                            }
                        }}
                    />
                </div>
            ))}
        </div>

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 text-white/50 hover:text-white mt-safe">
            <X size={24} />
        </button>

        {/* Content */}
        <div
            className="flex-1 w-full relative"
            onClick={(e) => {
                const width = window.innerWidth;
                if (e.clientX > width / 2) {
                    if (slide < slides.length - 1) setSlide(s => s + 1);
                    else onClose();
                } else {
                    if (slide > 0) setSlide(s => s - 1);
                }
            }}
        >
             <AnimatePresence mode="wait">
                 <motion.div
                    key={slide}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.4 }}
                    className={`absolute inset-0 flex items-center justify-center ${slides[slide].bg}`}
                 >
                     {slides[slide].content}
                 </motion.div>
             </AnimatePresence>
        </div>
    </motion.div>
  );
};


// --- STATS TAB COMPONENT ---

interface StatsProps {
  playTrack: (id: string) => void;
}

const Stats: React.FC<StatsProps> = ({ playTrack }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [topTracks, setTopTracks] = useState<Track[]>([]);
  const [topArtists, setTopArtists] = useState<{name: string, count: number, cover: string}[]>([]);
  const [stats, setStats] = useState({
      totalPlays: 0,
      totalTime: 0,
      uniqueArtists: 0
  });
  const [showWrapped, setShowWrapped] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
        const allTracks = await dbService.getAllTracks();
        setTracks(allTracks);

        // Filter tracks with plays
        const playedTracks = allTracks.filter(t => (t.playCount || 0) > 0);

        // 1. Top Tracks
        const sortedTracks = [...playedTracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
        setTopTracks(sortedTracks.slice(0, 10));

        // 2. Top Artists
        const artistMap = new Map<string, { count: number, cover: string }>();
        playedTracks.forEach(t => {
            const current = artistMap.get(t.artist) || { count: 0, cover: t.coverArt || '' };
            artistMap.set(t.artist, {
                count: current.count + (t.playCount || 0),
                cover: current.cover || t.coverArt || '' // Prefer existing cover or new one
            });
        });

        const sortedArtists = Array.from(artistMap.entries())
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        setTopArtists(sortedArtists);

        // 3. Totals
        const totalPlays = playedTracks.reduce((acc, t) => acc + (t.playCount || 0), 0);
        const totalTime = playedTracks.reduce((acc, t) => acc + ((t.playCount || 0) * t.duration), 0);

        setStats({
            totalPlays,
            totalTime,
            uniqueArtists: artistMap.size
        });
    };

    loadStats();
  }, []);

  return (
    <div className="px-6 pt-24 pb-32 min-h-screen">
      <AnimatePresence>
         {showWrapped && (
             <AdiRetrograde
                isOpen={showWrapped}
                onClose={() => setShowWrapped(false)}
                stats={{ topTrack: topTracks[0], topArtist: topArtists[0], ...stats }}
             />
         )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex justify-between items-end mb-6">
            <h2 className="text-3xl font-bold font-display">Stats</h2>
            <button
                onClick={() => setShowWrapped(true)}
                className="bg-gradient-to-r from-primary to-purple-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg hover:shadow-primary/50 transition-shadow flex items-center gap-2"
            >
                <TrendingUp size={16} />
                Adi Retrograde
            </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                <div className="text-2xl font-bold text-primary">{stats.totalPlays}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-bold">Total Plays</div>
            </div>
            <div className="bg-surface/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                <div className="text-2xl font-bold text-blue-400">{Math.floor(stats.totalTime / 3600)}<span className="text-sm text-white/50 ml-1">hrs</span></div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-bold">Listening Time</div>
            </div>
        </div>

        {/* Most Listened Songs */}
        <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Disc size={20} className="text-primary" />
                Most Listened Songs
            </h3>

            <div className="space-y-3">
                {topTracks.length === 0 ? (
                    <div className="text-white/40 text-sm italic">Play some music to see your stats!</div>
                ) : (
                    topTracks.map((track, i) => (
                        <motion.div
                            key={track.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => playTrack(track.id)}
                            className="flex items-center gap-4 bg-surface/30 p-3 rounded-xl hover:bg-white/10 transition-colors group cursor-pointer"
                        >
                            <div className="font-mono text-lg font-bold text-white/30 w-6 text-center">{i + 1}</div>
                            <img
                                src={track.coverArt || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=50&h=50&fit=crop'}
                                className="w-12 h-12 rounded-md object-cover shadow-sm group-hover:scale-105 transition-transform"
                                alt={track.title}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="font-bold truncate text-white">{track.title}</div>
                                <div className="text-xs text-white/60 truncate">{track.artist}</div>
                            </div>
                            <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
                                {track.playCount}
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>

        {/* Top Artists */}
        <div>
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Music size={20} className="text-purple-400" />
                Top Artists
            </h3>

            <div className="grid grid-cols-2 gap-4">
                {topArtists.map((artist, i) => (
                    <motion.div
                        key={artist.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 + 0.3 }}
                        className="bg-surface/30 p-4 rounded-2xl flex flex-col items-center text-center gap-3 border border-white/5"
                    >
                        {artist.cover ? (
                            <img src={artist.cover} className="w-16 h-16 rounded-full object-cover shadow-lg" alt={artist.name} />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-xl font-bold text-white/50">
                                {artist.name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <div className="font-bold truncate w-full">{artist.name}</div>
                            <div className="text-xs text-white/50">{artist.count} plays</div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Stats;
