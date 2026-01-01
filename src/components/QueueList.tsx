import React, { memo, useEffect, useRef } from 'react';
import { Reorder, useDragControls, useMotionValue, AnimatePresence, motion } from 'framer-motion';
import { Track } from '../types';
import { Play, X, GripVertical, Trash2 } from 'lucide-react';

interface QueueListProps {
  queue: string[];
  currentTrackId: string | null;
  tracks: Record<string, Track>;
  onReorder: (newQueue: string[]) => void;
  onPlay: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  onClose?: () => void;
  onClear?: () => void;
}

const PlayingIndicator = () => (
  <div className="flex items-end justify-center gap-[2px] h-3 w-3">
    {[1, 2, 3].map((bar) => (
      <motion.div
        key={bar}
        className="w-1 bg-green-400"
        animate={{ height: [4, 12, 4] }}
        transition={{
          duration: 0.6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: bar * 0.1,
        }}
      />
    ))}
  </div>
);

interface QueueItemProps {
  track: Track;
  isCurrent: boolean;
  onPlay: () => void;
  onRemove: () => void;
}

const QueueItem = memo(({ track, isCurrent, onPlay, onRemove }: QueueItemProps) => {
  const controls = useDragControls();
  const y = useMotionValue(0);
  
  // 1. Create a ref to access the DOM element
  const itemRef = useRef<HTMLDivElement>(null);

  // 2. Auto-scroll effect
  useEffect(() => {
    if (isCurrent && itemRef.current) {
      // Small timeout ensures the layout is ready before scrolling
      setTimeout(() => {
        itemRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center', // Centers the song in the visible area
        });
      }, 100);
    }
  }, [isCurrent]);

  return (
    <Reorder.Item
      value={track.id}
      id={track.id}
      ref={itemRef} // 3. Attach the ref here
      style={{ y }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileDrag={{ scale: 1.02, boxShadow: "0px 10px 20px rgba(0,0,0,0.3)", zIndex: 50 }}
      className={`
        relative flex items-center gap-3 p-2 rounded-xl mb-2 group overflow-hidden
        transition-colors border border-transparent
        ${isCurrent ? 'bg-white/10 border-white/5' : 'hover:bg-white/5'}
      `}
      dragListener={false}
      dragControls={controls}
    >
      <div
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-white/20 hover:text-white/80 transition-colors"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical size={16} />
      </div>

      <div
        className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group/art"
        onClick={onPlay}
      >
        <img
          src={track.coverArt}
          className={`w-full h-full object-cover transition-all duration-300 ${isCurrent ? 'opacity-40 blur-[1px]' : 'group-hover/art:scale-110'}`}
          alt={track.title}
        />
        
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover/art:opacity-100 bg-black/40'}`}>
          {isCurrent ? <PlayingIndicator /> : <Play size={16} className="text-white fill-white" />}
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer" onClick={onPlay}>
        <h4 className={`text-sm font-semibold truncate transition-colors ${isCurrent ? 'text-green-400' : 'text-white'}`}>
          {track.title}
        </h4>
        <p className="text-xs text-zinc-400 truncate group-hover:text-zinc-300">
          {track.artist}
        </p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"
      >
        <X size={16} />
      </button>
    </Reorder.Item>
  );
});

QueueItem.displayName = 'QueueItem';

const QueueList: React.FC<QueueListProps> = ({ queue, currentTrackId, tracks, onReorder, onPlay, onRemove, onClose, onClear }) => {
  if (!queue || queue.length === 0) {
    return (
      <div className="flex flex-col h-full bg-zinc-900/90 backdrop-blur-xl border-l border-white/5">
        <div className="flex w-full justify-between items-center p-4 border-b border-white/5">
          <h3 className="text-lg font-bold text-white tracking-tight">Queue</h3>
          {onClose && (
            <button onClick={onClose} className="p-2 text-white/50 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          )}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-white/20 gap-4">
          <div className="p-4 bg-white/5 rounded-full">
            <Play size={32} className="ml-1" />
          </div>
          <p className="font-medium">Queue is empty</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900/95 backdrop-blur-xl border-l border-white/5">
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900/50 z-10">
        <div className="flex items-center gap-2">
           <h3 className="text-lg font-bold text-white tracking-tight">Up Next</h3>
           <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 font-mono">
             {queue.length}
           </span>
        </div>
        <div className="flex gap-1">
          {onClear && (
            <button 
                onClick={onClear} 
                className="p-2 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Clear Queue"
            >
                <Trash2 size={18} />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <Reorder.Group
        axis="y"
        values={queue}
        onReorder={onReorder}
        // overflow-y-auto ensures the container itself is scrollable
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {queue.map((trackId) => {
            const track = tracks[trackId];
            if (!track) return null;
            return (
              <QueueItem
                key={trackId}
                track={track}
                isCurrent={trackId === currentTrackId}
                onPlay={() => onPlay(trackId)}
                onRemove={() => onRemove(trackId)}
              />
            );
          })}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  );
};

export default QueueList;
