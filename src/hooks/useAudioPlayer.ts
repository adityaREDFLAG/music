import { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../db';
import { Track, PlayerState, RepeatMode } from '../types';

export const useAudioPlayer = (
  libraryTracks: Record<string, Track>,
  updateMediaSession: (track: Track) => void
) => {
  // --- STATE ---
  const [player, setPlayer] = useState<PlayerState>({
    currentTrackId: null,
    isPlaying: false,
    queue: [],
    originalQueue: [],
    history: [],
    shuffle: false,
    repeat: RepeatMode.OFF,
    volume: 1,
    crossfadeEnabled: false, // Inert but kept for type compatibility
    crossfadeDuration: 5,
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- AUDIO ARCHITECTURE (SINGLE OWNER) ---
  // Exactly one persistent audio element created once.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const saveState = useCallback((state: PlayerState) => {
    dbService.setSetting('playerState', state);
  }, []);

  const shuffleArray = (array: string[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // --- INITIALIZATION ---

  // Initialize audio element once on mount
  useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      a.playsInline = true; // iOS Safari Fix
      audioRef.current = a;
    }

    // Load persisted state
    dbService.getSetting<PlayerState>('playerState').then(saved => {
      if (saved) {
        setPlayer(prev => ({
           ...prev,
           ...saved,
           isPlaying: false // Always start paused to respect autoplay policies
        }));
        
        // Restore last track (Paused)
        if (saved.currentTrackId) {
             dbService.getAudioBlob(saved.currentTrackId).then(blob => {
                 if (blob && audioRef.current) {
                     // Only set src if not already set (should be empty on init)
                     const url = URL.createObjectURL(blob);
                     audioRef.current.src = url;
                     audioRef.current.currentTime = 0;
                 }
             });
        }
      }
    });

    // Cleanup on unmount (rarely happens in this app structure)
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Sync Master Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = player.volume;
    }
  }, [player.volume]);

  // Save state on change
  useEffect(() => {
    saveState(player);
  }, [player, saveState]);


  // --- CORE LOGIC: PLAY TRACK ---

  const playTrack = useCallback(async (trackId: string, options: {
    immediate?: boolean;
    fromQueue?: boolean;
    customQueue?: string[];
  } = {}) => {
    const { immediate = true, fromQueue = false, customQueue } = options;
    const audio = audioRef.current;
    if (!audio) return;

    try {
      // 1. Update Queue State
      setPlayer(prev => {
        let newQueue = prev.queue;
        let newOriginalQueue = prev.originalQueue;

        if (customQueue) {
          // New Playlist/Context
          newQueue = [...customQueue];
          newOriginalQueue = [...customQueue];
          if (prev.shuffle) {
             const others = customQueue.filter(id => id !== trackId);
             newQueue = [trackId, ...shuffleArray(others)];
          }
        } else if (!fromQueue) {
             // "Play Next" / Injection Logic
             if (prev.queue.length === 0) {
                 newQueue = [trackId];
                 newOriginalQueue = [trackId];
             } else {
                 const currentIdx = prev.queue.indexOf(prev.currentTrackId || '');
                 const filteredQueue = prev.queue.filter(id => id !== trackId);
                 
                 // If playing same song, keep it; otherwise insert after current
                 if (prev.currentTrackId === trackId) {
                      newQueue = [trackId, ...filteredQueue];
                 } else {
                      const newCurrentIdx = filteredQueue.indexOf(prev.currentTrackId || '');
                      const q = [...filteredQueue];
                      q.splice(newCurrentIdx + 1, 0, trackId);
                      newQueue = q;
                 }

                 if (!prev.originalQueue.includes(trackId)) {
                     newOriginalQueue = [...prev.originalQueue, trackId];
                 }
             }
        }

        // Update Media Session
        const track = libraryTracks[trackId];
        if (track) updateMediaSession(track);

        return {
          ...prev,
          currentTrackId: trackId,
          queue: newQueue,
          originalQueue: newOriginalQueue,
          isPlaying: true // Optimistic UI update
        };
      });

      // 2. Handle Audio Playback
      if (immediate) {
        const audioBlob = await dbService.getAudioBlob(trackId);
        if (!audioBlob) {
          console.error(`Audio blob not found for ${trackId}`);
          return;
        }

        // Revoke old object URL if possible to avoid leaks?
        // JS garbage collection handles it eventually, but cleaner to just replace src.
        // We do NOT use load().
        const url = URL.createObjectURL(audioBlob);

        // Change src only if different or strictly needed
        // Assuming we always want to restart if playTrack is called, even for same track
        audio.src = url;
        audio.currentTime = 0;
        await audio.play();
      }

    } catch (e) {
      console.error("Playback error", e);
      setPlayer(p => ({ ...p, isPlaying: false }));
    }
  }, [libraryTracks, updateMediaSession]);

  // --- CONTROLS ---

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (player.isPlaying) {
        audio.pause();
        setPlayer(p => ({ ...p, isPlaying: false }));
    } else {
        audio.play().catch(console.error);
        setPlayer(p => ({ ...p, isPlaying: true }));
    }
  }, [player.isPlaying]);

  const nextTrack = useCallback(() => {
     // Determine Next Track
     const currentIndex = player.queue.indexOf(player.currentTrackId || '');
     let nextId: string | null = null;

     if (currentIndex >= 0 && currentIndex < player.queue.length - 1) {
         nextId = player.queue[currentIndex + 1];
     } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
         nextId = player.queue[0];
     }

     if (nextId) {
         playTrack(nextId, { immediate: true, fromQueue: true });
     }
  }, [player.queue, player.currentTrackId, player.repeat, playTrack]);

  const prevTrack = useCallback(() => {
      const audio = audioRef.current;
      // "Restart Song" logic
      if (audio && audio.currentTime > 3) {
          audio.currentTime = 0;
          return;
      }
      
      // "Previous Song" logic
      const currentIndex = player.queue.indexOf(player.currentTrackId || '');
      if (currentIndex > 0) {
          playTrack(player.queue[currentIndex - 1], { immediate: true, fromQueue: true });
      } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
          playTrack(player.queue[player.queue.length - 1], { immediate: true, fromQueue: true });
      }
  }, [player.queue, player.currentTrackId, player.repeat, playTrack]);

  // CRITICAL FIX: Seek
  const handleSeek = useCallback((time: number) => {
      const audio = audioRef.current;
      if (audio) {
          // 1. Mutate Audio (Source of Truth)
          audio.currentTime = time;
          // 2. Update React State immediately
          setCurrentTime(time);
      }
  }, []);

  const toggleShuffle = useCallback(() => {
      setPlayer(prev => {
          const isShuffling = !prev.shuffle;
          let newQueue = [...prev.queue];

          if (isShuffling) {
              const currentId = prev.currentTrackId;
              const others = prev.originalQueue.filter(id => id !== currentId);
              const shuffledOthers = shuffleArray(others);
              if (currentId) {
                  newQueue = [currentId, ...shuffledOthers];
              } else {
                  newQueue = shuffledOthers;
              }
          } else {
              newQueue = [...prev.originalQueue];
          }

          dbService.setSetting('shuffle', isShuffling);
          return { ...prev, shuffle: isShuffling, queue: newQueue };
      });
  }, []);

  // --- EVENT LISTENERS ---

  useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const onTimeUpdate = () => {
         // One-way sync: Audio -> UI
         setCurrentTime(audio.currentTime);
      };

      const onDurationChange = () => {
         setDuration(audio.duration);
      };
      
      const onEnded = () => {
           if (player.repeat === RepeatMode.ONE) {
               audio.currentTime = 0;
               audio.play();
           } else {
               nextTrack();
           }
      };

      const onPause = () => setPlayer(p => ({ ...p, isPlaying: false }));
      const onPlay = () => setPlayer(p => ({ ...p, isPlaying: true }));

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('loadedmetadata', onDurationChange);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('pause', onPause);
      audio.addEventListener('play', onPlay);

      return () => {
          audio.removeEventListener('timeupdate', onTimeUpdate);
          audio.removeEventListener('loadedmetadata', onDurationChange);
          audio.removeEventListener('ended', onEnded);
          audio.removeEventListener('pause', onPause);
          audio.removeEventListener('play', onPlay);
      };
  }, [nextTrack, player.repeat]);

  // --- MEDIA SESSION INTEGRATION ---
  useEffect(() => {
      if ('mediaSession' in navigator) {
          navigator.mediaSession.setActionHandler('play', togglePlay);
          navigator.mediaSession.setActionHandler('pause', togglePlay);
          navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
          navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
          navigator.mediaSession.setActionHandler('seekto', (details) => {
              if (details.seekTime !== undefined) handleSeek(details.seekTime);
          });
      }
  }, [togglePlay, prevTrack, nextTrack, handleSeek]);

  return {
    player,
    setPlayer,
    currentTime,
    duration,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    handleSeek,
    toggleShuffle
  };
};
