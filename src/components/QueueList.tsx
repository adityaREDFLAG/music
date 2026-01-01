import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { Track } from '../types';
import { Play, X, GripVertical } from 'lucide-react';

interface QueueListProps {
  queue: string[];
  currentTrackId: string | null;
  tracks: Record<string, Track>;
  onReorder: (newQueue: string[]) => void;
  onPlay: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  onClose?: () => void;
}

const QueueItem = ({ track, isCurrent, onPlay, onRemove }: { track: Track; isCurrent: boolean; onPlay: () => void; onRemove: () => void }) => {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={track.id}
      id={track.id}
      className={`flex items-center gap-3 p-2 rounded-xl mb-2 transition-colors ${isCurrent ? 'bg-white/10' : 'hover:bg-white/5'} group touch-none`}
      dragListener={false}
      dragControls={controls}
    >
      <div
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-white/30 hover:text-white"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical size={16} />
      </div>

      <div
        className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
        onClick={onPlay}
      >
          <img src={track.coverArt} className={`w-full h-full object-cover ${isCurrent ? 'opacity-50' : ''}`} alt={track.title} />
          {isCurrent && (
             <div className="absolute inset-0 flex items-center justify-center">
                 <Play size={16} className="text-white fill-white" />
             </div>
          )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer" onClick={onPlay}>
        <h4 className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : 'text-white'}`}>
          {track.title}
        </h4>
        <p className="text-xs text-white/50 truncate">
          {track.artist}
        </p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="p-2 text-white/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={16} />
      </button>
    </Reorder.Item>
  );
};

const QueueList: React.FC<QueueListProps> = ({ queue, currentTrackId, tracks, onReorder, onPlay, onRemove, onClose }) => {
  if (!queue || queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white/30">
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

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-lg font-bold text-white">Up Next</h3>
        {onClose && (
            <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
              <X size={20} className="text-white" />
            </button>
        )}
      </div>
      <Reorder.Group
        axis="y"
        values={queue}
        onReorder={onReorder}
        className="flex-1 overflow-y-auto px-1 pb-20 no-scrollbar"
      >
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
      </Reorder.Group>
    </div>
  );
};

export default QueueList;
