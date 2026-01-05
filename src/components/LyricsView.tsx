import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, Music2 } from 'lucide-react';
import { Track, LyricLine } from '../types'; // Assuming LyricWord is part of LyricLine
import { fetchLyrics } from '../utils/lyrics';

interface LyricsViewProps {
  track: Track;
  currentTime: number;
  onSeek: (time: number) => void;
  onClose: () => void;
  onTrackUpdate?: (track: Track) => void;
}

const LyricsView: React.FC<LyricsViewProps> = ({
  track,
  currentTime,
  onSeek,
  onClose,
  onTrackUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isWordSynced, setIsWordSynced] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State to track auto-scroll; ref is better for mute updates, but state forces re-render if needed
  const isAutoScrolling = useRef(true);
  const userScrollTimeout = useRef<NodeJS.Timeout | null>(null);

  // 1. Efficient Lyric Loading
  useEffect(() => {
    let isMounted = true;
    
    const loadLyrics = async () => {
      // Use cached lyrics if available
      if (track.lyrics && !track.lyrics.error && track.lyrics.lines.length > 0) {
        setLyrics(track.lyrics.lines);
        setIsWordSynced(!!track.lyrics.isWordSynced);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);
      
      try {
        const result = await fetchLyrics(track);
        if (isMounted) {
          if (result.error || result.lines.length === 0) {
            setError(true);
          } else {
            setLyrics(result.lines);
            setIsWordSynced(!!result.isWordSynced);
            if (onTrackUpdate) onTrackUpdate({ ...track, lyrics: result });
          }
        }
      } catch (err) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadLyrics();
    return () => { isMounted = false; };
  }, [track.id]);

  // 2. High Performance Active Line Calculation
  const activeLineIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    // findLastIndex is more efficient for this, but simple loop is fine for <200 lines
    // We iterate backwards to find the first line that satisfies the condition
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        return i;
      }
    }
    return -1;
  }, [currentTime, lyrics]);

  // 3. Smooth Auto-Scrolling
  useEffect(() => {
    if (!isAutoScrolling.current || activeLineIndex === -1 || !containerRef.current) return;

    const activeEl = document.getElementById(`lyric-line-${activeLineIndex}`);
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLineIndex]); // Only trigger when index changes, not every millisecond

  const handleUserInteraction = () => {
    isAutoScrolling.current = false;
    if (userScrollTimeout.current) clearTimeout(userScrollTimeout.current);
    
    // Resume auto-scroll after 3 seconds of inactivity
    userScrollTimeout.current = setTimeout(() => {
      isAutoScrolling.current = true;
    }, 3000);
  };

  const handleLineClick = (time: number) => {
    onSeek(time);
    isAutoScrolling.current = true; // Snap back immediately on click
  };

  // --- Render States ---

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white/50 gap-4">
        <Loader2 className="animate-spin w-8 h-8" />
        <span className="text-sm font-medium tracking-wide">Syncing Lyrics...</span>
      </div>
    );
  }

  if (error || lyrics.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white/50 gap-6 p-8">
        <div className="bg-white/10 p-6 rounded-full backdrop-blur-md">
          <Music2 className="w-12 h-12 opacity-50" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium text-white">Lyrics not available</h3>
          <p className="text-sm text-white/40 max-w-xs mx-auto">
            We couldn't fetch the lyrics for this track. It might be instrumental.
          </p>
        </div>
        <button 
          onClick={onClose}
          className="px-8 py-3 rounded-full bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
        >
          Close View
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full overflow-y-auto no-scrollbar scroll-smooth py-[50vh] px-6 text-center"
      onWheel={handleUserInteraction}
      onTouchMove={handleUserInteraction}
      onPointerDown={(e) => e.stopPropagation()} 
    >
      <div className="max-w-3xl mx-auto flex flex-col">
        {lyrics.map((line, index) => {
          const isActive = index === activeLineIndex;
          const isPast = index < activeLineIndex;

          return (
            <motion.div
              id={`lyric-line-${index}`}
              key={index}
              initial={false}
              animate={{ 
                scale: isActive ? 1 : 0.95,
                opacity: isActive ? 1 : isPast ? 0.3 : 0.3,
                y: 0,
                filter: isActive ? 'blur(0px)' : 'blur(1.5px)'
              }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={`
                py-4 cursor-pointer transition-colors duration-300
                ${isActive ? 'text-white' : 'text-white/60 hover:text-white/90'}
              `}
              onClick={() => handleLineClick(line.time)}
            >
              <div className={`
                text-2xl md:text-3xl lg:text-4xl font-bold leading-tight tracking-tight
                ${isActive ? 'bg-gradient-to-r from-white to-white/90 bg-clip-text' : ''}
              `}>
                {isWordSynced && line.words ? (
                  // FIXED: Use standard text flow instead of Flex gap
                  <span className="inline-block">
                    {line.words.map((word, wIdx) => {
                      const isWordActive = currentTime >= word.time;
                      return (
                        <React.Fragment key={wIdx}>
                          <motion.span
                            animate={{ 
                              opacity: isWordActive ? 1 : 0.3,
                            }}
                            transition={{ duration: 0.1 }}
                            className="inline-block" // Allows transform but keeps text flow
                          >
                            {word.text}
                          </motion.span>
                          {/* Add a natural space between words unless it's the last one */}
                          {wIdx < line.words.length - 1 && " "}
                        </React.Fragment>
                      );
                    })}
                  </span>
                ) : (
                  <span>{line.text}</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default LyricsView;
