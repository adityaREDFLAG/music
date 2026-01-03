import { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../db';
import { Track, PlayerState, RepeatMode } from '../types';
import { resumeAudioContext } from './useAudioAnalyzer';
import { getSmartNextTrack } from '../utils/automix';

export const useAudioPlayer = (
  libraryTracks: Record<string, Track>,
  updateMediaSession: (track: Track) => void
) => {
  // --- STATE ---
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [crossfadeAudioElement, setCrossfadeAudioElement] = useState<HTMLAudioElement | null>(null);
  
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
    automixEnabled: false,
    automixMode: 'classic',
    normalizationEnabled: false
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Helper Refs
  const nextTrackBlobRef = useRef<{ id: string; blob: Blob } | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const crossfadeUrlRef = useRef<string | null>(null);
  const isTransitioningRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);

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

  // --- 🔒 iOS GLOBAL UNLOCK FIX ---
  // This listens for the FIRST interaction anywhere in the app to unlock the audio element
  useEffect(() => {
    if (!audioElement) return;

    const handleUnlock = async () => {
      // 1. Wake up Web Audio API Context
      await resumeAudioContext();

      // 2. Wake up HTML5 Audio Element (The "Silent Play" Hack)
      // We play and immediately pause. This tells iOS "The user interacted, allow audio."
      try {
        await audioElement.play();
        audioElement.pause();
        audioElement.currentTime = 0;
      } catch (err) {
        // Ignore errors (e.g., if it's already playing)
        console.debug("Audio unlock check:", err);
      }

      // 3. Remove listeners immediately so this only runs ONCE per session
      ['touchstart', 'touchend', 'click', 'keydown'].forEach(e => 
        window.removeEventListener(e, handleUnlock)
      );
    };

    // Attach to all possible interaction events
    const events = ['touchstart', 'touchend', 'click', 'keydown'];
    events.forEach(e => window.addEventListener(e, handleUnlock, { once: true }));

    return () => {
      events.forEach(e => window.removeEventListener(e, handleUnlock));
    };
  }, [audioElement]);


  // --- INITIALIZATION ---
  useEffect(() => {
    dbService.getSetting<PlayerState>('playerState').then(saved => {
      if (saved) {
        setPlayer(prev => ({ ...prev, ...saved, isPlaying: false }));
        
        // Restore volume
        if (audioElement && saved.volume !== undefined) {
             audioElement.volume = Math.max(0, Math.min(1, saved.volume));
        }

        // Restore last track
        if (saved.currentTrackId) {
             dbService.getAudioBlob(saved.currentTrackId).then(blob => {
                 if (blob && audioElement) {
                     if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
                     const url = URL.createObjectURL(blob);
                     currentUrlRef.current = url;
                     audioElement.src = url;
                 }
             });
        }
      }
    });

    return () => {
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
      if (crossfadeUrlRef.current) URL.revokeObjectURL(crossfadeUrlRef.current);
    };
  }, [audioElement]);

  // Save state on change
  useEffect(() => {
    saveState(player);
  }, [player, saveState]);

  // --- PLAYBACK LOGIC ---

  const performTransition = async (
    prevBlob: Blob | null,
    nextBlob: Blob,
    duration: number
  ) => {
      if (!audioElement || !crossfadeAudioElement) return;

      // 1. Setup Crossfade Audio (Outgoing)
      if (prevBlob && !audioElement.paused) {
           isTransitioningRef.current = true;

           if (crossfadeUrlRef.current) URL.revokeObjectURL(crossfadeUrlRef.current);
           const prevUrl = URL.createObjectURL(prevBlob);
           crossfadeUrlRef.current = prevUrl;

           crossfadeAudioElement.src = prevUrl;
           crossfadeAudioElement.currentTime = audioElement.currentTime;
           crossfadeAudioElement.volume = audioElement.volume;

           try {
               await crossfadeAudioElement.play();
           } catch(e) {
               console.warn("Crossfade outgoing play failed", e);
           }

           // Fade Out Animation
           const startVol = player.volume;
           crossfadeAudioElement.volume = startVol;
           const stepTime = 50;
           const steps = (duration * 1000) / stepTime;
           const volStep = startVol / steps;

           const fadeOut = setInterval(() => {
               if (crossfadeAudioElement.volume > volStep) {
                   crossfadeAudioElement.volume -= volStep;
               } else {
                   crossfadeAudioElement.volume = 0;
                   crossfadeAudioElement.pause();
                   clearInterval(fadeOut);
                   isTransitioningRef.current = false;
               }
           }, stepTime);
      }

      // 2. Setup Main Audio (Incoming)
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
      const nextUrl = URL.createObjectURL(nextBlob);
      currentUrlRef.current = nextUrl;

      audioElement.src = nextUrl;
      audioElement.currentTime = 0;

      // Volume fade in if transitioning
      if (prevBlob && !audioElement.paused) {
          audioElement.volume = 0;
          try {
              await audioElement.play();
          } catch(e) { console.warn("Incoming play failed", e); }

          const startVol = player.volume;
          const stepTime = 50;
          const steps = (duration * 1000) / stepTime;
          const volStep = startVol / steps;

          let currentVol = 0;
          const fadeIn = setInterval(() => {
              if (currentVol < startVol - volStep) {
                  currentVol += volStep;
                  audioElement.volume = currentVol;
              } else {
                  audioElement.volume = startVol;
                  clearInterval(fadeIn);
              }
          }, stepTime);
      } else {
          // Hard cut / First play
          audioElement.volume = player.volume;
           try {
              await audioElement.play();
          } catch(e) { console.warn("Play failed", e); }
      }
  };


  const playTrack = useCallback(async (trackId: string, options: {
    immediate?: boolean;
    fromQueue?: boolean;
    customQueue?: string[];
    preloadedBlob?: Blob;
  } = {}) => {
    const { immediate = true, fromQueue = false, customQueue, preloadedBlob } = options;
    
    if (!audioElement) return;

    // Get current blob before switching state if we are crossfading
    let currentBlob: Blob | null = null;
    if (player.crossfadeEnabled && player.currentTrackId && immediate) {
        try {
            currentBlob = await dbService.getAudioBlob(player.currentTrackId);
        } catch (e) { console.warn("Could not fetch current blob for crossfade"); }
    }

    try {
      // 1. Update State
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
             if (prev.queue.length === 0) {
                 newQueue = [trackId];
                 newOriginalQueue = [trackId];
             } else {
                 const filteredQueue = prev.queue.filter(id => id !== trackId);
                 let newCurrentIdx = filteredQueue.indexOf(prev.currentTrackId || '');
                 if (newCurrentIdx === -1) newCurrentIdx = 0;

                 if (prev.currentTrackId === trackId) {
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

        if (immediate) {
             const track = libraryTracks[trackId];
             if (track) updateMediaSession(track);
        }

        return {
          ...prev,
          currentTrackId: trackId,
          queue: newQueue,
          originalQueue: newOriginalQueue,
          isPlaying: true
        };
      });

      // 2. Playback
      if (immediate) {
        let nextBlob = preloadedBlob;
        if (!nextBlob) {
            nextBlob = await dbService.getAudioBlob(trackId) || undefined;
        }

        if (nextBlob) {
             await resumeAudioContext();

             if (player.crossfadeEnabled && currentBlob && crossfadeAudioElement) {
                 await performTransition(currentBlob, nextBlob, player.crossfadeDuration);
             } else {
                 // Standard playback
                 if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
                 const url = URL.createObjectURL(nextBlob);
                 currentUrlRef.current = url;
                 audioElement.src = url;
                 audioElement.currentTime = 0;
                 audioElement.load?.();
                 try {
                     await audioElement.play();
                 } catch (err) {
                     console.error("Auto-play blocked or failed", err);
                     setPlayer(p => ({ ...p, isPlaying: false }));
                 }
             }
        }
      }

    } catch (e) {
      console.error("Playback error", e);
      setPlayer(p => ({ ...p, isPlaying: false }));
    }
  }, [libraryTracks, updateMediaSession, audioElement, crossfadeAudioElement, player.crossfadeEnabled, player.crossfadeDuration, player.currentTrackId, player.shuffle, player.queue]);

  const togglePlay = useCallback(async () => {
    if (!audioElement) return;

    if (audioElement.paused) {
        // Ensure AudioContext is awake on user interaction
        await resumeAudioContext(); 
        
        try {
          await audioElement.play();
          setPlayer(p => ({ ...p, isPlaying: true }));
        } catch(err) {
            console.error("Play failed (iOS lock?)", err);
            setPlayer(p => ({ ...p, isPlaying: false }));
        }
    } else {
        audioElement.pause();
        if (crossfadeAudioElement) crossfadeAudioElement.pause();
        setPlayer(p => ({ ...p, isPlaying: false }));
    }
  }, [audioElement, crossfadeAudioElement]);

  const nextTrack = useCallback(() => {
     // Automix Logic
     if (player.automixEnabled && (player.automixMode === 'smart' || player.automixMode === 'shuffle')) {
         const currentIdx = player.queue.indexOf(player.currentTrackId || '');
         const restOfQueueIds = player.queue.slice(currentIdx + 1);

         if (restOfQueueIds.length === 0 && player.repeat === RepeatMode.ALL) {
             restOfQueueIds.push(...player.queue);
         }

         if (restOfQueueIds.length > 0) {
             const candidates = restOfQueueIds.map(id => libraryTracks[id]).filter(Boolean);
             const currentTrack = player.currentTrackId ? libraryTracks[player.currentTrackId] : null;

             if (currentTrack) {
                 const bestNext = getSmartNextTrack(currentTrack, candidates);
                 if (bestNext) {
                     const preloaded = nextTrackBlobRef.current?.id === bestNext.id ? nextTrackBlobRef.current.blob : undefined;
                     playTrack(bestNext.id, { immediate: true, fromQueue: true, preloadedBlob: preloaded });
                     return;
                 }
             }
         }
     }

     // Standard Next Logic
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
  }, [player, playTrack, libraryTracks]);

  const prevTrack = useCallback(() => {
      if (audioElement && audioElement.currentTime > 3) {
          audioElement.currentTime = 0;
          return;
      }
      
      const currentIndex = player.queue.indexOf(player.currentTrackId || '');
      if (currentIndex > 0) {
          playTrack(player.queue[currentIndex - 1], { immediate: true, fromQueue: true });
      } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
          playTrack(player.queue[player.queue.length - 1], { immediate: true, fromQueue: true });
      }
  }, [player.queue, player.currentTrackId, player.repeat, playTrack, audioElement]);

  // --- SCRUBBING & SEEKING LOGIC ---

  const startScrub = useCallback(() => {
    if (!audioElement) return;
    isScrubbingRef.current = true;
    wasPlayingBeforeScrubRef.current = !audioElement.paused;
    if (wasPlayingBeforeScrubRef.current) {
        audioElement.pause();
    }
  }, [audioElement]);

  const scrub = useCallback((time: number) => {
    if (!audioElement) return;
    const d = audioElement.duration;
    const t = Math.max(0, Math.min(time, isNaN(d) ? 0 : d));

    // Immediate Audio Update
    audioElement.currentTime = t;
    // Immediate UI Update
    setCurrentTime(t);

    // Immediate Session Update (optional, maybe throttle this)
    if ('mediaSession' in navigator && !isNaN(d) && isFinite(d)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: d,
                playbackRate: audioElement.playbackRate,
                position: t
            });
        } catch(e) {}
    }
  }, [audioElement]);

  const endScrub = useCallback(() => {
    if (!audioElement) return;
    isScrubbingRef.current = false;
    if (wasPlayingBeforeScrubRef.current) {
        audioElement.play().catch(console.error);
    }
  }, [audioElement]);

  // ✅ FIX #3: Robust Seek Handler for iOS (Jumps)
  const handleSeek = useCallback(async (time: number) => {
      if (!audioElement) return;
      
      const d = audioElement.duration;
      // Allow seeking to 0 even if duration is weird
      const validDuration = isNaN(d) ? 0 : d;
      const t = Math.max(0, Math.min(time, validDuration));
      
      try {
          // If we are jumping (not scrubbing), ensure context is awake
          if (audioElement.paused && !wasPlayingBeforeScrubRef.current) {
               // Only force resume if we intend to play or if user interaction requires it
               // For simple seek, we might not need to resume context if paused?
               // But iOS might require it. Safe to call.
               await resumeAudioContext();
          }
          
          audioElement.currentTime = t;
          setCurrentTime(t);

          if ('mediaSession' in navigator && validDuration > 0) {
             navigator.mediaSession.setPositionState({
                duration: validDuration,
                playbackRate: audioElement.playbackRate,
                position: t
             });
          }
      } catch (e) {
          console.error('Error seeking:', e);
      }
  }, [audioElement]);

  const setVolume = useCallback((volume: number) => {
      const v = Math.max(0, Math.min(1, volume));
      if (audioElement) audioElement.volume = v;
      if (crossfadeAudioElement) crossfadeAudioElement.volume = v; // Sync volume
      setPlayer(p => ({ ...p, volume: v }));
  }, [audioElement, crossfadeAudioElement]);

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

  // ✅ FIX #2: RAF Loop for Smooth UI Updates (Foreground)
  useEffect(() => {
    if (!audioElement || !player.isPlaying) return;

    let rafId: number;
    const loop = () => {
      // Only update if not seeking and not scrubbing to avoid jitter
      if (!audioElement.seeking && !isScrubbingRef.current) {
        setCurrentTime(audioElement.currentTime);
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [audioElement, player.isPlaying]);


  // --- EVENT LISTENERS (Standard Logic + Background Updates) ---
  useEffect(() => {
      if (!audioElement) return;

      let lastTimeUpdateRef = 0;
      const TIME_UPDATE_THROTTLE = 100;

      const updatePositionState = () => {
          if ('mediaSession' in navigator && !isNaN(audioElement.duration)) {
              try {
                  navigator.mediaSession.setPositionState({
                      duration: audioElement.duration,
                      playbackRate: audioElement.playbackRate,
                      position: audioElement.currentTime
                  });
              } catch (e) {}
          }
      };

      const onTimeUpdate = () => {
          if (!audioElement.seeking && !isScrubbingRef.current) {
              const now = performance.now();
              if (now - lastTimeUpdateRef > TIME_UPDATE_THROTTLE) {
                  // Keep this for background state updates, 
                  // but RAF handles the UI when in foreground
                  setCurrentTime(audioElement.currentTime);
                  lastTimeUpdateRef = now;
              }

              // Automix/Crossfade trigger logic
              const timeLeft = audioElement.duration - audioElement.currentTime;
              if (player.crossfadeEnabled && !isTransitioningRef.current && timeLeft <= player.crossfadeDuration && timeLeft > 0) {
                   // Placeholder for auto-transition triggers if you implement seamless mix later
              }
          }
      };

      const onSeeked = () => {
          setCurrentTime(audioElement.currentTime);
          updatePositionState();
      };

      const onDurationChange = () => {
         const d = audioElement.duration;
         setDuration(!isNaN(d) ? d : 0);
         updatePositionState();
      };

      const onEnded = () => {
           if (player.repeat === RepeatMode.ONE) {
               audioElement.currentTime = 0;
               audioElement.play();
           } else {
               nextTrack();
           }
      };

      const onPause = () => {
          if (!audioElement.ended && !isTransitioningRef.current) {
             setPlayer(p => ({ ...p, isPlaying: false }));
          }
      };

      const onPlay = () => {
          setPlayer(p => ({ ...p, isPlaying: true }));
          updatePositionState();
      };

      audioElement.addEventListener('timeupdate', onTimeUpdate);
      audioElement.addEventListener('seeked', onSeeked);
      audioElement.addEventListener('loadedmetadata', onDurationChange);
      audioElement.addEventListener('ended', onEnded);
      audioElement.addEventListener('pause', onPause);
      audioElement.addEventListener('play', onPlay);

      return () => {
          audioElement.removeEventListener('timeupdate', onTimeUpdate);
          audioElement.removeEventListener('seeked', onSeeked);
          audioElement.removeEventListener('loadedmetadata', onDurationChange);
          audioElement.removeEventListener('ended', onEnded);
          audioElement.removeEventListener('pause', onPause);
          audioElement.removeEventListener('play', onPlay);
      };
  }, [nextTrack, player.repeat, audioElement, player.crossfadeEnabled, player.crossfadeDuration]);

  // --- PRELOAD NEXT TRACK ---
  useEffect(() => {
      const currentIndex = player.queue.indexOf(player.currentTrackId || '');
      let nextId: string | null = null;
      if (currentIndex >= 0 && currentIndex < player.queue.length - 1) {
          nextId = player.queue[currentIndex + 1];
      } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
          nextId = player.queue[0];
      }
      if (nextTrackBlobRef.current?.id === nextId) return;
      if (nextId) {
          dbService.getAudioBlob(nextId).then(blob => {
              if (blob) nextTrackBlobRef.current = { id: nextId, blob };
          });
      } else { nextTrackBlobRef.current = null; }
  }, [player.currentTrackId, player.queue, player.repeat]);

  // ✅ FIX #1: Media Session with Context Resumption for iOS Background Audio
  useEffect(() => {
      if ('mediaSession' in navigator) {
          try {
              navigator.mediaSession.setActionHandler('play', async () => {
                  await resumeAudioContext();
                  togglePlay();
              });
              navigator.mediaSession.setActionHandler('pause', () => togglePlay());
              navigator.mediaSession.setActionHandler('previoustrack', async () => {
                  await resumeAudioContext();
                  prevTrack();
              });
              navigator.mediaSession.setActionHandler('nexttrack', async () => {
                  await resumeAudioContext();
                  nextTrack();
              });
              navigator.mediaSession.setActionHandler('seekto', async (d) => { 
                  if (d.seekTime !== undefined) {
                      await resumeAudioContext();
                      handleSeek(d.seekTime); 
                  }
              });
              
              navigator.mediaSession.playbackState = audioElement?.paused ? 'paused' : 'playing';
          } catch (e) {}
      }
  }, [togglePlay, prevTrack, nextTrack, handleSeek, audioElement?.paused]);

  useEffect(() => {
      const currentTrack = player.currentTrackId ? libraryTracks[player.currentTrackId] : null;
      if (currentTrack && 'mediaSession' in navigator) {
          try { updateMediaSession(currentTrack); } catch (e) {}
      }
  }, [player.currentTrackId, libraryTracks, updateMediaSession]);

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
    startScrub,
    scrub,
    endScrub,
    setVolume,
    toggleShuffle,
    setAudioElement,
    setCrossfadeAudioElement
  };
};
