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
    history: [],
    shuffle: false,
    repeat: RepeatMode.OFF,
    volume: 1,
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Keep track of the current object URL to revoke it
  const objectUrlRef = useRef<string | null>(null);

  // Initialize Audio object
  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    const updateProgress = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    // We need to handle 'ended' in a way that access the latest state,
    // but we can't easily put it in this useEffect without re-attaching listeners constantly.
    // So we'll use a separate effect for 'ended' or a ref for the latest player state.

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', updateDuration);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = player.volume;
    }
  }, [player.volume]);

  const playTrack = async (trackId: string, customQueue?: string[]) => {
    try {
      const audioBlob = await dbService.getAudioBlob(trackId);
      if (!audioBlob || !audioRef.current) return;

      // Revoke previous URL to prevent memory leak
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const url = URL.createObjectURL(audioBlob);
      objectUrlRef.current = url;
      audioRef.current.src = url;

      try {
        await audioRef.current.play();
      } catch (e) {
        console.warn("Playback failed (likely user interaction needed):", e);
      }

      const track = libraryTracks[trackId];
      if (track) updateMediaSession(track);

      setPlayer(prev => ({
        ...prev,
        currentTrackId: trackId,
        isPlaying: true,
        queue: customQueue || (prev.queue.length > 0 ? prev.queue : Object.keys(libraryTracks))
      }));

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
    const currentIndex = player.queue.indexOf(player.currentTrackId || '');
    if (currentIndex < player.queue.length - 1) {
      playTrack(player.queue[currentIndex + 1]);
    } else if (player.repeat === RepeatMode.ALL) {
      playTrack(player.queue[0]);
    } else {
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
    }
  }, [player.queue, player.currentTrackId, currentTime]);

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Handle 'ended' event
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnd = () => {
        if (player.repeat === RepeatMode.ONE) {
            audio.currentTime = 0;
            audio.play().catch(console.error);
        } else {
            nextTrack();
        }
    };

    audio.addEventListener('ended', handleEnd);
    return () => audio.removeEventListener('ended', handleEnd);
  }, [player.repeat, nextTrack]); // Re-bind when repeat mode or nextTrack logic changes

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
    audioRef, // Expose ref if needed for visualizer
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    handleSeek
  };
};
