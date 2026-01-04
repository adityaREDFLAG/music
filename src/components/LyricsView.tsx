import React, { useEffect, useState, useRef, useCallback } from 'react';
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

  // Fetch Lyrics
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // Optimistic render: If the track already has lyrics, use them immediately
      // This prevents layout shift/loading state if we have data
      if (track.lyrics && !track.lyrics.error) {
        setLyrics(track.lyrics);
        setLoading(false);
      } else {
        // Only show loading if we have nothing
        setLoading(true);
        setLyrics(null);
        setActiveLineIndex(-1);
      }

      try {
        // Always attempt to fetch/upgrade lyrics
        // (e.g., if user enabled Word Sync but we only have Line Sync)
        const data = await fetchLyrics(track);
        
        if (mounted) {
          // Only update if we got *new* lyrics (reference check works because fetchLyrics returns track.lyrics if unchanged)
          // Or if we had no lyrics before
          if (data !== track.lyrics) {
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
  }, [track.id, track.title, track.artist]); // Re-run if track changes

  // Sync Active Line
  useEffect(() => {
    if (!lyrics || !lyrics.synced) return;

    // Find the current line (last line where time <= currentTime)
    const index = lyrics.lines.findIndex((line, i) => {
      const nextLine = lyrics.lines[i + 1];
      return line.time <= currentTime && (!nextLine || nextLine.time > currentTime);
    });

    if (index !== -1 && index !== activeLineIndex) {
      setActiveLineIndex(index);
    }
  }, [currentTime, lyrics, activeLineIndex]);

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
        // Plain text fallback
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
                
                // Word-level Sync Rendering
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
                                   const isWordActive = isActive && currentTime >= word.time && 
                                       (wIdx === line.words!.length - 1 || currentTime < line.words![wIdx + 1].time);
                                   
                                   // Also highlight past words in the active line
                                   const isWordPast = isActive && currentTime >= word.time;

                                   return (
                                       <span 
                                         key={wIdx}
                                         className={`transition-colors duration-200 ${
                                             isActive 
                                               ? (isWordPast ? 'text-white drop-shadow-md' : 'text-white/40')
                                               : 'text-inherit' 
                                         }`}
                                       >
                                           {word.text}
                                       </span>
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
