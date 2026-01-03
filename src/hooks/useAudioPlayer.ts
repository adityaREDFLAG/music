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
      // We only do this if we are currently playing something
      if (prevBlob && !audioElement.paused) {
           isTransitioningRef.current = true;

           if (crossfadeUrlRef.current) URL.revokeObjectURL(crossfadeUrlRef.current);
           const prevUrl = URL.createObjectURL(prevBlob);
           crossfadeUrlRef.current = prevUrl;

           crossfadeAudioElement.src = prevUrl;
           crossfadeAudioElement.currentTime = audioElement.currentTime;
           crossfadeAudioElement.volume = audioElement.volume;

           // Play outgoing track
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
        // Optimistically try to get the blob for the *current* track to move it to secondary
        // But we might not have it in memory.
        // NOTE: This assumes we can fetch it fast enough.
        // For now, fetch it.
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

  const togglePlay = useCallback(() => {
    if (!audioElement) return;

    if (audioElement.paused) {
        resumeAudioContext().then(() => {
            audioElement.play()
                .then(() => setPlayer(p => ({ ...p, isPlaying: true })))
                .catch(err => {
                    setPlayer(p => ({ ...p, isPlaying: false }));
                });
        });
    } else {
        audioElement.pause();
        if (crossfadeAudioElement) crossfadeAudioElement.pause();
        setPlayer(p => ({ ...p, isPlaying: false }));
    }
  }, [audioElement, crossfadeAudioElement]);

  const nextTrack = useCallback(() => {
     // Automix Logic
     if (player.automixEnabled && (player.automixMode === 'smart' || player.automixMode === 'shuffle')) {
         // Find best candidate from the rest of the queue
         const currentIdx = player.queue.indexOf(player.currentTrackId || '');
         const restOfQueueIds = player.queue.slice(currentIdx + 1);

         // If we are at end of queue and repeat is ALL, wrap around
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

  const handleSeek = useCallback((time: number) => {
      if (!audioElement) return;
      
      const d = audioElement.duration;
      if (isNaN(d) || !isFinite(d) || d <= 0) return;
      
      const validDuration = d;
      const t = Math.max(0, Math.min(time, validDuration));
      
      try {
          audioElement.currentTime = t;
          setCurrentTime(t);
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

  // --- EVENT LISTENERS ---
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
          if (!audioElement.seeking) {
              const now = performance.now();
              if (now - lastTimeUpdateRef > TIME_UPDATE_THROTTLE) {
                  setCurrentTime(audioElement.currentTime);
                  lastTimeUpdateRef = now;
              }

              // Automix Trigger: If we are near end (e.g. 10s left) and automix is ON, maybe pre-fetch/schedule?
              // Currently we rely on 'ended', but for true beatmatching/crossfade we might want to trigger early.
              // For simple crossfade, 'ended' is too late. We need to trigger slightly before 'ended'.
              // But standard crossfade usually happens on track change.
              // If we want "continuous mix", we should trigger next track before current one ends.

              const timeLeft = audioElement.duration - audioElement.currentTime;
              if (player.crossfadeEnabled && !isTransitioningRef.current && timeLeft <= player.crossfadeDuration && timeLeft > 0) {
                   // This is where "Auto Crossfade" happens for continuous playback
                   // BUT be careful not to trigger it multiple times.
                   // This requires a "hasTriggeredNext" ref.
                   // Leaving this out for now to avoid complexity bugs, relying on manual or standard end-of-track flow
                   // unless user specifically requested "Seamless Automix" which implies this behavior.

                   // For now, let's stick to "Transitions happen when nextTrack is called" or on Ended.
                   // To make it truly seamless, we'd need to call nextTrack() BEFORE 'ended'.
              }
          }
      };

      const onSeeked = () => {
          setCurrentTime(audioElement.currentTime);
          updatePositionState();
      };

      const onDurationChange = () => {
         const d = audioElement.duration;
         setDuration(!isNaN(d) && isFinite(d) ? d : 0);
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
          // Only update state if not transitioning
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
      // Logic same as before...
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

  // --- MEDIA SESSION ---
  useEffect(() => {
      if ('mediaSession' in navigator) {
          try {
              navigator.mediaSession.setActionHandler('play', () => togglePlay());
              navigator.mediaSession.setActionHandler('pause', () => togglePlay());
              navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
              navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
              navigator.mediaSession.setActionHandler('seekto', (d) => { if (d.seekTime !== undefined) handleSeek(d.seekTime); });
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
    setVolume,
    toggleShuffle,
    setAudioElement,
    setCrossfadeAudioElement
  };
};
