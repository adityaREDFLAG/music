import { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../db';
import { Track, PlayerState, RepeatMode } from '../types';
import { resumeAudioContext, getAudioContext } from './useAudioAnalyzer';
import { getSmartNextTrack } from '../utils/automix';
import ReactPlayer from 'react-player';

export const useAudioPlayer = (
  libraryTracks: Record<string, Track>,
  updateMediaSession: (track: Track) => void
) => {
  // --- STATE ---
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [crossfadeAudioElement, setCrossfadeAudioElement] = useState<HTMLAudioElement | null>(null);
  const [soundCloudPlayer, setSoundCloudPlayer] = useState<ReactPlayer | null>(null); // NEW: ReactPlayer instance
  
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
    normalizationEnabled: false,
    lyricOffset: 0 // Default 0ms
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Helper Refs
  const nextTrackUrlRef = useRef<{ id: string; url: string } | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const crossfadeUrlRef = useRef<string | null>(null);
  const isTransitioningRef = useRef(false);
  const isAutoTriggeredRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const wasPlayingBeforeScrubRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  const upcomingTrackIdRef = useRef<string | null>(null);
  const isManualSeekingRef = useRef(false);

  // Derive Active Source
  const currentTrack = player.currentTrackId ? libraryTracks[player.currentTrackId] : null;
  const isWebMode = currentTrack?.source === 'soundcloud';

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

  const safeResumeContext = async () => {
     const ctx = getAudioContext();
     if (ctx && ctx.state === 'suspended') {
         await resumeAudioContext().catch(() => {});
     }
  };

  // --- 🔒 iOS GLOBAL UNLOCK FIX ---
  useEffect(() => {
    if (!audioElement) return;

    const handleUnlock = async () => {
      await safeResumeContext();
      try {
        // iOS requires a direct call to play() within the event handler to unlock audio.
        // We play and immediately pause.
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

        // Restore local blob if needed
        if (saved.currentTrackId) {
             const track = libraryTracks[saved.currentTrackId];
             if (track && track.source !== 'soundcloud') {
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
  }, [audioElement, libraryTracks]);

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
    
    // Check if new track is web based
    const nextTrackDef = libraryTracks[trackId];
    const isNextWeb = nextTrackDef?.source === 'soundcloud';

    // Stop current playback engines before switching logic
    if (audioElement && !audioElement.paused) {
        audioElement.pause();
    }
    // We don't manually stop ReactPlayer here, we let state change handle it via prop

    let currentBlob: Blob | null = null;
    if (!isNextWeb && (player.crossfadeEnabled || player.automixEnabled) && player.currentTrackId && immediate) {
        try {
            const currTrack = libraryTracks[player.currentTrackId];
            if (currTrack && currTrack.source !== 'soundcloud') {
                currentBlob = await dbService.getAudioBlob(player.currentTrackId);
            }
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
             if (nextTrackDef) {
               updateMediaSession(nextTrackDef);
               setDuration(nextTrackDef.duration || 0);
             }
        }

        return {
          ...prev,
          currentTrackId: trackId,
          queue: newQueue,
          originalQueue: newOriginalQueue,
          isPlaying: true // Always start playing
        };
      });

      if (immediate) {
        // --- WEB MODE ---
        if (isNextWeb) {
            // Logic handled by App.tsx rendering ReactPlayer with `playing=true`
            // We just need to ensure audio element is stopped/cleared
            if (audioElement) {
                audioElement.pause();
                audioElement.currentTime = 0;
            }
            setCurrentTime(0);
            return;
        }

        // --- LOCAL MODE ---
        if (!audioElement) return;

        // 1. TRY SYNC PLAYBACK FIRST (Critical for iOS)
        if (nextTrackUrlRef.current?.id === trackId) {
            const url = nextTrackUrlRef.current.url;
            nextTrackUrlRef.current = null;

            if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
            currentUrlRef.current = url;

            audioElement.src = url;
            audioElement.currentTime = 0;
            setCurrentTime(0);

            try {
                await audioElement.play();
            } catch (err) {
                console.error("Sync play failed", err);
                setPlayer(p => ({ ...p, isPlaying: false }));
            }
            upcomingTrackIdRef.current = null;
            return;
        }

        // 2. FALLBACK TO ASYNC
        let nextBlob = await dbService.getAudioBlob(trackId) || undefined;

        if (nextBlob) {
             safeResumeContext().catch(console.error);

             const isHidden = document.visibilityState === 'hidden';
             const shouldCrossfade = (player.crossfadeEnabled || player.automixEnabled) && !isHidden && currentBlob && crossfadeAudioElement;

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
  }, [libraryTracks, updateMediaSession, audioElement, crossfadeAudioElement, player.crossfadeEnabled, player.automixEnabled, player.crossfadeDuration, player.currentTrackId, player.shuffle, player.queue]);

  const togglePlay = useCallback(async () => {
    // WEB MODE
    if (isWebMode) {
        // ReactPlayer is controlled by `player.isPlaying` prop in App.tsx
        // But we might need to manually resume context or something?
        // Actually, just toggling state is enough for ReactPlayer prop
        setPlayer(p => ({ ...p, isPlaying: !p.isPlaying }));
        return;
    }

    // LOCAL MODE
    if (!audioElement) return;

    if (audioElement.paused) {
        safeResumeContext().catch(console.error);
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
  }, [audioElement, crossfadeAudioElement, isWebMode]);

  // Helper to determine the next track ID (deterministic)
  const calculateNextTrackId = useCallback((currentId: string | null, queue: string[], repeat: RepeatMode, automixEnabled: boolean, automixMode: string): string | null => {
      if (automixEnabled && (automixMode === 'smart' || automixMode === 'shuffle')) {
          const currentIdx = queue.indexOf(currentId || '');
          const restOfQueueIds = queue.slice(currentIdx + 1);

          if (restOfQueueIds.length === 0 && repeat === RepeatMode.ALL) {
               restOfQueueIds.push(...queue);
          }

          if (restOfQueueIds.length > 0) {
              const candidates = restOfQueueIds.map(id => libraryTracks[id]).filter(Boolean);
              const currentTrack = currentId ? libraryTracks[currentId] : null;

              if (currentTrack) {
                  const bestNext = getSmartNextTrack(currentTrack, candidates);
                  if (bestNext) return bestNext.id;
              }
          }
      }

      // Standard logic
      const currentIndex = queue.indexOf(currentId || '');
      if (currentIndex >= 0 && currentIndex < queue.length - 1) {
          return queue[currentIndex + 1];
      } else if (repeat === RepeatMode.ALL && queue.length > 0) {
          return queue[0];
      }
      return null;
  }, [libraryTracks]);

  const nextTrack = useCallback(() => {
     let nextId: string | null = upcomingTrackIdRef.current;

     if (!nextId) {
        nextId = calculateNextTrackId(player.currentTrackId, player.queue, player.repeat, player.automixEnabled, player.automixMode);
     }

     if (nextId) {
         playTrack(nextId, { immediate: true, fromQueue: true });
     }
  }, [player, playTrack, calculateNextTrackId]);

  const prevTrack = useCallback(() => {
      // Check current time from either engine
      const currTime = isWebMode ? (soundCloudPlayer?.getCurrentTime() || 0) : (audioElement?.currentTime || 0);

      if (currTime > 3) {
          handleSeek(0);
          return;
      }
      
      const currentIndex = player.queue.indexOf(player.currentTrackId || '');
      if (currentIndex > 0) {
          playTrack(player.queue[currentIndex - 1], { immediate: true, fromQueue: true });
      } else if (player.repeat === RepeatMode.ALL && player.queue.length > 0) {
          playTrack(player.queue[player.queue.length - 1], { immediate: true, fromQueue: true });
      }
  }, [player.queue, player.currentTrackId, player.repeat, playTrack, audioElement, isWebMode, soundCloudPlayer]);

  // --- SCRUBBING & SEEKING LOGIC ---

  const startScrub = useCallback(() => {
    isScrubbingRef.current = true;

    if (isWebMode) {
        wasPlayingBeforeScrubRef.current = player.isPlaying;
        setPlayer(p => ({...p, isPlaying: false})); // Pause for scrub
    } else if (audioElement) {
        wasPlayingBeforeScrubRef.current = !audioElement.paused;
        if (wasPlayingBeforeScrubRef.current) {
            audioElement.pause();
        }
    }
  }, [audioElement, isWebMode, player.isPlaying]);

  const scrub = useCallback((time: number) => {
    let d = duration;
    // Fallback if local duration is missing
    if (!isWebMode && (isNaN(d) || d === 0) && player.currentTrackId && libraryTracks[player.currentTrackId]) {
        d = libraryTracks[player.currentTrackId].duration;
    }

    const t = Math.max(0, Math.min(time, isNaN(d) ? 0 : d));

    if (isNaN(t)) return;

    setCurrentTime(t);

    if (isWebMode) {
         // ReactPlayer usually handles seek on release, but we update UI here
    } else if (audioElement) {
        if (audioElement.readyState < 1) {
            pendingSeekRef.current = t;
        } else {
            audioElement.currentTime = t;
            pendingSeekRef.current = null;
        }
    }

    if ('mediaSession' in navigator && !isNaN(d) && isFinite(d)) {
        try {
            navigator.mediaSession.setPositionState({
                duration: d,
                playbackRate: 1,
                position: t
            });
        } catch(e) {}
    }
  }, [audioElement, player.currentTrackId, libraryTracks, duration, isWebMode]);

  const endScrub = useCallback(() => {
    isScrubbingRef.current = false;
    if (wasPlayingBeforeScrubRef.current) {
        if (isWebMode) {
            setPlayer(p => ({...p, isPlaying: true}));
            soundCloudPlayer?.seekTo(currentTime);
        } else if (audioElement) {
            audioElement.play().catch(console.error);
        }
    } else if (isWebMode) {
        soundCloudPlayer?.seekTo(currentTime);
    }
  }, [audioElement, isWebMode, soundCloudPlayer, currentTime]);

  const handleSeek = useCallback((time: number) => {
      // 1. Calculate and clamp valid time
      let d = duration;
      if (!isWebMode && (isNaN(d) || !isFinite(d)) && player.currentTrackId && libraryTracks[player.currentTrackId]) {
          d = libraryTracks[player.currentTrackId].duration;
      }

      const validDuration = (isNaN(d) || !isFinite(d)) ? 0 : d;
      const t = Math.max(0, Math.min(time, validDuration));

      // 2. Optimistically update UI state
      setCurrentTime(t);

      // 3. Perform Seek
      if (isWebMode) {
          soundCloudPlayer?.seekTo(t);
      } else if (audioElement) {
           if (audioElement.paused && !wasPlayingBeforeScrubRef.current) {
               safeResumeContext().catch(() => {});
           }
           if (Number.isFinite(t)) {
               isManualSeekingRef.current = true;
               audioElement.currentTime = t;
           }
      }

      // 5. Reset flags
      pendingSeekRef.current = null;

      // 6. Update Lock Screen
      if ('mediaSession' in navigator && validDuration > 0) {
          try {
              navigator.mediaSession.setPositionState({
                  duration: validDuration,
                  playbackRate: 1,
                  position: t
              });
          } catch (e) {}
      }
  }, [audioElement, player.currentTrackId, libraryTracks, duration, isWebMode, soundCloudPlayer]);

  const setVolume = useCallback((volume: number) => {
      const v = Math.max(0, Math.min(1, volume));
      if (audioElement) audioElement.volume = v;
      if (crossfadeAudioElement) crossfadeAudioElement.volume = v; 
      // ReactPlayer volume is 0-1 as well? SoundCloud widget is 0-100?
      // react-player standardizes to 0-1
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

  // RAF Loop for Local
  useEffect(() => {
    if (!audioElement || !player.isPlaying || isWebMode) return;

    let rafId: number;
    const loop = () => {
      if (!audioElement.seeking && !isScrubbingRef.current && !isManualSeekingRef.current && audioElement.readyState >= 1) {
        setCurrentTime(audioElement.currentTime);
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [audioElement, player.isPlaying, isWebMode]);


  // --- EVENT LISTENERS (Local) ---
  useEffect(() => {
      if (!audioElement) return;

      let lastTimeUpdateRef = 0;
      const TIME_UPDATE_THROTTLE = 100;

      const onTimeUpdate = () => {
          if (!audioElement.seeking && !isScrubbingRef.current && !isManualSeekingRef.current) {
              const now = performance.now();
              if (now - lastTimeUpdateRef > TIME_UPDATE_THROTTLE) {
                  setCurrentTime(audioElement.currentTime);
                  lastTimeUpdateRef = now;
              }

              const timeLeft = audioElement.duration - audioElement.currentTime;
              if ((player.crossfadeEnabled || player.automixEnabled) &&
                  !isTransitioningRef.current &&
                  !isAutoTriggeredRef.current &&
                  timeLeft <= player.crossfadeDuration &&
                  timeLeft > 0.1) {

                   isAutoTriggeredRef.current = true;
                   nextTrack();
              }
          }
      };

      const onSeeked = () => {
          isManualSeekingRef.current = false;
          setCurrentTime(audioElement.currentTime);
      };

      const onDurationChange = () => {
         const d = audioElement.duration;
         setDuration(!isNaN(d) ? d : 0);
         isAutoTriggeredRef.current = false;
         if (pendingSeekRef.current !== null) {
             audioElement.currentTime = pendingSeekRef.current;
             pendingSeekRef.current = null;
         }
      };

      const onEnded = () => {
           isManualSeekingRef.current = false;
           if (player.currentTrackId) {
             dbService.incrementPlayCount(player.currentTrackId).catch(console.error);
           }
           if (player.repeat === RepeatMode.ONE) {
               audioElement.currentTime = 0;
               audioElement.play().catch(e => console.warn("Replay failed", e));
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
      };

      const onInterruptionEnd = () => {
          // iOS requires a tiny timeout or user interaction, but sometimes
          // just calling play() here works if the interruption was temporary
          if (player.isPlaying && audioElement.paused) {
               // Try to resume
               safeResumeContext().then(() => {
                   audioElement.play().catch(console.error);
               });
          }
      };

      const handleInterruption = () => {
        // If we were playing, try to resume logic or update state to Paused
        if (player.isPlaying && audioElement.paused) {
             setPlayer(p => ({ ...p, isPlaying: false }));
        }
      };

      // Only attach if NOT web mode or generally attach but check source?
      // If web mode is active, we should ignore local events if they happen (e.g. crossfade element?)
      // But crossfade element is separate.
      // This is for the MAIN audio element.

      audioElement.addEventListener('timeupdate', onTimeUpdate);
      audioElement.addEventListener('seeked', onSeeked);
      audioElement.addEventListener('loadedmetadata', onDurationChange);
      audioElement.addEventListener('ended', onEnded);
      audioElement.addEventListener('pause', onPause);
      audioElement.addEventListener('play', onPlay);

      // RESTORED: iOS Interruption recovery
      document.addEventListener('visibilitychange', onInterruptionEnd);
      // RESTORED: 'suspend' often fires on calls/alarms
      audioElement.addEventListener('suspend', handleInterruption);

      return () => {
          audioElement.removeEventListener('timeupdate', onTimeUpdate);
          audioElement.removeEventListener('seeked', onSeeked);
          audioElement.removeEventListener('loadedmetadata', onDurationChange);
          audioElement.removeEventListener('ended', onEnded);
          audioElement.removeEventListener('pause', onPause);
          audioElement.removeEventListener('play', onPlay);
          document.removeEventListener('visibilitychange', onInterruptionEnd);
          audioElement.removeEventListener('suspend', handleInterruption);
      };
  }, [nextTrack, player.repeat, audioElement, player.crossfadeEnabled, player.crossfadeDuration, player.isPlaying]); // removed isWebMode to prevent re-bind churn, logic handles web mode

  // --- PRELOAD NEXT TRACK ---
  useEffect(() => {
    const nextId = calculateNextTrackId(player.currentTrackId, player.queue, player.repeat, player.automixEnabled, player.automixMode);
    upcomingTrackIdRef.current = nextId;

    if (nextTrackUrlRef.current && nextTrackUrlRef.current.id !== nextId) {
        URL.revokeObjectURL(nextTrackUrlRef.current.url);
        nextTrackUrlRef.current = null;
    }

    if (nextTrackUrlRef.current?.id === nextId) return;

    if (nextId) {
        // Only preload if next track is LOCAL
        const nextTrack = libraryTracks[nextId];
        if (nextTrack && nextTrack.source !== 'soundcloud') {
            dbService.getAudioBlob(nextId).then(blob => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    nextTrackUrlRef.current = { id: nextId, url };
                }
            });
        }
    }
  }, [player.currentTrackId, player.queue, player.repeat, player.automixEnabled, player.automixMode, calculateNextTrackId, libraryTracks]);

  // --- RESTORED: Media Session ---
  useEffect(() => {
      if ('mediaSession' in navigator) {
          try {
              navigator.mediaSession.setActionHandler('play', () => {
                  safeResumeContext().catch(console.error);
                  togglePlay();
              });
              navigator.mediaSession.setActionHandler('pause', () => togglePlay());
              navigator.mediaSession.setActionHandler('previoustrack', () => {
                  safeResumeContext().catch(console.error);
                  prevTrack();
              });
              navigator.mediaSession.setActionHandler('nexttrack', () => {
                  safeResumeContext().catch(console.error);
                  nextTrack();
              });
              navigator.mediaSession.setActionHandler('seekto', (d) => { 
                  if (d.seekTime !== undefined) {
                      safeResumeContext().catch(console.error);
                      handleSeek(d.seekTime); 
                  }
              });
              
              const isPaused = isWebMode ? !player.isPlaying : audioElement?.paused;
              navigator.mediaSession.playbackState = isPaused ? 'paused' : 'playing';
          } catch (e) {}
      }
  }, [togglePlay, prevTrack, nextTrack, handleSeek, audioElement?.paused, isWebMode, player.isPlaying]);

  useEffect(() => {
      const currentTrack = player.currentTrackId ? libraryTracks[player.currentTrackId] : null;
      if (currentTrack && 'mediaSession' in navigator) {
          try { updateMediaSession(currentTrack); } catch (e) {}
      }
  }, [player.currentTrackId, libraryTracks, updateMediaSession]);


  // --- WEB PLAYBACK CALLBACKS ---
  // These will be passed to ReactPlayer in App.tsx
  const onWebProgress = useCallback((state: { playedSeconds: number, loadedSeconds: number }) => {
      if (!isScrubbingRef.current) {
          setCurrentTime(state.playedSeconds);
      }
  }, []);

  const onWebDuration = useCallback((d: number) => {
      setDuration(d);
  }, []);

  const onWebEnded = useCallback(() => {
      if (player.repeat === RepeatMode.ONE) {
          // Loop
          soundCloudPlayer?.seekTo(0);
      } else {
          nextTrack();
      }
  }, [player.repeat, nextTrack, soundCloudPlayer]);

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
    setCrossfadeAudioElement,
    setSoundCloudPlayer, // Exported setter
    onWebProgress,
    onWebDuration,
    onWebEnded
  };
};
