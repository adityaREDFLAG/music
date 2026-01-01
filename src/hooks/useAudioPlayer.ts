import { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../db';
import { Track, PlayerState, RepeatMode } from '../types';

const FADE_INTERVAL = 50; // ms for volume updates during crossfade

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
    crossfadeEnabled: false,
    crossfadeDuration: 5,
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // --- AUDIO ARCHITECTURE (DOUBLE BUFFER) ---
  // We use two audio elements to achieve gapless crossfading.
  // 'activeIdx' points to which element is currently the "Primary" (playing out loud).
  const [activeIdx, setActiveIdx] = useState(0);

  const audio1Ref = useRef<HTMLAudioElement | null>(null);
  const audio2Ref = useRef<HTMLAudioElement | null>(null);
  
  // Logic Control Refs
  const fadeIntervalRef = useRef<any>(null);
  const nextTrackStartedRef = useRef<boolean>(false); 
  const isTransitioningRef = useRef<boolean>(false);

  // --- HELPERS ---

  // Get the Primary (Active) and Secondary (Next) audio elements based on current index
  const getAudioElements = useCallback(() => {
    if (activeIdx === 0) {
      return { primary: audio1Ref.current, secondary: audio2Ref.current };
    } else {
      return { primary: audio2Ref.current, secondary: audio1Ref.current };
    }
  }, [activeIdx]);

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

  useEffect(() => {
    const initAudio = () => {
      const a = new Audio();
      a.preload = 'auto';
      // iOS Safari Fix: Unmute explicitly required on some versions
      a.playsInline = true; 
      return a;
    };

    audio1Ref.current = initAudio();
    audio2Ref.current = initAudio();

    // Load persisted state
    dbService.getSetting<PlayerState>('playerState').then(saved => {
      if (saved) {
        setPlayer(prev => ({
           ...prev,
           ...saved,
           isPlaying: false // Always start paused to respect autoplay policies
        }));
        
        // Restore last track to Primary (Paused)
        if (saved.currentTrackId) {
             dbService.getAudioBlob(saved.currentTrackId).then(blob => {
                 if (blob && audio1Ref.current) {
                     audio1Ref.current.src = URL.createObjectURL(blob);
                     audio1Ref.current.currentTime = 0; 
                 }
             });
        }
      }
    });

    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      // Optional: Revoke ObjectURLs here if needed
    };
  }, []);

  // Sync Master Volume to both players
  useEffect(() => {
    // Note: During crossfade, volume is manually controlled by the interval.
    // This effect handles static volume changes.
    if (!isTransitioningRef.current) {
        if (audio1Ref.current) audio1Ref.current.volume = player.volume;
        if (audio2Ref.current) audio2Ref.current.volume = player.volume;
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
    const { primary, secondary } = getAudioElements();

    if (!primary || !secondary) return;

    try {
      const audioBlob = await dbService.getAudioBlob(trackId);
      if (!audioBlob) {
        console.error(`Audio blob not found for ${trackId}`);
        return;
      }
      const url = URL.createObjectURL(audioBlob);

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
          isPlaying: true
        };
      });

      // 2. Handle Audio Playback
      if (immediate) {
        // STOP everything and play strictly on Primary
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
        isTransitioningRef.current = false;
        nextTrackStartedRef.current = false;

        // Reset Secondary
        secondary.pause();
        secondary.src = "";
        secondary.volume = player.volume;

        // Play Primary
        primary.src = url;
        primary.currentTime = 0;
        primary.volume = player.volume; 
        await primary.play();

        // No ActiveIdx swap needed here; we stay on current Primary
      } else {
        // Pre-loading path (not used in standard click, used internally for crossfade prep)
      }

    } catch (e) {
      console.error("Playback error", e);
    }
  }, [libraryTracks, updateMediaSession, player.volume, getAudioElements]);


  // --- LOGIC: CROSSFADE ---

  const startCrossfade = useCallback(async (nextTrackId: string) => {
      if (isTransitioningRef.current || nextTrackStartedRef.current) return;

      const { primary, secondary } = getAudioElements();
      if (!primary || !secondary) return;

      console.log("Starting Crossfade to", nextTrackId);
      nextTrackStartedRef.current = true;
      isTransitioningRef.current = true;

      // 1. Prepare Secondary
      const audioBlob = await dbService.getAudioBlob(nextTrackId);
      if (!audioBlob) return;

      secondary.src = URL.createObjectURL(audioBlob);
      secondary.volume = 0; // Start silent
      await secondary.play();

      // Update UI immediately
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
              
              // Reset Old Primary
              primary.pause();
              primary.currentTime = 0;
              primary.volume = player.volume; 
              if (primary.src) URL.revokeObjectURL(primary.src);
              primary.src = "";

              // Ensure New Primary is full volume
              secondary.volume = player.volume;

              // SWAP POINTERS: Secondary becomes the new Primary
              setActiveIdx(prev => prev === 0 ? 1 : 0);

              isTransitioningRef.current = false;
              nextTrackStartedRef.current = false;
          }
      }, FADE_INTERVAL);
  }, [getAudioElements, libraryTracks, player.crossfadeDuration, player.volume, updateMediaSession]);


  // --- LOGIC: TIME UPDATE MONITOR ---

  const handleTimeUpdate = useCallback(() => {
     const { primary } = getAudioElements();
     if (!primary) return;

     // One-way sync: Audio -> UI
     setCurrentTime(primary.currentTime);

     // Crossfade Trigger Logic
     const timeLeft = primary.duration - primary.currentTime;

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
  }, [getAudioElements, player.crossfadeEnabled, player.crossfadeDuration, player.queue, player.currentTrackId, player.repeat, startCrossfade]);


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
  }, [player.isPlaying, getAudioElements]);

  const nextTrack = useCallback(() => {
     // CRITICAL: Handle "Next" during crossfade
     // 1. Abort any active crossfade interval
     if (fadeIntervalRef.current) {
         clearInterval(fadeIntervalRef.current);
         fadeIntervalRef.current = null;
     }
     isTransitioningRef.current = false;
     nextTrackStartedRef.current = false;

     // 2. Determine Next Track
     const currentIndex = player.queue.indexOf(player.currentTrackId || '');
     let nextId: string | null = null;

     if (currentIndex >= 0 && currentIndex < player.queue.length - 1) {
         nextId = player.queue[currentIndex + 1];
     } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
         nextId = player.queue[0];
     }

     // 3. Force Immediate Play (skips fade)
     if (nextId) {
         playTrack(nextId, { immediate: true, fromQueue: true });
     }
  }, [player.queue, player.currentTrackId, player.repeat, playTrack]);

  const prevTrack = useCallback(() => {
      const { primary } = getAudioElements();
      // "Restart Song" logic
      if (primary && primary.currentTime > 3) {
          primary.currentTime = 0;
          return;
      }
      
      // "Previous Song" logic
      const currentIndex = player.queue.indexOf(player.currentTrackId || '');
      if (currentIndex > 0) {
          playTrack(player.queue[currentIndex - 1], { immediate: true, fromQueue: true });
      } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
          playTrack(player.queue[player.queue.length - 1], { immediate: true, fromQueue: true });
      }
  }, [player.queue, player.currentTrackId, player.repeat, playTrack, getAudioElements]);

  // CRITICAL FIX: Seek
  const handleSeek = useCallback((time: number) => {
      const { primary } = getAudioElements();
      if (primary) {
          // 1. Mutate Audio (Source of Truth)
          primary.currentTime = time;
          // 2. Update React State immediately (don't wait for timeupdate event)
          setCurrentTime(time);
      }
  }, [getAudioElements]);

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
      const { primary } = getAudioElements();

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
  }, [handleTimeUpdate, nextTrack, player.repeat, player.crossfadeEnabled, activeIdx, getAudioElements]); 
  // ^ Re-bind listeners when 'activeIdx' swaps.

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
