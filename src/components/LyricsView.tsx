import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  }, [track.id, track.title, track.artist]);

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

    // Find the current line
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
          <p className="font-medium tracking-wide">Syncing w/Maths... 🔥🔥</p>
        </div>
      );
    }

    if (!lyrics || (lyrics.lines.length === 0 && !lyrics.plain)) {
       return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white/50 px-8 text-center">
          <Music2 className="mb-6 opacity-40" size={56} />
          <p className="text-xl font-bold mb-2">No Lyrics Found ✌️</p>
          <p className="text-sm opacity-60 max-w-[200px]">
            We couldn't find lyrics for this song, sucks ik 🥺
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
        <div ref={scrollRef} className="flex flex-col gap-10 text-left pl-4 pr-2 max-w-4xl mx-auto">
            {lyrics.lines.map((line, i) => {
                const isActive = i === activeLineIndex;
                const isPast = i < activeLineIndex;
                
                // --- LOGIC: Hybrid Mode Check ---
                // If a word is 10+ characters, force line-by-line mode for aesthetic reasons.
                const containsLongWord = line.words?.some(w => w.text.trim().length >= 10);
                const canUseWordSync = lyrics.isWordSynced && line.words && line.words.length > 0 && !containsLongWord;

                // --- OPTION A: WORD-BY-WORD RENDER ---
                if (canUseWordSync) {
                      return (
                        <motion.div
                            key={i}
                            layout
                            onClick={() => onSeek(line.time)}
                            initial={{ opacity: 0.5, scale: 0.98, y: 10 }}
                            animate={{
                                scale: isActive ? 1 : 0.98,
                                opacity: isActive ? 1 : isPast ? 0.3 : 0.5,
                                filter: isActive ? 'blur(0px)' : 'blur(1px)',
                                y: 0
                            }}
                            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                            className="cursor-pointer origin-left relative"
                        >
                             <p className="text-3xl md:text-5xl font-bold leading-tight flex flex-wrap gap-x-[0.35em] gap-y-1">
                               {line.words!.map((word, wIdx) => {
                                   const nextWordTime = word.endTime ?? line.words![wIdx + 1]?.time ?? Infinity;
                                   const isWordActive = isActive && currentTime >= word.time && currentTime < nextWordTime;
                                   const isWordSung = isActive && currentTime >= nextWordTime; // Word is finished but line is still active

                                   return (
                                       <span 
                                         key={wIdx}
                                         className="relative inline-block transition-all duration-200"
                                         style={{
                                            // Scale active word, keep sung words normal size but bright, dim future words
                                            transform: isWordActive ? 'scale(1.1)' : 'scale(1)',
                                            color: isWordActive || isWordSung ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                                            opacity: isWordActive || isWordSung ? 1 : 0.5,
                                         }}
                                       >
                                           {word.text}
                                           
                                           {/* Enhanced Active Glow */}
                                           {isWordActive && (
                                              <motion.span
                                                layoutId="activeWordGlow"
                                                className="absolute inset-0 bg-white/20 blur-lg rounded-full -z-10 scale-150"
                                                transition={{ duration: 0.2 }}
                                              />
                                           )}
                                       </span>
                                   );
                               })}
                             </p>
                             {line.translation && (
                               <motion.p
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: isActive ? 0.7 : 0 }}
                                 className="text-lg font-medium text-white/80 mt-2 block"
                               >
                                 {line.translation}
                               </motion.p>
                             )}
                        </motion.div>
                    );
                }

                // --- OPTION B: LINE-BY-LINE RENDER (Standard or Fallback for Long Words) ---
                // Calculate progress for karaoke fill effect
                let progress = 0;
                if (isActive) {
                    const nextLineTime = lyrics.lines[i + 1]?.time ?? (line.time + 5);
                    const duration = nextLineTime - line.time;
                    // Linear easing for smoother fill
                    progress = Math.max(0, Math.min(1, (currentTime - line.time) / duration));
                }

                return (
                    <motion.div
                        key={i}
                        layout
                        onClick={() => onSeek(line.time)}
                        initial={{ opacity: 0.5, scale: 0.98 }}
                        animate={{
                            scale: isActive ? 1.02 : 0.98,
                            opacity: isActive ? 1 : isPast ? 0.3 : 0.5,
                            filter: isActive ? 'blur(0px)' : 'blur(1px)',
                        }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="cursor-pointer origin-left"
                    >
                         <div className="relative">
                           {/* Background Text (Dimmed) */}
                           <p className="text-3xl md:text-5xl font-bold leading-tight text-white/30 absolute top-0 left-0 w-full select-none" aria-hidden="true">
                              {line.text}
                           </p>

                           {/* Foreground Text (Filled based on time) */}
                           <p 
                             className="text-3xl md:text-5xl font-bold leading-tight relative z-10"
                             style={{
                               backgroundImage: `linear-gradient(90deg, #FFFFFF ${progress * 100}%, rgba(255,255,255,0) ${progress * 100}%)`,
                               WebkitBackgroundClip: 'text',
                               WebkitTextFillColor: 'transparent',
                               backgroundClip: 'text',
                               color: 'transparent', // Fallback
                               transition: 'none' // Disable CSS transition for instant gradient updates via React
                             }}
                           >
                             {line.text}
                           </p>
                         </div>

                         {line.translation && (
                           <p className={`text-lg font-medium transition-colors duration-500 mt-2 ${isActive ? 'text-white/80' : 'text-white/40'}`}>
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
