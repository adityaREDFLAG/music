import { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../db';
import { Track, PlayerState, RepeatMode } from '../types';

const FADE_INTERVAL = 50; // ms for volume updates during crossfade

export const useAudioPlayer = (
  libraryTracks: Record<string, Track>,
  updateMediaSession: (track: Track) => void
) => {
  // State
  const [player, setPlayer] = useState<PlayerState>({
    currentTrackId: null,
    isPlaying: false,
    queue: [],
    originalQueue: [],
    history: [],
    shuffle: false,
    repeat: RepeatMode.OFF,
    volume: 1,
    crossfadeEnabled: false,
    crossfadeDuration: 5,
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Refs for Audio Elements (Double Buffer)
  const audio1Ref = useRef<HTMLAudioElement | null>(null);
  const audio2Ref = useRef<HTMLAudioElement | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null); // Points to currently dominant audio
  const fadeIntervalRef = useRef<any>(null);
  const nextTrackStartedRef = useRef<boolean>(false); // Prevent multiple triggers
  const isTransitioningRef = useRef<boolean>(false);

  // Helper: Get Audio Elements
  const getAudioElements = () => {
    return {
      primary: activeAudioRef.current === audio1Ref.current ? audio1Ref.current : audio2Ref.current,
      secondary: activeAudioRef.current === audio1Ref.current ? audio2Ref.current : audio1Ref.current
    };
  };

  // Helper: Persist State
  const saveState = useCallback((state: PlayerState) => {
    dbService.setSetting('playerState', state);
  }, []);

  // Initialize Audio Elements
  useEffect(() => {
    const initAudio = () => {
      const a = new Audio();
      a.preload = 'auto';
      return a;
    };
    audio1Ref.current = initAudio();
    audio2Ref.current = initAudio();
    activeAudioRef.current = audio1Ref.current;

    // Load saved state
    dbService.getSetting<PlayerState>('playerState').then(saved => {
      if (saved) {
        setPlayer(prev => ({
           ...prev,
           ...saved,
           isPlaying: false // Don't auto-play on load
        }));
        // If there was a track, we might want to load it into the primary audio (paused)
        if (saved.currentTrackId) {
             dbService.getAudioBlob(saved.currentTrackId).then(blob => {
                 if (blob && audio1Ref.current) {
                     audio1Ref.current.src = URL.createObjectURL(blob);
                     audio1Ref.current.currentTime = 0; // Reset or save position? Reset for now.
                 }
             });
        }
      }
    });

    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      // cleanup blobs?
    };
  }, []);

  // Sync Volume
  useEffect(() => {
    if (audio1Ref.current) audio1Ref.current.volume = player.volume;
    if (audio2Ref.current) audio2Ref.current.volume = player.volume;
  }, [player.volume]);

  // Save state on change
  useEffect(() => {
    saveState(player);
  }, [player, saveState]);


  // Helper: Shuffle
  const shuffleArray = (array: string[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // --- CORE PLAYBACK LOGIC ---

  const playTrack = useCallback(async (trackId: string, options: {
    immediate?: boolean;
    fromQueue?: boolean;
    customQueue?: string[];
  } = {}) => {
    const { immediate = true, fromQueue = false, customQueue } = options;
    const { primary, secondary } = getAudioElements();

    if (!primary || !secondary) return;

    try {
      const audioBlob = await dbService.getAudioBlob(trackId);
      if (!audioBlob) {
        console.error(`Audio blob not found for ${trackId}`);
        // Logic to skip if not found could go here
        return;
      }
      const url = URL.createObjectURL(audioBlob);

      // Prepare Queue
      setPlayer(prev => {
        let newQueue = prev.queue;
        let newOriginalQueue = prev.originalQueue;

        if (customQueue) {
          newQueue = [...customQueue];
          newOriginalQueue = [...customQueue];
          if (prev.shuffle) {
             const others = customQueue.filter(id => id !== trackId);
             newQueue = [trackId, ...shuffleArray(others)];
          }
        } else if (!fromQueue) {
             // Handle "Play Next" behavior or Inject into Queue
             // If the track is not in queue (or even if it is, but we clicked it from outside queue context),
             // we want to play it immediately and ensure the queue continues.

             // Strategy: Insert track immediately after current playing track (if any), or at top.
             // If queue was empty, it becomes the queue.
             if (prev.queue.length === 0) {
                 newQueue = [trackId];
                 newOriginalQueue = [trackId];
             } else {
                 // If track is already in queue, we might just jump to it?
                 // But user asked "without resetting... session".
                 // If we jump, we might disrupt the flow if it was far away.
                 // Let's implement "Insert Next" logic implicitly.
                 // Actually, often users want to play the song and then continue with what was next?
                 // Or play the song and then continue with the *rest of the queue*.

                 // If we just insert it at the next position:
                 const currentIdx = prev.queue.indexOf(prev.currentTrackId || '');
                 const insertIdx = currentIdx >= 0 ? currentIdx + 1 : 0;

                 // Check if it's already there to avoid duplicates?
                 // If we want to allow re-playing same song, we can have duplicates.
                 // But typically we don't want duplicates if it's the exact same ID.
                 // Let's remove it from elsewhere if it exists to move it here.
                 const filteredQueue = prev.queue.filter(id => id !== trackId);

                 // We need to re-calculate insertIdx because we might have removed something before it.
                 // This gets complicated.

                 // Simple approach: Just prepend to queue if no current track, or insert after current.
                 if (currentIdx === -1) {
                     // No active track in queue? Just unshift
                     newQueue = [trackId, ...filteredQueue];
                 } else {
                     // Insert after current
                     // We need to find the current track in the filtered queue first
                     const newCurrentIdx = filteredQueue.indexOf(prev.currentTrackId || '');
                     // It should be there unless currentTrackId == trackId
                     if (newCurrentIdx === -1 && prev.currentTrackId === trackId) {
                         // We are re-playing the current track? Just keep it.
                         newQueue = [trackId, ...filteredQueue];
                     } else {
                         // Splicing
                         const q = [...filteredQueue];
                         q.splice(newCurrentIdx + 1, 0, trackId);
                         newQueue = q;
                     }
                 }

                 // Also update originalQueue to reflect this addition so un-shuffle works?
                 // If we are in shuffle mode, we modified the shuffled queue.
                 // We should probably also add it to originalQueue.
                 if (!prev.originalQueue.includes(trackId)) {
                     newOriginalQueue = [...prev.originalQueue, trackId];
                 }
             }
        }

        // Update Media Session Metadata
        const track = libraryTracks[trackId];
        if (track) updateMediaSession(track);

        return {
          ...prev,
          currentTrackId: trackId,
          queue: newQueue,
          originalQueue: newOriginalQueue,
          isPlaying: true
        };
      });

      // Stop Crossfades if immediate
      if (immediate) {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        isTransitioningRef.current = false;
        nextTrackStartedRef.current = false;

        // Hard switch
        primary.src = url;
        primary.currentTime = 0;
        primary.volume = player.volume;
        await primary.play();

        // Stop secondary
        secondary.pause();
        secondary.src = "";

        // Reset state refs
        activeAudioRef.current = primary;
      } else {
        // This path is for the "Next Track" pre-loading / crossfading logic
        // We load into secondary
      }

    } catch (e) {
      console.error("Playback error", e);
    }
  }, [libraryTracks, updateMediaSession, player.volume]); // Dependencies might be stale for player.volume if not careful, but we use ref for audio volume

  // --- CROSSFADE HANDLER ---
  const handleTimeUpdate = useCallback(() => {
     const { primary, secondary } = getAudioElements();
     if (!primary) return;

     setCurrentTime(primary.currentTime);

     // Crossfade Trigger
     const timeLeft = primary.duration - primary.currentTime;

     // Only trigger if:
     // 1. Crossfade is enabled
     // 2. We are within the window
     // 3. We haven't started the next track yet
     // 4. We are playing
     // 5. There is a next track
     if (player.crossfadeEnabled &&
         timeLeft <= player.crossfadeDuration &&
         timeLeft > 0 &&
         !nextTrackStartedRef.current &&
         !isTransitioningRef.current &&
         !primary.paused) {

         const currentIndex = player.queue.indexOf(player.currentTrackId || '');
         let nextTrackId: string | null = null;

         if (currentIndex >= 0 && currentIndex < player.queue.length - 1) {
             nextTrackId = player.queue[currentIndex + 1];
         } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
             nextTrackId = player.queue[0];
         }

         if (nextTrackId) {
             startCrossfade(nextTrackId);
         }
     }
  }, [player.crossfadeEnabled, player.crossfadeDuration, player.queue, player.currentTrackId, player.repeat]);

  const startCrossfade = async (nextTrackId: string) => {
      if (isTransitioningRef.current || nextTrackStartedRef.current) return;

      const { primary, secondary } = getAudioElements();
      if (!primary || !secondary) return;

      console.log("Starting Crossfade to", nextTrackId);
      nextTrackStartedRef.current = true;
      isTransitioningRef.current = true;

      // 1. Load Next Track into Secondary
      const audioBlob = await dbService.getAudioBlob(nextTrackId);
      if (!audioBlob) return;

      secondary.src = URL.createObjectURL(audioBlob);
      secondary.volume = 0; // Start silent
      await secondary.play();

      // Update UI to show we are essentially "playing" the next track metadata-wise?
      // Actually, we usually want to show the current song until it finishes or is dominant.
      // But for "Now Playing" UI, it's tricky.
      // Let's keep UI on current song until the swap happens or crossfade completes.
      // However, usually we swap the "Current Track" info when the new song *starts* or reaches sufficient volume.
      // Let's swap immediately visually but keep audio mixing.

      const track = libraryTracks[nextTrackId];
      if (track) updateMediaSession(track);
      setPlayer(prev => ({ ...prev, currentTrackId: nextTrackId }));

      // 2. Fade Loop
      const duration = player.crossfadeDuration * 1000;
      const steps = duration / FADE_INTERVAL;
      const volStep = player.volume / steps;

      let stepCount = 0;

      fadeIntervalRef.current = setInterval(() => {
          stepCount++;
          const newPrimVol = Math.max(0, player.volume - (stepCount * volStep));
          const newSecVol = Math.min(player.volume, stepCount * volStep);

          primary.volume = newPrimVol;
          secondary.volume = newSecVol;

          if (stepCount >= steps) {
              // Finish Crossfade
              clearInterval(fadeIntervalRef.current);
              primary.pause();
              primary.currentTime = 0;
              primary.volume = player.volume; // Reset for reuse

              // Swap Refs
              activeAudioRef.current = secondary;

              isTransitioningRef.current = false;
              nextTrackStartedRef.current = false;

              // Cleanup
              if (primary.src) URL.revokeObjectURL(primary.src);
              primary.src = "";
          }
      }, FADE_INTERVAL);
  };

  // --- CONTROLS ---

  const togglePlay = useCallback(() => {
    const { primary } = getAudioElements();
    if (!primary) return;

    if (player.isPlaying) {
        primary.pause();
        setPlayer(p => ({ ...p, isPlaying: false }));
    } else {
        primary.play().catch(console.error);
        setPlayer(p => ({ ...p, isPlaying: true }));
    }
  }, [player.isPlaying]);

  const nextTrack = useCallback(() => {
     // Force next track (skip crossfade wait)
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
      const { primary } = getAudioElements();
      if (primary && primary.currentTime > 3) {
          primary.currentTime = 0;
          return;
      }

      const currentIndex = player.queue.indexOf(player.currentTrackId || '');
      if (currentIndex > 0) {
          playTrack(player.queue[currentIndex - 1], { immediate: true, fromQueue: true });
      } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
          playTrack(player.queue[player.queue.length - 1], { immediate: true, fromQueue: true });
      }
  }, [player.queue, player.currentTrackId, player.repeat, playTrack]);

  const handleSeek = useCallback((time: number) => {
      const { primary } = getAudioElements();
      if (primary) {
          primary.currentTime = time;
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
              // Ensure current track is still playing and we don't lose position,
              // but queue order is restored.
          }

          dbService.setSetting('shuffle', isShuffling);
          return { ...prev, shuffle: isShuffling, queue: newQueue };
      });
  }, []);

  // --- EVENT LISTENERS ---

  useEffect(() => {
      const { primary, secondary } = getAudioElements();

      const onTimeUpdate = () => handleTimeUpdate();
      const onDurationChange = () => primary && setDuration(primary.duration);
      const onEnded = () => {
           // Fallback if crossfade didn't trigger (e.g. song too short) or disabled
           if (!player.crossfadeEnabled || (player.crossfadeEnabled && !nextTrackStartedRef.current)) {
                if (player.repeat === RepeatMode.ONE) {
                    if (primary) {
                        primary.currentTime = 0;
                        primary.play();
                    }
                } else {
                    nextTrack();
                }
           }
      };

      if (primary) {
          primary.addEventListener('timeupdate', onTimeUpdate);
          primary.addEventListener('loadedmetadata', onDurationChange);
          primary.addEventListener('ended', onEnded);
      }

      return () => {
          if (primary) {
              primary.removeEventListener('timeupdate', onTimeUpdate);
              primary.removeEventListener('loadedmetadata', onDurationChange);
              primary.removeEventListener('ended', onEnded);
          }
      };
  }, [handleTimeUpdate, nextTrack, player.repeat, player.crossfadeEnabled, player.currentTrackId]); // Re-bind when active element swaps or state changes relevant to events


  // --- MEDIA SESSION ---
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
