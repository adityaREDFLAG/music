import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchLyrics } from '../utils/lyrics';
import { Track, Lyrics, LyricLine } from '../types';
import { Loader2, Music2 } from 'lucide-react';

interface LyricsViewProps {
  track: Track;
  currentTime: number;
  onSeek: (time: number) => void;
  onClose?: () => void;
}

const LyricsView: React.FC<LyricsViewProps> = ({ track, currentTime, onSeek, onClose }) => {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch Lyrics
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setLyrics(null);
      const data = await fetchLyrics(track.title, track.artist);
      if (mounted) {
        setLyrics(data);
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [track.title, track.artist]);

  // Sync Active Line
  useEffect(() => {
    if (!lyrics || !lyrics.synced) return;

    // Find the current line
    // We want the last line where time <= currentTime
    const index = lyrics.lines.findIndex((line, i) => {
      const nextLine = lyrics.lines[i + 1];
      return line.time <= currentTime && (!nextLine || nextLine.time > currentTime);
    });

    if (index !== -1 && index !== activeLineIndex) {
      setActiveLineIndex(index);
    }
  }, [currentTime, lyrics, activeLineIndex]);

  // Auto Scroll
  useEffect(() => {
    if (activeLineIndex !== -1 && scrollRef.current) {
      const activeEl = scrollRef.current.children[activeLineIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex]);

  // Render Content
  const renderContent = () => {
    if (loading) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white/50">
          <Loader2 className="animate-spin mb-4" size={32} />
          <p>Loading lyrics...</p>
        </div>
      );
    }

    if (!lyrics || (lyrics.lines.length === 0 && !lyrics.plain)) {
       return (
        <div className="w-full h-full flex flex-col items-center justify-center text-white/50 px-8 text-center">
          <Music2 className="mb-4 opacity-50" size={48} />
          <p className="text-lg font-medium">No lyrics available</p>
          <p className="text-sm mt-2 opacity-60">We couldn't find lyrics for this song.</p>
        </div>
      );
    }

    if (!lyrics.synced && lyrics.plain) {
        // Plain text fallback
        return (
            <div className="w-full h-full overflow-y-auto px-6 py-12 text-center no-scrollbar">
                <p className="text-white/80 whitespace-pre-wrap text-lg leading-relaxed font-medium">
                    {lyrics.plain}
                </p>
            </div>
        );
    }

    return (
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-auto px-6 py-[50vh] no-scrollbar mask-image-gradient"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div ref={scrollRef} className="flex flex-col gap-6 text-center">
            {lyrics.lines.map((line, i) => {
                const isActive = i === activeLineIndex;
                const isPast = i < activeLineIndex;

                return (
                    <motion.p
                        key={i}
                        layout
                        onClick={() => onSeek(line.time)}
                        className={`cursor-pointer transition-all duration-500 ease-out origin-center
                            ${isActive
                                ? 'text-white text-2xl md:text-3xl font-bold opacity-100 scale-100 blur-none'
                                : 'text-white/40 text-lg md:text-xl font-medium blur-[1px] hover:text-white/70 hover:blur-none'
                            }
                        `}
                        whileHover={{ scale: isActive ? 1.05 : 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {line.text}
                    </motion.p>
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
        className="absolute inset-0 z-20 flex flex-col bg-black/30 backdrop-blur-md rounded-2xl overflow-hidden"
    >
      {/* Header with Close option if needed, though toggle is usually outside */}
      {renderContent()}
    </motion.div>
  );
};

export default LyricsView;
