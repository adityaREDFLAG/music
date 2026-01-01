import React from 'react';
import { motion, Reorder, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Track } from '../types';
import { Music, GripVertical, Volume2, Trash2 } from 'lucide-react';

interface QueueListProps {
  queue: string[];
  currentTrackId: string | null;
  tracks: Record<string, Track>;
  onReorder: (newQueue: string[]) => void;
  onPlay: (trackId: string) => void;
  onRemove?: (trackId: string) => void; // New prop for removal logic
}

const QueueItem = ({ trackId, track, isCurrent, onPlay, onRemove }: any) => {
  const x = useMotionValue(0);
  // Maps the drag distance to an opacity for the background delete icon
  const iconOpacity = useTransform(x, [-100, -50, 0], [1, 0.5, 0]);
  const backgroundColor = useTransform(x, [-100, 0], ['#ef4444', 'rgba(255,255,255,0)']);

  const handleDragEnd = (_: any, info: any) => {
    // If dragged more than 100px to the left, trigger removal
    if (info.offset.x < -100 && onRemove) {
      onRemove(trackId);
    }
  };

  if (!track) return null;

  return (
    <Reorder.Item
      value={trackId}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      whileDrag={{ scale: 1.03, zIndex: 50 }}
      className="relative overflow-hidden rounded-2xl mb-2"
    >
      {/* Background Delete Layer */}
      <motion.div 
        style={{ backgroundColor }}
        className="absolute inset-0 flex items-center justify-end px-6 rounded-2xl"
      >
        <motion.div style={{ opacity: iconOpacity }}>
          <Trash2 size={20} className="text-white" />
        </motion.div>
      </motion.div>

      {/* Foreground Content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={`relative flex items-center gap-3 p-3 rounded-2xl bg-surface/90 backdrop-blur-md border border-white/5 transition-colors ${
          isCurrent ? 'bg-white/10' : 'hover:bg-white/5'
        }`}
      >
        <div onClick={() => onPlay(trackId)} className="flex items-center gap-4 flex-1 min-w-0 cursor-pointer">
          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
            {track.coverArt ? (
              <img src={track.coverArt} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Music className="w-5 h-5 text-white/20" /></div>
            )}
            {isCurrent && (
              <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                <Volume2 size={18} className="text-white animate-pulse" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-[15px] font-bold truncate ${isCurrent ? 'text-primary' : 'text-white'}`}>
              {track.title}
            </p>
            <p className="text-[13px] text-white/50 truncate font-medium">{track.artist}</p>
          </div>
        </div>

        {/* Drag Handle for Reordering */}
        <div className="cursor-grab active:cursor-grabbing p-2 text-white/20 group-hover:text-white/60">
          <GripVertical size={20} />
        </div>
      </motion.div>
    </Reorder.Item>
  );
};

const QueueList: React.FC<QueueListProps> = ({ queue, currentTrackId, tracks, onReorder, onPlay, onRemove }) => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="pt-6 pb-2 px-6 sticky top-0 z-20">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Up Next</h3>
      </div>

      <Reorder.Group
        axis="y"
        values={queue}
        onReorder={onReorder}
        className="flex-1 overflow-y-auto px-4 pb-24 scrollbar-hide"
      >
        <AnimatePresence mode="popLayout">
          {queue.map((trackId) => (
            <QueueItem
              key={trackId}
              trackId={trackId}
              track={tracks[trackId]}
              isCurrent={trackId === currentTrackId}
              onPlay={onPlay}
              onRemove={onRemove}
            />
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </div>
  );
};

export default QueueList;
