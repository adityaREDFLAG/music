import React from 'react';
import { motion, Reorder } from 'framer-motion';
import { Track } from '../types';
import { Music, GripVertical } from 'lucide-react';

interface QueueListProps {
  queue: string[];
  currentTrackId: string | null;
  tracks: Record<string, Track>;
  onReorder: (newQueue: string[]) => void;
  onPlay: (trackId: string) => void;
}

const QueueList: React.FC<QueueListProps> = ({ queue, currentTrackId, tracks, onReorder, onPlay }) => {
  // Find index of current track to scroll to it or highlight it
  const currentIndex = queue.indexOf(currentTrackId || '');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <h3 className="text-title-medium font-bold text-on-surface mb-4 px-4">Up Next</h3>

      <Reorder.Group
        axis="y"
        values={queue}
        onReorder={onReorder}
        className="flex-1 overflow-y-auto px-2 pb-20 no-scrollbar"
      >
        {queue.map((trackId) => {
          const track = tracks[trackId];
          if (!track) return null;
          const isCurrent = trackId === currentTrackId;

          return (
            <Reorder.Item
              key={trackId}
              value={trackId}
              className={`flex items-center gap-3 p-2 rounded-xl mb-1 ${isCurrent ? 'bg-primary/20' : 'bg-surface-variant/30'}`}
            >
               <div className="cursor-grab active:cursor-grabbing text-on-surface/30 hover:text-on-surface">
                   <GripVertical size={20} />
               </div>

               <div onClick={() => onPlay(trackId)} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                    <div className="w-10 h-10 rounded-lg bg-surface-variant-dim overflow-hidden flex-shrink-0">
                        {track.coverArt ? (
                            <img src={track.coverArt} className="w-full h-full object-cover" />
                        ) : (
                            <Music className="w-5 h-5 m-2.5 text-on-surface/40" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>
                            {track.title}
                        </p>
                        <p className="text-xs text-on-surface/60 truncate">{track.artist}</p>
                    </div>
               </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </div>
  );
};

export default QueueList;
