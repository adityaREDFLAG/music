import { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../db';
import { Track, PlayerState, RepeatMode } from '../types';

export const useAudioPlayer = (
  libraryTracks: Record<string, Track>,
  updateMediaSession: (track: Track) => void
) => {
  const [player, setPlayer] = useState<PlayerState>({
    currentTrackId: null,
    isPlaying: false,
    queue: [],
    originalQueue: [],
    history: [],
    shuffle: false,
    repeat: RepeatMode.OFF,
    volume: 1,
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Fisher-Yates Shuffle Algorithm
  const shuffleArray = (array: string[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Initialize Audio
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    const updateProgress = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateDuration);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = player.volume;
  }, [player.volume]);

  // Main Play Function
  const playTrack = async (trackId: string, customQueue?: string[]) => {
    try {
      if (!audioRef.current) return;

      const audioBlob = await dbService.getAudioBlob(trackId);
      if (!audioBlob) {
        console.error("Audio blob not found");
        // Auto skip if not found?
        return;
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(audioBlob);
      objectUrlRef.current = url;
      audioRef.current.src = url;

      try {
        await audioRef.current.play();
      } catch (e) {
        console.warn("Playback failed:", e);
      }

      const track = libraryTracks[trackId];
      if (track) updateMediaSession(track);

      setPlayer(prev => {
        let newQueue = customQueue || (prev.queue.length > 0 ? prev.queue : Object.keys(libraryTracks));
        let newOriginalQueue = prev.originalQueue.length > 0 ? prev.originalQueue : newQueue;

        // If providing a custom queue, reset original queue too (e.g. playing a playlist)
        if (customQueue) {
            newOriginalQueue = [...customQueue];
        }

        // Handle shuffle if it was already on but we are starting a new context or track
        if (prev.shuffle && customQueue) {
            // If we are starting a new playlist in shuffle mode, shuffle it immediately
            // But keep the requested track first
            const others = customQueue.filter(id => id !== trackId);
            const shuffledOthers = shuffleArray(others);
            newQueue = [trackId, ...shuffledOthers];
        }

        return {
            ...prev,
            currentTrackId: trackId,
            isPlaying: true,
            queue: newQueue,
            originalQueue: newOriginalQueue
        };
      });

      dbService.setSetting('lastTrackId', trackId);
    } catch (error) {
      console.error("Error playing track:", error);
    }
  };

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (player.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setPlayer(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [player.isPlaying]);

  const nextTrack = useCallback(() => {
    if (!player.currentTrackId || player.queue.length === 0) return;

    const currentIndex = player.queue.indexOf(player.currentTrackId);

    // Repeat ONE logic is handled in 'ended' event mostly, but if user clicks Next manually:
    // Standard behavior: Go to next track even if Repeat One is on.

    if (currentIndex < player.queue.length - 1) {
      playTrack(player.queue[currentIndex + 1]);
    } else if (player.repeat === RepeatMode.ALL) {
      // Loop back to start
      playTrack(player.queue[0]);
    } else {
      // End of queue, stop
      setPlayer(prev => ({ ...prev, isPlaying: false }));
    }
  }, [player.queue, player.currentTrackId, player.repeat]);

  const prevTrack = useCallback(() => {
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      return;
    }
    const currentIndex = player.queue.indexOf(player.currentTrackId || '');
    if (currentIndex > 0) {
      playTrack(player.queue[currentIndex - 1]);
    } else if (player.repeat === RepeatMode.ALL) {
       // Loop to end
       playTrack(player.queue[player.queue.length - 1]);
    }
  }, [player.queue, player.currentTrackId, currentTime, player.repeat]);

  // Handle Shuffle Toggle
  useEffect(() => {
    setPlayer(prev => {
        // If state didn't change, do nothing
        // We need to check if the queue actually needs update
        // This effect runs whenever player state changes, so we need to be careful not to loop
        // However, we are only responding to the 'shuffle' boolean changing if we were triggering this externally.
        // Since we update 'shuffle' and 'queue' together in the UI handlers usually, we might not need this effect
        // BUT, if the user toggles shuffle in the UI, we need to reshuffle the queue.

        // This approach is tricky inside a hook that manages the state.
        // Better to handle the logic in the toggle function in the UI or expose a toggleShuffle method here.
        return prev;
    });
  }, []); // Empty dependency, we'll expose a dedicated method

  const toggleShuffle = useCallback(() => {
      setPlayer(prev => {
          const isShuffling = !prev.shuffle;
          let newQueue = [...prev.queue];

          if (isShuffling) {
              // Turn Shuffle ON
              // Keep current track, shuffle the rest
              const currentId = prev.currentTrackId;
              const others = prev.originalQueue.filter(id => id !== currentId);
              const shuffledOthers = shuffleArray(others);
              if (currentId) {
                  newQueue = [currentId, ...shuffledOthers];
              } else {
                  newQueue = shuffledOthers;
              }
          } else {
              // Turn Shuffle OFF
              // Restore original order
              // We want to keep playing the current track, but the queue should be the original list
              newQueue = [...prev.originalQueue];
          }

          dbService.setSetting('shuffle', isShuffling);

          return {
              ...prev,
              shuffle: isShuffling,
              queue: newQueue
          };
      });
  }, []);

  // Update setPlayer wrapper to intercept shuffle changes if needed,
  // but better to just use toggleShuffle in the UI.

  // Handle 'ended' event
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnd = () => {
        // Must use latest state
        setPlayer(latestPlayer => {
            if (latestPlayer.repeat === RepeatMode.ONE) {
                audio.currentTime = 0;
                audio.play().catch(console.error);
                return latestPlayer;
            } else {
                // We can't call nextTrack() directly here because it depends on state closure.
                // We need to calculate next track ID here.
                const currentIndex = latestPlayer.queue.indexOf(latestPlayer.currentTrackId || '');
                if (currentIndex < latestPlayer.queue.length - 1) {
                    playTrack(latestPlayer.queue[currentIndex + 1]);
                } else if (latestPlayer.repeat === RepeatMode.ALL) {
                    playTrack(latestPlayer.queue[0]);
                } else {
                    return { ...latestPlayer, isPlaying: false };
                }
                return latestPlayer;
            }
        });
    };

    audio.addEventListener('ended', handleEnd);
    return () => audio.removeEventListener('ended', handleEnd);
  }, []); // No dependencies, we use the functional update of setPlayer

  // Watch for Repeat Mode changes to save to DB
  useEffect(() => {
      dbService.setSetting('repeat', player.repeat);
  }, [player.repeat]);

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Media Session Handlers
  useEffect(() => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
        navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
      }
  }, [togglePlay, prevTrack, nextTrack]);

  return {
    player,
    setPlayer,
    currentTime,
    duration,
    audioRef,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    handleSeek,
    toggleShuffle
  };
};
