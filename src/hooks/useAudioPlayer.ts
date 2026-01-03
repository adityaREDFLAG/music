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
  const nextTrackUrlRef = useRef<{ id: string; url: string } | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const crossfadeUrlRef = useRef<string | null>(null);
  const isTransitioningRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);

  // ✅ NEW: Locks UI updates during a click-to-seek action
  const isManualSeekingRef = useRef(false);

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
  useEffect(() => {
    if (!audioElement) return;

    const handleUnlock = async () => {
      await resumeAudioContext();
      try {
        await audioElement.play();
        audioElement.pause();
        audioElement.currentTime = 0;
      } catch (err) {
        console.debug("Audio unlock check:", err);
      }
      ['touchstart', 'touchend', 'click', 'keydown'].forEach(e => 
        window.removeEventListener(e, handleUnlock)
      );
    };

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
        
        if (audioElement && saved.volume !== undefined) {
             audioElement.volume = Math.max(0, Math.min(1, saved.volume));
        }

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
        if (currentUrlRef.current) {
            URL.revokeObjectURL(currentUrlRef.current);
            currentUrlRef.current = null;
        }
        if (nextTrackUrlRef.current) {
            URL.revokeObjectURL(nextTrackUrlRef.current.url);
            nextTrackUrlRef.current = null;
        }
        if (crossfadeUrlRef.current) {
            URL.revokeObjectURL(crossfadeUrlRef.current);
            crossfadeUrlRef.current = null;
        }
    };
  }, [audioElement]);

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

      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
      const nextUrl = URL.createObjectURL(nextBlob);
      currentUrlRef.current = nextUrl;

      audioElement.src = nextUrl;
      audioElement.currentTime = 0;
      setCurrentTime(0);

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
  } = {}) => {
    const { immediate = true, fromQueue = false, customQueue } = options;
    
    if (!audioElement) return;

    let currentBlob: Blob | null = null;
    if (player.crossfadeEnabled && player.currentTrackId && immediate) {
        try {
            currentBlob = await dbService.getAudioBlob(player.currentTrackId);
        } catch (e) { console.warn("Could not fetch current blob for crossfade"); }
    }

    try {
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
             if (track) {
               updateMediaSession(track);
               setDuration(track.duration);
             }
        }

        return {
          ...prev,
          currentTrackId: trackId,
          queue: newQueue,
          originalQueue: newOriginalQueue,
          isPlaying: true
        };
      });

      if (immediate) {
        // 1. TRY SYNC PLAYBACK FIRST (Critical for iOS)
        if (nextTrackUrlRef.current?.id === trackId) {
            const url = nextTrackUrlRef.current.url;

            // Clear the ref so we don't revoke this URL later while it's playing
            nextTrackUrlRef.current = null;

            if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
            currentUrlRef.current = url;

            audioElement.src = url;
            audioElement.currentTime = 0;
            setCurrentTime(0);

            try {
                // This is now synchronous relative to the function start
                await audioElement.play();
            } catch (err) {
                console.error("Sync play failed", err);
                setPlayer(p => ({ ...p, isPlaying: false }));
            }
            return; // Exit early!
        }

        // 2. FALLBACK TO ASYNC (Only if preload failed)
        let nextBlob = await dbService.getAudioBlob(trackId) || undefined;

        if (nextBlob) {
             resumeAudioContext().catch(console.error);

             const isHidden = document.visibilityState === 'hidden';
             const shouldCrossfade = player.crossfadeEnabled && !isHidden && currentBlob && crossfadeAudioElement;

             if (shouldCrossfade) {
                 await performTransition(currentBlob, nextBlob, player.crossfadeDuration);
             } else {
                 if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
                 const url = URL.createObjectURL(nextBlob);
                 currentUrlRef.current = url;
                 audioElement.src = url;
                 audioElement.currentTime = 0;
                 setCurrentTime(0);
                 
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
        resumeAudioContext().catch(console.error);
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
                     playTrack(bestNext.id, { immediate: true, fromQueue: true });
                     return;
                 }
             }
         }
     }

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
    let d = audioElement.duration;

    if ((isNaN(d) || d === 0) && player.currentTrackId && libraryTracks[player.currentTrackId]) {
        d = libraryTracks[player.currentTrackId].duration;
    }

    const t = Math.max(0, Math.min(time, isNaN(d) ? 0 : d));

    if (isNaN(t)) {
        console.warn('[useAudioPlayer] scrub attempted with NaN time');
        return;
    }

    setCurrentTime(t);

    if (audioElement.readyState < 1) { 
        pendingSeekRef.current = t;
    } else {
        audioElement.currentTime = t;
        pendingSeekRef.current = null;
    }

    if ('mediaSession' in navigator && !isNaN(d) && isFinite(d)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: d,
                playbackRate: audioElement.playbackRate,
                position: t
            });
        } catch(e) {}
    }
  }, [audioElement, player.currentTrackId, libraryTracks]);

  const endScrub = useCallback(() => {
    if (!audioElement) return;
    isScrubbingRef.current = false;
    if (wasPlayingBeforeScrubRef.current) {
        audioElement.play().catch(console.error);
    }
  }, [audioElement]);

  const handleSeek = useCallback((time: number) => {
      if (!audioElement) return;

      // 1. Calculate and clamp valid time
      let d = audioElement.duration;
      // Fallback to metadata duration if available and element is not ready
      if ((isNaN(d) || !isFinite(d)) && player.currentTrackId && libraryTracks[player.currentTrackId]) {
          d = libraryTracks[player.currentTrackId].duration;
      }

      const validDuration = (isNaN(d) || !isFinite(d)) ? 0 : d;
      const t = Math.max(0, Math.min(time, validDuration));

      // 2. Optimistically update UI state immediately
      setCurrentTime(t);

      // 3. iOS/Mobile Fix: If paused, briefly wake context (optional but helpful)
      if (audioElement.paused && !wasPlayingBeforeScrubRef.current) {
          resumeAudioContext().catch(() => {});
      }

      // 4. THE FIX: Lock updates, then set time
      if (Number.isFinite(t)) {
          isManualSeekingRef.current = true;
          audioElement.currentTime = t;
      }

      // 5. Reset other flags (DO NOT reset isManualSeekingRef here; wait for onSeeked)
      pendingSeekRef.current = null;

      // 6. Update Lock Screen / Media Session
      if ('mediaSession' in navigator && validDuration > 0) {
          try {
              navigator.mediaSession.setPositionState({
                  duration: validDuration,
                  playbackRate: audioElement.playbackRate,
                  position: t
              });
          } catch (e) {
              // Ignore temporary media session errors
          }
      }
  }, [audioElement, player.currentTrackId, libraryTracks]);

  const setVolume = useCallback((volume: number) => {
      const v = Math.max(0, Math.min(1, volume));
      if (audioElement) audioElement.volume = v;
      if (crossfadeAudioElement) crossfadeAudioElement.volume = v; 
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
      // ✅ ADDED CHECK: && !isManualSeekingRef.current
      if (!audioElement.seeking && !isScrubbingRef.current && !isManualSeekingRef.current && audioElement.readyState >= 1) {
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
          // ✅ ADDED CHECK: && !isManualSeekingRef.current
          if (!audioElement.seeking && !isScrubbingRef.current && !isManualSeekingRef.current) {
              const now = performance.now();
              if (now - lastTimeUpdateRef > TIME_UPDATE_THROTTLE) {
                  setCurrentTime(audioElement.currentTime);
                  lastTimeUpdateRef = now;
              }

              const timeLeft = audioElement.duration - audioElement.currentTime;
              if (player.crossfadeEnabled && !isTransitioningRef.current && timeLeft <= player.crossfadeDuration && timeLeft > 0) {
                   // Placeholder for auto-transition
              }
          }
      };

      const onSeeked = () => {
          // ✅ UNLOCK UI UPDATES
          isManualSeekingRef.current = false;
          
          setCurrentTime(audioElement.currentTime);
          updatePositionState();
      };

      const onSeeking = () => {
          // console.debug('[useAudioPlayer] seeking event', audioElement.currentTime);
      };

      const onDurationChange = () => {
         const d = audioElement.duration;
         setDuration(!isNaN(d) ? d : 0);
         updatePositionState();

         if (pendingSeekRef.current !== null) {
             audioElement.currentTime = pendingSeekRef.current;
             pendingSeekRef.current = null;
         }
      };

      const onEnded = () => {
           isManualSeekingRef.current = false; // Safety check
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

      const onInterruptionEnd = () => {
          // iOS requires a tiny timeout or user interaction, but sometimes
          // just calling play() here works if the interruption was temporary
          if (player.isPlaying) {
               audioElement.play().catch(console.error);
          }
      };

      audioElement.addEventListener('timeupdate', onTimeUpdate);
      audioElement.addEventListener('seeked', onSeeked);
      audioElement.addEventListener('seeking', onSeeking);
      audioElement.addEventListener('loadedmetadata', onDurationChange);
      audioElement.addEventListener('ended', onEnded);
      audioElement.addEventListener('pause', onPause);
      audioElement.addEventListener('play', onPlay);
      // iOS Interruption recovery
      document.addEventListener('visibilitychange', onInterruptionEnd);

      const handleInterruption = () => {
        // If we were playing, try to resume logic or update state to Paused
        if (player.isPlaying && audioElement.paused) {
             setPlayer(p => ({ ...p, isPlaying: false }));
        }
      };

      // 'suspend' often fires on calls/alarms
      audioElement.addEventListener('suspend', handleInterruption);

      return () => {
          audioElement.removeEventListener('timeupdate', onTimeUpdate);
          audioElement.removeEventListener('seeked', onSeeked);
          audioElement.removeEventListener('seeking', onSeeking);
          audioElement.removeEventListener('loadedmetadata', onDurationChange);
          audioElement.removeEventListener('ended', onEnded);
          audioElement.removeEventListener('pause', onPause);
          audioElement.removeEventListener('play', onPlay);
          document.removeEventListener('visibilitychange', onInterruptionEnd);
          audioElement.removeEventListener('suspend', handleInterruption);
      };
  }, [nextTrack, player.repeat, audioElement, player.crossfadeEnabled, player.crossfadeDuration, player.isPlaying]);

  // --- PRELOAD NEXT TRACK ---
  useEffect(() => {
    const currentIndex = player.queue.indexOf(player.currentTrackId || '');
    let nextId: string | null = null;

    if (currentIndex >= 0 && currentIndex < player.queue.length - 1) {
        nextId = player.queue[currentIndex + 1];
    } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
        nextId = player.queue[0];
    }

    // Cleanup old URL if it changed
    if (nextTrackUrlRef.current && nextTrackUrlRef.current.id !== nextId) {
        URL.revokeObjectURL(nextTrackUrlRef.current.url);
        nextTrackUrlRef.current = null;
    }

    if (nextTrackUrlRef.current?.id === nextId) return;

    if (nextId) {
        dbService.getAudioBlob(nextId).then(blob => {
            if (blob) {
                // Create URL immediately during preload
                const url = URL.createObjectURL(blob);
                nextTrackUrlRef.current = { id: nextId, url };
            }
        });
    }
  }, [player.currentTrackId, player.queue, player.repeat]);

  // ✅ FIX #1: Media Session
  useEffect(() => {
      if ('mediaSession' in navigator) {
          try {
              navigator.mediaSession.setActionHandler('play', () => {
                  resumeAudioContext().catch(console.error);
                  togglePlay();
              });
              navigator.mediaSession.setActionHandler('pause', () => togglePlay());
              navigator.mediaSession.setActionHandler('previoustrack', () => {
                  resumeAudioContext().catch(console.error);
                  prevTrack();
              });
              navigator.mediaSession.setActionHandler('nexttrack', () => {
                  resumeAudioContext().catch(console.error);
                  nextTrack();
              });
              navigator.mediaSession.setActionHandler('seekto', (d) => { 
                  if (d.seekTime !== undefined) {
                      resumeAudioContext().catch(console.error);
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
