import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { fetchLyrics } from '../utils/lyrics';
import { Track, Lyrics } from '../types';
import { Loader2, Music2 } from 'lucide-react';

interface LyricsViewProps {
  track: Track;
  currentTime: number;
  onSeek: (time: number) => void;
  onClose?: () => void;
  onTrackUpdate?: (track: Track) => void;
}

const LyricsView: React.FC<LyricsViewProps> = ({ track, currentTime, onSeek, onTrackUpdate }) => {
  const [lyrics, setLyrics] = useState<Lyrics | null>(track.lyrics || null);
  const [loading, setLoading] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // --- FIXED: Time Unit Normalization ---
  // If currentTime is > 10000 (10s), it's likely ms. 
  // (Assuming no songs have a 10,000 second intro).
  const normalizedTime = useMemo(() => {
    return currentTime > 10000 ? currentTime / 1000 : currentTime;
  }, [currentTime]);

  // Fetch Lyrics
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // Optimistic render
      if (track.lyrics && !track.lyrics.error) {
        setLyrics(track.lyrics);
        setLoading(false);
      } else {
        setLoading(true);
        setLyrics(null);
        setActiveLineIndex(-1);
      }

      try {
        const data = await fetchLyrics(track);
        
        if (mounted) {
          if (JSON.stringify(data) !== JSON.stringify(track.lyrics)) {
              setLyrics(data);
              if (onTrackUpdate && !data.error) {
                 onTrackUpdate({ ...track, lyrics: data });
              }
          }
        }
      } catch (error) {
        console.error("Failed to load lyrics:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [track.id, track.title, track.artist]);

  // Sync Active Line
  useEffect(() => {
    if (!lyrics || !lyrics.synced) return;

    // Use normalizedTime here
    const index = lyrics.lines.findIndex((line, i) => {
      const nextLine = lyrics.lines[i + 1];
      return line.time <= normalizedTime && (!nextLine || nextLine.time > normalizedTime);
    });

    if (index !== -1 && index !== activeLineIndex) {
      setActiveLineIndex(index);
    }
  }, [normalizedTime, lyrics, activeLineIndex]);

  // Handle User Interaction (Scroll)
  const handleUserScroll = useCallback(() => {
    setIsUserScrolling(true);
    if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);

    userScrollTimeout.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3000);
  }, []);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
    };
  }, []);

  // Auto Scroll logic
  useEffect(() => {
    if (activeLineIndex !== -1 && scrollRef.current && !isUserScrolling) {
      const activeEl = scrollRef.current.children[activeLineIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex, isUserScrolling]);

  // Render Content
  const renderContent = () => {
    if (loading) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white/50">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p className="font-medium tracking-wide">Loading Lyrics...</p>
        </div>
      );
    }

    if (!lyrics || (lyrics.lines.length === 0 && !lyrics.plain)) {
       return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white/50 px-8 text-center">
          <Music2 className="mb-6 opacity-40" size={56} />
          <p className="text-xl font-bold mb-2">No Lyrics Found</p>
          <p className="text-sm opacity-60 max-w-[200px]">
            We couldn't find lyrics for this song.
          </p>
        </div>
      );
    }

    if (!lyrics.synced && lyrics.plain) {
        return (
            <div className="w-full h-full overflow-y-auto px-8 py-12 text-center no-scrollbar mask-image-gradient">
                <p className="text-white/90 whitespace-pre-wrap text-xl leading-relaxed font-medium">
                    {lyrics.plain}
                </p>
            </div>
        );
    }

    return (
      <div
        ref={containerRef}
        onWheel={handleUserScroll}
        onTouchMove={handleUserScroll}
        className="w-full h-full overflow-y-auto px-4 py-[50vh] no-scrollbar mask-image-gradient"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div ref={scrollRef} className="flex flex-col gap-8 text-left pl-4 pr-2">
            {lyrics.lines.map((line, i) => {
                const isActive = i === activeLineIndex;
                const isPast = i < activeLineIndex;
                
                // Word-level Sync Rendering (Karaoke Mode)
                if (lyrics.isWordSynced && line.words && line.words.length > 0) {
                      return (
                        <motion.div
                            key={i}
                            onClick={() => onSeek(line.time)}
                            initial={false}
                            animate={{
                                scale: isActive ? 1.05 : 1,
                                opacity: isActive ? 1 : isPast ? 0.4 : 0.6,
                                filter: isActive ? 'blur(0px)' : 'blur(0.5px)'
                            }}
                            className="cursor-pointer origin-left"
                        >
                             <p className="text-2xl md:text-3xl font-bold leading-tight flex flex-wrap gap-[0.3em]">
                               {line.words.map((word, wIdx) => {
                                   // "Singing now" logic with NORMALIZED TIME
                                   const isWordActive = isActive && normalizedTime >= word.time && 
                                        (wIdx === line.words!.length - 1 || normalizedTime < line.words![wIdx + 1].time);
                                   
                                   // "Already sung" logic with NORMALIZED TIME
                                   const isWordPast = isActive && normalizedTime >= word.time;

                                   return (
                                        <motion.span 
                                          key={wIdx}
                                          initial={false}
                                          animate={{
                                             color: isWordActive ? '#ffffff' : (isWordPast ? '#ffffff' : 'rgba(255,255,255,0.3)'),
                                             scale: isWordActive ? 1.15 : 1,
                                             textShadow: isWordActive 
                                                 ? "0 0 15px rgba(255,255,255,0.8)" 
                                                 : "none",
                                             y: isWordActive ? -2 : 0
                                          }}
                                          transition={{ duration: 0.2, ease: "easeOut" }}
                                          className="inline-block origin-bottom"
                                        >
                                             {word.text}
                                        </motion.span>
                                   );
                               })}
                             </p>
                        </motion.div>
                    );
                }

                // Standard Line Sync
                return (
                    <motion.div
                        key={i}
                        onClick={() => onSeek(line.time)}
                        initial={false}
                        animate={{
                            scale: isActive ? 1.05 : 1,
                            opacity: isActive ? 1 : isPast ? 0.4 : 0.6,
                            filter: isActive ? 'blur(0px)' : 'blur(0.5px)',
                            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.6)'
                        }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="cursor-pointer origin-left"
                    >
                         <p className={`text-2xl md:text-3xl font-bold leading-tight ${isActive ? 'drop-shadow-md' : ''}`}>
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
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-20 flex flex-col bg-black/40 backdrop-blur-xl rounded-2xl overflow-hidden"
    >
      {renderContent()}
    </motion.div>
  );
};

export default LyricsView;
