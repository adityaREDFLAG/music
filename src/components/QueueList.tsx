import React, { useEffect, useRef } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Track } from '../types';
import { Play, X, GripVertical, ArrowUpToLine } from 'lucide-react';

interface QueueListProps {
  queue: string[];
  currentTrackId: string | null;
  tracks: Record<string, Track>;
  onReorder: (newQueue: string[]) => void;
  onPlay: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  onPlayNext: (trackId: string) => void;
  onClose?: () => void;
}

const QueueItem = ({
  track,
  isCurrent,
  onPlay,
  onRemove,
  onPlayNext,
  isHistory,
  canDrag
}: {
  track: Track;
  isCurrent: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onPlayNext?: () => void;
  isHistory?: boolean;
  canDrag?: boolean;
}) => {
  const controls = useDragControls();

  // If it's a history item or current, we don't use Reorder.Item (or we disable drag)
  // But Reorder.Group requires Reorder.Item direct children usually.
  // Actually, we are only using Reorder.Group for the upcoming list.
  // So History items can be simple divs.

  const content = (
    <>
      {canDrag ? (
        <div
          className="touch-none cursor-grab active:cursor-grabbing p-1 text-white/30 hover:text-white"
          onPointerDown={(e) => controls.start(e)}
        >
          <GripVertical size={16} />
        </div>
      ) : (
        <div className="w-6" /> // Spacer
      )}

      <div
        className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group-hover:opacity-80 transition-opacity"
        onClick={onPlay}
      >
          <img src={track.coverArt} className={`w-full h-full object-cover ${isCurrent ? 'opacity-50' : ''} ${isHistory ? 'grayscale opacity-60' : ''}`} alt={track.title} />
          {isCurrent && (
             <div className="absolute inset-0 flex items-center justify-center">
                 <Play size={16} className="text-white fill-white" />
             </div>
          )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer" onClick={onPlay}>
        <h4 className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : isHistory ? 'text-white/50' : 'text-white'}`}>
          {track.title}
        </h4>
        <p className="text-xs text-white/50 truncate">
          {track.artist}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onPlayNext && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlayNext(); }}
            className="p-2 text-white/30 hover:text-white"
            title="Play Next"
          >
            <ArrowUpToLine size={16} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-2 text-white/30 hover:text-red-500"
          title="Remove"
        >
          <X size={16} />
        </button>
      </div>
    </>
  );

  if (canDrag) {
    return (
      <Reorder.Item
        value={track.id}
        id={track.id}
        className={`flex items-center gap-3 p-2 rounded-xl mb-2 transition-colors hover:bg-white/5 group touch-none bg-black/20`}
        dragListener={false}
        dragControls={controls}
      >
        {content}
      </Reorder.Item>
    );
  }

  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl mb-2 transition-colors ${isCurrent ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/5'} group`}>
      {content}
    </div>
  );
};

const QueueList: React.FC<QueueListProps> = ({ queue, currentTrackId, tracks, onReorder, onPlay, onRemove, onPlayNext, onClose }) => {
  const historyRef = useRef<HTMLDivElement>(null);

  if (!queue || queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/30">
         {/* Close Header */}
        <div className="flex w-full justify-between items-center px-4 mb-4 absolute top-4">
          <h3 className="text-lg font-bold text-white">Queue</h3>
          {onClose && (
            <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
              <X size={20} className="text-white" />
            </button>
          )}
        </div>
        <p>Queue is empty</p>
      </div>
    );
  }

  // Calculate split
  const currentIndex = queue.indexOf(currentTrackId || '');
  // If current not in queue (shouldn't happen often), assume start
  const splitIndex = currentIndex === -1 ? 0 : currentIndex;

  const history = queue.slice(0, splitIndex);
  const current = queue[splitIndex]; // string id
  const upcoming = queue.slice(splitIndex + 1);

  // Handlers
  const handleReorderUpcoming = (newUpcoming: string[]) => {
    const newQueue = [...history, current, ...newUpcoming];
    onReorder(newQueue);
  };

  const handlePlayNext = (trackId: string) => {
    onPlayNext(trackId);
  };

  // Scroll history to bottom on mount so we see the most recent history
  useEffect(() => {
    if (historyRef.current) {
        historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, []); // Only on mount

  return (
    <div className="h-full flex flex-col relative">
       {/* Header with Close */}
       <div className="flex items-center justify-between mb-2 px-2 shrink-0">
        <h3 className="text-lg font-bold text-white">Queue</h3>
        {onClose && (
            <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
              <X size={20} className="text-white" />
            </button>
        )}
      </div>

      {/* History Section (Scrollable) */}
      <div
        ref={historyRef}
        className="flex-1 overflow-y-auto min-h-0 px-2 no-scrollbar fade-top-mask"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex flex-col justify-end min-h-full pb-2">
            {history.length > 0 && (
                <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2 px-2 mt-4">History</div>
            )}
            {history.map((trackId, i) => {
                const track = tracks[trackId];
                if (!track) return null;
                // Unique key: trackId + index to support duplicates properly if needed,
                // but Reorder requires unique keys matching values.
                // Since history isn't reorderable here, we can use index.
                return (
                    <QueueItem
                        key={`${trackId}-${i}`}
                        track={track}
                        isCurrent={false}
                        isHistory={true}
                        onPlay={() => onPlay(trackId)}
                        onRemove={() => onRemove(trackId)}
                        onPlayNext={() => handlePlayNext(trackId)}
                    />
                );
            })}
        </div>
      </div>

      {/* Current Track (Fixed/Sticky Center) */}
      <div className="shrink-0 z-20 my-1 px-2">
         {current && tracks[current] ? (
             <div className="shadow-xl shadow-black/50 rounded-xl overflow-hidden backdrop-blur-md bg-white/5 border border-white/10">
                 <div className="px-3 py-1 text-xs font-bold text-primary uppercase tracking-wider bg-black/20">Now Playing</div>
                 <QueueItem
                    track={tracks[current]}
                    isCurrent={true}
                    onPlay={() => {}} // Usually clicking current doesn't restart unless specific
                    onRemove={() => onRemove(current)}
                    // No play next for current
                 />
             </div>
         ) : null}
      </div>

      {/* Upcoming Section (Scrollable & Reorderable) */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2 no-scrollbar pb-20">
         {upcoming.length > 0 && (
            <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-2 px-2 mt-2">Up Next</div>
         )}
         <Reorder.Group
            axis="y"
            values={upcoming}
            onReorder={handleReorderUpcoming}
            className="min-h-[50px]"
         >
            {upcoming.map((trackId) => {
                const track = tracks[trackId];
                if (!track) return null;
                return (
                    <QueueItem
                        key={trackId}
                        track={track}
                        isCurrent={false}
                        canDrag={true}
                        onPlay={() => onPlay(trackId)}
                        onRemove={() => onRemove(trackId)}
                        onPlayNext={() => handlePlayNext(trackId)}
                    />
                );
            })}
         </Reorder.Group>
         {upcoming.length === 0 && (
             <div className="text-white/20 text-center py-8 text-sm italic">
                 End of queue
             </div>
         )}
      </div>
    </div>
  );
};

export default QueueList;
