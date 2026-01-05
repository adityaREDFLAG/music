import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchLyrics } from '../utils/lyrics';
import { Track, Lyrics } from '../types';
import { Loader2, Music2, Sparkles } from 'lucide-react';

interface LyricsViewProps {
  track: Track;
  currentTime: number;
  onSeek: (time: number) => void;
  onTrackUpdate?: (track: Track) => void;
}

const LyricsView: React.FC<LyricsViewProps> = ({ track, currentTime, onSeek, onTrackUpdate }) => {
  const [lyrics, setLyrics] = useState<Lyrics | null>(track.lyrics || null);
  const [loading, setLoading] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // Normalize time (handle ms vs seconds inputs)
  const normalizedTime = useMemo(() => {
    return currentTime > 10000 ? currentTime / 1000 : currentTime;
  }, [currentTime]);

  // --- 1. Optimized Fetch Logic ---
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // Optimistic render
      if (track.lyrics && !track.lyrics.error) {
        setLyrics(track.lyrics);
      } else {
        setLoading(true);
      }

      const data = await fetchLyrics(track);
      
      if (mounted) {
        // PERF: Avoid JSON.stringify. Check plain text length or sync status change.
        const prevLen = track.lyrics?.plain?.length || 0;
        const newLen = data.plain?.length || 0;
        const becameSynced = !track.lyrics?.synced && data.synced;

        if (prevLen !== newLen || becameSynced) {
          setLyrics(data);
          if (onTrackUpdate && !data.error) onTrackUpdate({ ...track, lyrics: data });
        }
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [track.title, track.artist]);

  // --- 2. Sync Logic ---
  useEffect(() => {
    if (!lyrics?.synced) return;
    const index = lyrics.lines.findIndex((line, i) => {
      const nextLine = lyrics.lines[i + 1];
      return line.time <= normalizedTime && (!nextLine || nextLine.time > normalizedTime);
    });
    if (index !== -1 && index !== activeLineIndex) setActiveLineIndex(index);
  }, [normalizedTime, lyrics]);

  // --- 3. Auto-Scroll ---
  useEffect(() => {
    if (activeLineIndex !== -1 && scrollRef.current && !isUserScrolling) {
      const activeEl = scrollRef.current.children[activeLineIndex] as HTMLElement;
      // 'nearest' is less jarring than 'center' if lines are close
      activeEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIndex, isUserScrolling]);

  const handleScroll = () => {
    setIsUserScrolling(true);
    if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
    userScrollTimeout.current = setTimeout(() => setIsUserScrolling(false), 2500);
  };

  // --- Render ---
  const renderContent = () => {
    if (loading && !lyrics) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white/50 animate-pulse">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="tracking-widest text-xs font-semibold uppercase">Syncing Lyrics...</p>
        </div>
      );
    }

    if (!lyrics || (!lyrics.lines.length && !lyrics.plain)) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white/30">
          <Music2 size={64} className="mb-6 opacity-30" />
          <p className="font-bold text-lg">No Lyrics Found</p>
        </div>
      );
    }

    if (!lyrics.synced) {
      return (
        <div className="p-10 text-center overflow-y-auto h-full no-scrollbar">
          <p className="whitespace-pre-wrap text-2xl font-bold leading-loose text-white/80">{lyrics.plain}</p>
        </div>
      );
    }

    return (
      <div 
        className="w-full h-full overflow-y-auto px-4 py-[50vh] no-scrollbar relative"
        onWheel={handleScroll}
        onTouchMove={handleScroll}
        style={{ 
          scrollBehavior: 'smooth',
          // iOS Momentum Scrolling Fix
          WebkitOverflowScrolling: 'touch',
          // Fade Masks
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
        }}
      >
        <div ref={scrollRef} className="flex flex-col gap-10 max-w-4xl mx-auto text-left pl-4">
          {lyrics.lines.map((line, i) => {
            const isActive = i === activeLineIndex;
            const isPast = i < activeLineIndex;

            // --- 4. KARAOKE MODE ---
            if (lyrics.isWordSynced && line.words?.length) {
              return (
                <motion.div 
                    key={i} 
                    className={`origin-left transition-all duration-500`}
                    initial={{ opacity: 0.5, filter: 'blur(2px)' }}
                    animate={{ 
                        scale: isActive ? 1.05 : 1,
                        opacity: isActive ? 1 : isPast ? 0.3 : 0.4,
                        filter: isActive ? 'blur(0px)' : 'blur(1.5px)'
                    }}
                    // Default seek to line start if they miss the word
                    onClick={() => onSeek(line.time)}
                >
                   {isActive && i === 0 && (
                      <div className="absolute -top-6 left-0 flex items-center gap-1 text-[10px] text-emerald-400 uppercase tracking-wider font-bold opacity-80">
                        <Sparkles size={10} /> Word Sync
                      </div>
                   )}

                   <p className="text-3xl md:text-5xl font-black leading-tight flex flex-wrap gap-x-3 gap-y-1 cursor-pointer">
                    {line.words.map((word, wIdx) => {
                       const nextWord = line.words![wIdx + 1];
                       // Active: Current time is AFTER this word start, but BEFORE next word start
                       const isWordActive = isActive && normalizedTime >= word.time && (!nextWord || normalizedTime < nextWord.time);
                       // Past: Current time is AFTER this word start
                       const isWordPast = isActive && normalizedTime >= word.time;

                       return (
                         <motion.span 
                           key={wIdx}
                           // Stop Propagation: Tap specific word to seek exactly there
                           onClick={(e) => { e.stopPropagation(); onSeek(word.time); }}
                           animate={{
                               color: isWordActive ? '#ffffff' : (isWordPast ? '#ffffff' : 'rgba(255,255,255,0.3)'),
                               scale: isWordActive ? 1.15 : 1,
                               // The "Bloom" Effect
                               textShadow: isWordActive ? "0 0 20px rgba(255,255,255,0.8)" : "none",
                               y: isWordActive ? -2 : 0
                           }}
                           transition={{ type: "spring", stiffness: 350, damping: 25 }}
                           className="inline-block origin-bottom will-change-transform hover:scale-110 hover:text-white transition-transform"
                         >
                           {word.text}
                         </motion.span>
                       )
                    })}
                  </p>
                </motion.div>
              );
            }

            // --- 5. STANDARD MODE ---
            return (
              <motion.div
                key={i}
                className="cursor-pointer origin-left group"
                onClick={() => onSeek(line.time)}
                animate={{
                    scale: isActive ? 1.05 : 1,
                    opacity: isActive ? 1 : isPast ? 0.3 : 0.4,
                    filter: isActive ? 'blur(0px)' : 'blur(2px)',
                    color: isActive ? '#ffffff' : 'rgba(255,255,255,0.6)'
                }}
                transition={{ duration: 0.5 }}
              >
                <p className={`text-3xl md:text-4xl font-extrabold leading-tight transition-all duration-300 ${isActive ? 'drop-shadow-lg' : 'group-hover:text-white/80'}`}>
                  {line.text}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="absolute inset-0 z-50 bg-black/70 backdrop-blur-3xl rounded-xl overflow-hidden border border-white/5 shadow-2xl"
      >
        {renderContent()}
      </motion.div>
    </AnimatePresence>
  );
};

export default LyricsView;
