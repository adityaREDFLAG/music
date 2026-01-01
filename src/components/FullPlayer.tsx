import React, { useState, useEffect } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useDragControls,
} from 'framer-motion';
import {
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  ListMusic,
} from 'lucide-react';
import { Track, PlayerState, RepeatMode } from '../types';
import QueueList from './QueueList';
import { dbService } from '../db';

interface FullPlayerProps {
  currentTrack: Track | null;
  playerState: PlayerState;
  isPlayerOpen: boolean;
  onClose: () => void;
  togglePlay: () => void;
  playTrack: (id: string, options?: any) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
  currentTime: number;
  duration: number;
  handleSeek: (e: any) => void;
  toggleShuffle: () => void;
  onRemoveTrack: (trackId: string) => void;
}

const formatTime = (time: number) => {
  if (!time || isNaN(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const FullPlayer: React.FC<FullPlayerProps> = ({
  currentTrack,
  playerState,
  isPlayerOpen,
  onClose,
  togglePlay,
  playTrack,
  nextTrack,
  prevTrack,
  setPlayerState,
  currentTime,
  duration,
  handleSeek,
  toggleShuffle,
  onRemoveTrack,
}) => {
  const [showQueue, setShowQueue] = useState(false);
  const [tracks, setTracks] = useState<Record<string, Track>>({});
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const dragControls = useDragControls();
  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 200], [1, 0]);

  const windowHeight =
    typeof window !== 'undefined' ? window.innerHeight : 1000;

  /* reset drag */
  useEffect(() => {
    dragY.set(0);
  }, [isPlayerOpen]);

  /* sync slider when NOT scrubbing */
  useEffect(() => {
    if (!isScrubbing) {
      setScrubValue(currentTime);
    }
  }, [currentTime, isScrubbing]);

  /* load tracks for queue */
  useEffect(() => {
    if (!isPlayerOpen) return;
    (async () => {
      const all = await dbService.getAllTracks();
      const map: Record<string, Track> = {};
      all.forEach(t => (map[t.id] = t));
      setTracks(map);
    })();
  }, [isPlayerOpen]);

  if (!currentTrack) return null;

  const toggleRepeat = () => {
    const modes: RepeatMode[] = ['OFF', 'ALL', 'ONE'];
    const next =
      modes[(modes.indexOf(playerState.repeat) + 1) % modes.length];
    setPlayerState(p => ({ ...p, repeat: next }));
    dbService.setSetting('repeat', next);
  };

  /* 🔥 LIVE SCRUB HANDLERS (THIS IS THE FIX) */
  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setScrubValue(value);

    // seek immediately while dragging
    handleSeek({ target: { value } });
  };

  const handleScrubStart = () => {
    setIsScrubbing(true);
  };

  const handleScrubEnd = () => {
    setIsScrubbing(false);
  };

  return (
    <AnimatePresence>
      {isPlayerOpen && (
        <motion.div
          key="player"
          initial={{ y: windowHeight }}
          animate={{ y: 0 }}
          exit={{ y: windowHeight }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.12}
          style={{ opacity }}
          onDrag={(_, i) => dragY.set(i.offset.y)}
          onDragEnd={(_, i) => {
            if (i.offset.y > 150) onClose();
            else dragY.set(0);
          }}
          className="fixed inset-0 z-[100] bg-black flex flex-col"
        >
          {/* background */}
          <div className="absolute inset-0 -z-10">
            <img
              src={currentTrack.coverArt}
              className="w-full h-full object-cover blur-[120px] scale-125 opacity-40"
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>

          {/* drag handle */}
          <div
            onPointerDown={e => dragControls.start(e)}
            className="h-14 flex items-center justify-center"
          >
            <div className="w-12 h-1.5 bg-white/30 rounded-full" />
          </div>

          <main className="flex-1 px-6 pb-10 flex flex-col">
            {!showQueue && (
              <>
                <div className="flex-1 flex items-center justify-center">
                  <img
                    src={currentTrack.coverArt}
                    className="w-full max-w-sm aspect-square rounded-3xl shadow-2xl"
                  />
                </div>

                <div className="text-center mt-6">
                  <h1 className="text-2xl font-bold text-white truncate">
                    {currentTrack.title}
                  </h1>
                  <p className="text-white/50 truncate">
                    {currentTrack.artist}
                  </p>
                </div>
              </>
            )}

            {showQueue && (
              <div className="flex-1 overflow-y-auto bg-white/5 rounded-3xl p-4 backdrop-blur">
                <QueueList
                  queue={playerState.queue}
                  currentTrackId={currentTrack.id}
                  tracks={tracks}
                  onPlay={id => playTrack(id, { fromQueue: true })}
                  onRemove={onRemoveTrack}
                  onReorder={q =>
                    setPlayerState(p => ({ ...p, queue: q }))
                  }
                  onClose={() => setShowQueue(false)}
                />
              </div>
            )}

            {/* 🔥 SLIDER */}
            <div className="mt-8">
              <div className="relative h-1.5 bg-white/10 rounded-full">
                <div
                  className="absolute h-full bg-white rounded-full"
                  style={{
                    width: `${
                      (scrubValue / Math.max(duration, 0.01)) * 100
                    }%`,
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 0.01)}
                  step={0.01}
                  value={scrubValue}
                  onChange={handleScrubChange}
                  onPointerDown={handleScrubStart}
                  onPointerUp={handleScrubEnd}
                  onTouchEnd={handleScrubEnd}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer"
                />
              </div>

              <div className="flex justify-between text-xs text-white/40 mt-2 font-mono">
                <span>{formatTime(scrubValue)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* controls */}
            <div className="flex items-center justify-between mt-6">
              <button onClick={toggleShuffle}>
                <Shuffle
                  className={
                    playerState.shuffle ? 'text-white' : 'text-white/40'
                  }
                />
              </button>

              <div className="flex items-center gap-8">
                <button onClick={prevTrack}>
                  <SkipBack size={32} fill="white" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-20 h-20 bg-white rounded-full flex items-center justify-center"
                >
                  {playerState.isPlaying ? (
                    <Pause fill="black" />
                  ) : (
                    <Play fill="black" className="ml-1" />
                  )}
                </button>
                <button onClick={nextTrack}>
                  <SkipForward size={32} fill="white" />
                </button>
              </div>

              <button onClick={toggleRepeat}>
                <Repeat
                  className={
                    playerState.repeat !== 'OFF'
                      ? 'text-white'
                      : 'text-white/40'
                  }
                />
              </button>
            </div>

            <div className="flex justify-center mt-6">
              <button onClick={() => setShowQueue(v => !v)}>
                <ListMusic className="text-white" />
              </button>
            </div>
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FullPlayer;
