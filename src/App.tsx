import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import JSZip from 'jszip';
import { dbService } from './db';
import { Track, Playlist, RepeatMode, PlayerState, LibraryState } from './types';
import { useMetadata } from './hooks/useMetadata';
import LoadingOverlay from './components/LoadingOverlay';
import BottomNav from './components/BottomNav';
import Home from './components/Home';
import Library from './components/Library';
import Search from './components/Search';
import MiniPlayer from './components/MiniPlayer';
import FullPlayer from './components/FullPlayer';

type LibraryTab = 'Songs' | 'Albums' | 'Artists' | 'Playlists';

export default function App() {
  const metadata = useMetadata();
  const [activeTab, setActiveTab] = useState('home');
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('Songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [library, setLibrary] = useState<LibraryState>({ tracks: {}, playlists: {} });
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
  const [themeColor, setThemeColor] = useState('#6750A4');
  const [loading, setLoading] = useState<{ active: boolean, progress: number, message: string }>({ active: false, progress: 0, message: '' });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refreshLibrary = useCallback(async () => {
    const tracksArr = await dbService.getAllTracks();
    const playlistsArr = await dbService.getAllPlaylists();
    setLibrary({
      tracks: tracksArr.reduce((acc, t) => ({ ...acc, [t.id]: t }), {}),
      playlists: playlistsArr.reduce((acc, p) => ({ ...acc, [p.id]: p }), {})
    });
  }, []);

  const updateMediaSession = useCallback((track: Track) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: track.coverArt ? [{ src: track.coverArt }] : [
          { src: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=512&h=512&fit=crop', sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    }
  }, []);

  const playTrack = async (trackId: string, customQueue?: string[]) => {
    const audioBlob = await dbService.getAudioBlob(trackId);
    if (!audioBlob || !audioRef.current) return;

    const url = URL.createObjectURL(audioBlob);
    audioRef.current.src = url;
    audioRef.current.play().catch(e => console.warn("Background playback requires user interaction first.", e));

    const track = library.tracks[trackId];
    if (track) updateMediaSession(track);

    setPlayer(prev => ({
      ...prev,
      currentTrackId: trackId,
      isPlaying: true,
      queue: customQueue || (prev.queue.length > 0 ? prev.queue : Object.keys(library.tracks))
    }));

    // In a real app we would extract color from coverArt, here we stick to default or previous logic
    // For now we removed the color utils to simplify as requested, using default purple or random could work
    // If we want dynamic color, we need the utility back. But I removed it as part of cleanup.
    // I'll keep it static or use a simple heuristic if needed.
    setThemeColor('#6750A4');

    dbService.setSetting('lastTrackId', trackId);
  };

  const nextTrack = useCallback(() => {
    const currentIndex = player.queue.indexOf(player.currentTrackId || '');
    if (currentIndex < player.queue.length - 1) {
      playTrack(player.queue[currentIndex + 1]);
    } else if (player.repeat === RepeatMode.ALL) {
      playTrack(player.queue[0]);
    } else {
      setPlayer(prev => ({ ...prev, isPlaying: false }));
    }
  }, [player.queue, player.currentTrackId, player.repeat, library.tracks]);

  const prevTrack = useCallback(() => {
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      return;
    }
    const currentIndex = player.queue.indexOf(player.currentTrackId || '');
    if (currentIndex > 0) {
      playTrack(player.queue[currentIndex - 1]);
    }
  }, [player.queue, player.currentTrackId, currentTime, library.tracks]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (player.isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setPlayer(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, [player.isPlaying]);

  useEffect(() => {
    audioRef.current = new Audio();
    const audio = audioRef.current;

    dbService.init().then(async () => {
      await refreshLibrary();
      const lastId = await dbService.getSetting<string>('lastTrackId');
      const savedShuffle = await dbService.getSetting<boolean>('shuffle');
      const savedRepeat = await dbService.getSetting<RepeatMode>('repeat');
      if (lastId) setPlayer(prev => ({ ...prev, currentTrackId: lastId, shuffle: !!savedShuffle, repeat: savedRepeat || RepeatMode.OFF }));
    });

    const updateProgress = () => setCurrentTime(audio.currentTime);
    const handleEnd = () => player.repeat === RepeatMode.ONE ? (audio.currentTime = 0, audio.play()) : nextTrack();

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('ended', handleEnd);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', togglePlay);
      navigator.mediaSession.setActionHandler('pause', togglePlay);
      navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
      navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    }

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('ended', handleEnd);
    };
  }, [nextTrack, player.repeat, refreshLibrary, togglePlay, prevTrack]);

  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const tracks = Object.values(library.tracks).filter(t =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.album.toLowerCase().includes(q)
    );
    return tracks.sort((a,b) => b.addedAt - a.addedAt);
  }, [library.tracks, searchQuery]);

  const currentTrack = useMemo(() =>
    player.currentTrackId ? library.tracks[player.currentTrackId] : null
  , [player.currentTrackId, library.tracks]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading({ active: true, progress: 0, message: 'Warming up the deck...' });

    try {
      const fileList = Array.from(files);
      const existingTitles = new Set(Object.values(library.tracks).map(t => t.title));

      for (let fIdx = 0; fIdx < fileList.length; fIdx++) {
        const file = fileList[fIdx];
        if (file.name.toLowerCase().endsWith('.zip')) {
          setLoading(l => ({ ...l, message: `Extracting ${file.name}...` }));
          const zip = await JSZip.loadAsync(file);
          const entries = Object.values(zip.files).filter(f => !f.dir && f.name.match(/\.(mp3|wav|flac|m4a|ogg)$/i));

          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            // Skip macOS hidden files
            if (entry.name.includes('__MACOSX') || entry.name.split('/').pop()?.startsWith('._')) continue;

            const title = entry.name.split('/').pop()!.replace(/\.[^/.]+$/, "");
            if (existingTitles.has(title)) {
              console.log(`Skipping duplicate: ${title}`);
              continue;
            }
            existingTitles.add(title);

            const blob = await entry.async('blob');
            const id = crypto.randomUUID();
            await dbService.saveTrack({
              id,
              title,
              artist: 'Local Vibe',
              album: 'Zip Import',
              duration: 0,
              addedAt: Date.now()
            }, blob);
            setLoading(l => ({ ...l, progress: ((fIdx / fileList.length) * 100) + (((i + 1) / entries.length) * (100 / fileList.length)) }));
          }
        } else {
          const title = file.name.replace(/\.[^/.]+$/, "");
          if (existingTitles.has(title)) {
            console.log(`Skipping duplicate: ${title}`);
            continue;
          }
          existingTitles.add(title);

          const id = crypto.randomUUID();
          await dbService.saveTrack({
            id,
            title,
            artist: 'Local Vibe',
            album: 'Local Upload',
            duration: 0,
            addedAt: Date.now()
          }, file);
        }
        setLoading(l => ({ ...l, progress: ((fIdx + 1) / fileList.length) * 100 }));
      }
      await refreshLibrary();
    } catch (err) {
      console.error("Critical upload error:", err);
      alert("Failed to process files. Ensure they are valid audio or ZIP archives.");
    } finally {
      setLoading({ active: false, progress: 0, message: '' });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#FEF7FF] text-[#1C1B1F] safe-area-top safe-area-bottom">
      <AnimatePresence>{loading.active && <LoadingOverlay {...loading} />}</AnimatePresence>

      <div className="fixed inset-0 -z-10 opacity-[0.12] transition-colors duration-[1500ms]" style={{ background: `radial-gradient(circle at 50% 10%, ${themeColor}, transparent 80%)` }} />

      <header className="px-10 pt-16 pb-6 flex justify-between items-end bg-gradient-to-b from-white/40 to-transparent flex-shrink-0">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <h1 className="text-6xl font-black tracking-tighter mb-1 leading-none md:text-5xl lg:text-7xl">
            {activeTab === 'home' ? metadata.name.split(' - ')[0] : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </h1>
          <p className="text-xl font-bold opacity-30 tracking-tight">{filteredTracks.length} tracks synced locally</p>
        </motion.div>

        <label className="h-20 w-20 rounded-[38px] bg-[#EADDFF] text-[#21005D] flex items-center justify-center cursor-pointer shadow-[0_12px_40px_rgba(103,80,164,0.2)] active:scale-90 transition-all hover:bg-[#D1C4E9]">
          <Plus className="w-10 h-10" strokeWidth={3} />
          <input type="file" multiple accept="audio/*,.zip" onChange={handleFileUpload} className="hidden" />
        </label>
      </header>

      <main className="flex-1 overflow-y-auto px-10 pb-48 scrollbar-hide scroll-smooth w-full max-w-[1600px] mx-auto">
        <AnimatePresence mode="wait">
          <Home filteredTracks={filteredTracks} playTrack={playTrack} activeTab={activeTab} />
          <Library
            activeTab={activeTab}
            libraryTab={libraryTab}
            setLibraryTab={setLibraryTab}
            filteredTracks={filteredTracks}
            playerState={player}
            playTrack={playTrack}
            refreshLibrary={refreshLibrary}
          />
          <Search
            activeTab={activeTab}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredTracks={filteredTracks}
            playTrack={playTrack}
          />
        </AnimatePresence>
      </main>

      <MiniPlayer
        currentTrack={currentTrack}
        playerState={player}
        isPlayerOpen={isPlayerOpen}
        onOpen={() => setIsPlayerOpen(true)}
        togglePlay={togglePlay}
      />

      <FullPlayer
        currentTrack={currentTrack}
        playerState={player}
        isPlayerOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        togglePlay={togglePlay}
        nextTrack={nextTrack}
        prevTrack={prevTrack}
        setPlayerState={setPlayer}
        currentTime={currentTime}
        duration={audioRef.current?.duration || 0}
        handleSeek={handleSeek}
        themeColor={themeColor}
      />

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
