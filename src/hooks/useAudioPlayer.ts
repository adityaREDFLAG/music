import { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../db';
import { Track, PlayerState, RepeatMode } from '../types';

export const useAudioPlayer = (
  libraryTracks: Record<string, Track>,
  updateMediaSession: (track: Track) => void
) => {
  // --- STATE ---
  // FIXED: We use state for the audio element so the hook re-runs when it mounts
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
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

  // Helper Refs
  const nextTrackBlobRef = useRef<{ id: string; blob: Blob } | null>(null);
  const currentUrlRef = useRef<string | null>(null);

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
    };
  }, [audioElement]); // Dependency on audioElement ensures this runs once audio tag is ready

  // Save state on change
  useEffect(() => {
    saveState(player);
  }, [player, saveState]);


  // --- CORE LOGIC ---
  const playTrack = useCallback(async (trackId: string, options: {
    immediate?: boolean;
    fromQueue?: boolean;
    customQueue?: string[];
    preloadedBlob?: Blob;
  } = {}) => {
    const { immediate = true, fromQueue = false, customQueue, preloadedBlob } = options;
    
    // Safety check
    if (!audioElement) return;

    try {
      // 1. Update State synchronously
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

      // 2. Handle Audio Source & Playback
      if (immediate) {
        // If we have a preloaded blob, use it synchronously
        if (preloadedBlob) {
             if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
             const url = URL.createObjectURL(preloadedBlob);
             currentUrlRef.current = url;

             audioElement.src = url;
             audioElement.currentTime = 0;
             try {
                await audioElement.play();
             } catch (err) {
                 console.warn("Autoplay (preloaded) prevented:", err);
                 setPlayer(p => ({ ...p, isPlaying: false }));
             }
        } else {
             // Fallback to async fetch (might block on iOS if not triggered by user)
             const blob = await dbService.getAudioBlob(trackId);
             if (blob) {
                 if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
                 const url = URL.createObjectURL(blob);
                 currentUrlRef.current = url;

                 audioElement.src = url;
                 audioElement.currentTime = 0;
                 try {
                    await audioElement.play();
                 } catch (err) {
                     console.warn("Autoplay (fetched) prevented:", err);
                     setPlayer(p => ({ ...p, isPlaying: false }));
                 }
             } else {
                 console.error(`Audio blob not found for ${trackId}`);
             }
        }
      }

    } catch (e) {
      console.error("Playback error", e);
      setPlayer(p => ({ ...p, isPlaying: false }));
    }
  }, [libraryTracks, updateMediaSession, audioElement]);

  // WRAP togglePlay to ensure we capture the latest audioElement via closure or ref if needed
  // Since audioElement is in state, it should be fine, but we need to ensure the event handler has access.
  const togglePlay = useCallback(() => {
    if (!audioElement) return;

    if (audioElement.paused) {
        audioElement.play()
            .then(() => setPlayer(p => ({ ...p, isPlaying: true })))
            .catch(err => {
                console.error("Play failed:", err);
                setPlayer(p => ({ ...p, isPlaying: false }));
            });
    } else {
        audioElement.pause();
        setPlayer(p => ({ ...p, isPlaying: false }));
    }
  }, [audioElement]);

  const nextTrack = useCallback(() => {
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
      if (audioElement) {
          const d = audioElement.duration;
          const validDuration = !isNaN(d) && isFinite(d) ? d : 0;
          const t = Math.max(0, Math.min(time, validDuration));
          audioElement.currentTime = t;
          setCurrentTime(t);
      }
  }, [audioElement]);

  const setVolume = useCallback((volume: number) => {
      const v = Math.max(0, Math.min(1, volume));
      if (audioElement) {
          audioElement.volume = v;
      }
      setPlayer(p => ({ ...p, volume: v }));
  }, [audioElement]);

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

      const onTimeUpdate = () => {
          if (!audioElement.seeking) {
              setCurrentTime(audioElement.currentTime);
          }
      };
      const onSeeked = () => setCurrentTime(audioElement.currentTime);
      const onDurationChange = () => {
         const d = audioElement.duration;
         setDuration(!isNaN(d) && isFinite(d) ? d : 0);
      };
      const onEnded = () => {
           if (player.repeat === RepeatMode.ONE) {
               audioElement.currentTime = 0;
               audioElement.play();
           } else {
               nextTrack();
           }
      };
      // We rely on togglePlay to update state, but if external pause happens (e.g. system interrupt)
      const onPause = () => {
          if (!audioElement.ended) { // Don't set isPlaying=false if it just ended and is about to play next
             setPlayer(p => ({ ...p, isPlaying: false }));
          }
      };
      const onPlay = () => setPlayer(p => ({ ...p, isPlaying: true }));

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
  }, [nextTrack, player.repeat, audioElement]); // DEPENDENCY ON audioElement IS KEY

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
              if (blob) {
                  nextTrackBlobRef.current = { id: nextId, blob };
              }
          });
      } else {
          nextTrackBlobRef.current = null;
      }
  }, [player.currentTrackId, player.queue, player.repeat]);

  // --- MEDIA SESSION ---
  useEffect(() => {
      if ('mediaSession' in navigator) {
          navigator.mediaSession.setActionHandler('play', () => {
             // Explicitly use the togglePlay from the closure
             togglePlay();
          });
          navigator.mediaSession.setActionHandler('pause', () => {
             togglePlay();
          });
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
    toggleShuffle,
    setAudioElement // <--- We expose the SETTER now
  };
};
