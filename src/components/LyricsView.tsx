import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchLyrics } from '../utils/lyrics';
import { Track, Lyrics } from '../types';
import { Loader2, Music2 } from 'lucide-react';

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

  // Normalize time
  const normalizedTime = useMemo(() => {
    return currentTime > 10000 ? currentTime / 1000 : currentTime;
  }, [currentTime]);

  // --- 1. Fetch Logic ---
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (track.lyrics && !track.lyrics.error) {
        setLyrics(track.lyrics);
      } else {
        setLoading(true);
      }

      const data = await fetchLyrics(track);
      
      if (mounted) {
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
          <p className="whitespace-pre-wrap text-xl font-medium leading-loose text-white/80">{lyrics.plain}</p>
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
          WebkitOverflowScrolling: 'touch',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)'
        }}
      >
        <div ref={scrollRef} className="flex flex-col gap-6 max-w-3xl mx-auto text-left pl-2">
          {lyrics.lines.map((line, i) => {
            const isActiveLine = i === activeLineIndex;
            const isPastLine = i < activeLineIndex;

            // --- 4. WORD SYNC MODE ---
            if (lyrics.isWordSynced && line.words?.length) {
              return (
                <motion.div 
                    key={i} 
                    className={`origin-left transition-all duration-500 py-1`}
                    initial={{ opacity: 0.5 }}
                    animate={{ 
                        opacity: isActiveLine ? 1 : isPastLine ? 0.4 : 0.4,
                        filter: isActiveLine ? 'blur(0px)' : 'blur(0.5px)'
                    }}
                    onClick={() => onSeek(line.time)}
                >
                    <p className="text-xl md:text-3xl font-bold leading-relaxed flex flex-wrap gap-x-2 gap-y-1 cursor-pointer">
                     {line.words.map((word, wIdx) => {
                        const nextWord = line.words![wIdx + 1];
                        
                        // 1. Is the word historically passed in this active line?
                        const isWordSung = isActiveLine && normalizedTime >= word.time;
                        
                        // 2. Is this the EXACT word being sung right now?
                        const isWordActive = isActiveLine && normalizedTime >= word.time && (!nextWord || normalizedTime < nextWord.time);

                        return (
                          <motion.span 
                            key={wIdx}
                            onClick={(e) => { e.stopPropagation(); onSeek(word.time); }}
                            animate={{
                                // Simple color transition, no glow
                                color: isWordActive 
                                  ? '#ffffff' 
                                  : (isWordSung ? '#d4d4d4' : 'rgba(255,255,255,0.3)'),
                                scale: isWordActive ? 1.05 : 1,
                            }}
                            transition={{ duration: 0.1 }} // Snappy transition
                            className="inline-block origin-center"
                          >
                            {word.text}
                          </motion.span>
                        )
                     })}
                  </p>
                </motion.div>
              );
            }

            // --- 5. STANDARD MODE (Line Sync Only) ---
            return (
              <motion.div
                key={i}
                className="cursor-pointer origin-left group py-1"
                onClick={() => onSeek(line.time)}
                animate={{
                    scale: isActiveLine ? 1.02 : 1,
                    opacity: isActiveLine ? 1 : isPastLine ? 0.4 : 0.5,
                    color: isActiveLine ? '#ffffff' : 'rgba(255,255,255,0.6)'
                }}
                transition={{ duration: 0.3 }}
              >
                <p className={`text-xl md:text-2xl font-bold leading-relaxed transition-all duration-300 ${isActiveLine ? '' : 'group-hover:text-white/80'}`}>
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
        className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md rounded-xl overflow-hidden border border-white/5 shadow-2xl"
      >
        {renderContent()}
      </motion.div>
    </AnimatePresence>
  );
};

export default LyricsView;
