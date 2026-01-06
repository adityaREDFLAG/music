import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fetchLyrics } from '../utils/lyrics';
import { Track, Lyrics } from '../types';
import { Loader2, Music2, Sparkles } from 'lucide-react';
import { useToast } from './Toast';

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

  const { addToast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const userScrollTimeout = useRef<NodeJS.Timeout | null>(null);

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

  const handleGenerateWordSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const data = await fetchLyrics(track, true, true);
      setLyrics(data);
      if (onTrackUpdate && !data.error) {
        onTrackUpdate({ ...track, lyrics: data });
      }

      if (data.isWordSynced) {
        addToast("Lyrics enhanced!", "success");
      } else {
        addToast("Enhancement failed. Try again.", "error");
      }
    } catch (error) {
      console.error("Failed to enhance lyrics:", error);
      addToast("Failed to enhance lyrics", "error");
    } finally {
      setLoading(false);
    }
  };

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
          <p className="font-medium tracking-wide">Syncing with Maths ❤️‍🔥...</p>
        </div>
      );
    }

    if (!lyrics || (lyrics.lines.length === 0 && !lyrics.plain)) {
       return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white/50 px-8 text-center">
          <Music2 className="mb-6 opacity-40" size={56} />
          <p className="text-xl font-bold mb-2">No Lyrics Found 😖</p>
          <p className="text-sm opacity-60 max-w-[200px]">
            We couldn't find lyrics for this song 🥺
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
        <div ref={scrollRef} className="flex flex-col gap-6 text-left pl-4 pr-2 max-w-3xl mx-auto">
            {lyrics.lines.map((line, i) => {
                const isActive = i === activeLineIndex;
                
                // Detect dense lines to slightly reduce size
                const wordCount = line.words ? line.words.length : line.text.split(' ').length;
                const isLongLine = wordCount > 10;
                
                // Word-level Sync Rendering
                if (lyrics.isWordSynced && line.words && line.words.length > 0) {
                      return (
                        <motion.div
                            key={i}
                            layout
                            onClick={() => onSeek(line.time)}
                            initial={{ opacity: 0.5, scale: 1, filter: 'blur(2px)' }}
                            animate={{
                                opacity: isActive ? 1 : 0.4,
                                scale: isActive ? 1.05 : 1,
                                filter: isActive ? 'blur(0px)' : 'blur(1.5px)',
                                y: isActive ? 0 : 0
                            }}
                            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }} // smooth easeOutQuint-ish
                            className="cursor-pointer origin-left"
                        >
                             <p className={`font-bold leading-tight flex flex-wrap gap-x-[0.35em] gap-y-2 ${
                                isLongLine 
                                  ? 'text-xl md:text-2xl' 
                                  : 'text-2xl md:text-3xl'
                             }`}>
                               {line.words.map((word, wIdx) => {
                                   // --- 4. Hold highlight after word ends ---
                                   // Rule: HOLD = 0.08–0.15 seconds
                                   const HOLD = 0.12;

                                   const isLastWord = wIdx === line.words!.length - 1;

                                   // Ensure we have a valid end time. Step 1 logic ensures word.endTime is populated.
                                   // Fallback to nextWordTime or Infinity just in case.
                                   const absoluteEndTime = word.endTime ?? line.words![wIdx + 1]?.time ?? Infinity;

                                   let isWordActive = false;
                                   if (isLastWord) {
                                       // --- 6. Special rule: last word of line ---
                                       // "Do NOT advance highlight until next line begins"
                                       // Since word.endTime is clamped to nextLine.time, using absoluteEndTime works perfectly.
                                       isWordActive = isActive && currentTime >= word.time && currentTime < absoluteEndTime;
                                   } else {
                                       // Intermediate words: Hold visual activity slightly
                                       isWordActive = isActive && currentTime >= word.time && currentTime < (absoluteEndTime + HOLD);
                                   }

                                   const isWordPast = isActive && currentTime >= (isLastWord ? absoluteEndTime : absoluteEndTime + HOLD);

                                   // --- 5. Slow fade-out, fast fade-in ---
                                   // Rule: Fast scale/opacity in, Slower opacity out
                                   const transitionConfig = isWordActive
                                     ? { duration: 0.05, ease: 'easeOut' }  // Fast In
                                     : { duration: 0.4, ease: 'easeOut' };  // Slow Out

                                   return (
                                       <motion.span 
                                         key={wIdx}
                                         className="relative inline-block origin-bottom"
                                         animate={{
                                             color: isWordActive || isWordPast ? '#ffffff' : 'rgba(255,255,255,0.3)',
                                             scale: isWordActive ? 1.15 : 1,
                                             y: isWordActive ? -2 : 0,
                                         }}
                                         transition={transitionConfig}
                                       >
                                           {word.text}
                                       </motion.span>
                                   );
                               })}
                             </p>
                             {line.translation && (
                               <motion.p
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: isActive ? 0.7 : 0.4 }}
                                 className="text-lg font-medium text-white mt-2 block"
                               >
                                 {line.translation}
                               </motion.p>
                             )}
                        </motion.div>
                    );
                }

                // Standard Line Sync
                return (
                    <motion.div
                        key={i}
                        layout
                        onClick={() => onSeek(line.time)}
                        initial={{ opacity: 0.5, scale: 1, filter: 'blur(2px)' }}
                        animate={{
                            opacity: isActive ? 1 : 0.4,
                            scale: isActive ? 1.05 : 1,
                            filter: isActive ? 'blur(0px)' : 'blur(1.5px)',
                            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)'
                        }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                        className="cursor-pointer origin-left"
                    >
                         <p className={`font-bold leading-tight transition-all duration-300 ${
                            isLongLine 
                                ? 'text-xl md:text-2xl' 
                                : 'text-2xl md:text-3xl'
                         }`}>
                           {line.text}
                         </p>
                         {line.translation && (
                           <p className="text-lg font-medium text-white/60 mt-2">
                             {line.translation}
                           </p>
                         )}
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
        className="absolute inset-0 z-20 flex flex-col bg-black/60 backdrop-blur-2xl rounded-t-3xl md:rounded-2xl overflow-hidden"
    >
      <div className="absolute top-6 right-6 z-50">
        <button
           onClick={handleGenerateWordSync}
           className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all hover:scale-105 active:scale-95"
           title="Estimate Word Timing"
         >
           <Sparkles size={18} className={loading ? 'animate-pulse text-primary' : ''} />
         </button>
      </div>
      {renderContent()}
    </motion.div>
  );
};

export default LyricsView;
