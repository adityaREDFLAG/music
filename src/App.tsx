import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import JSZip from 'jszip';
import { dbService } from './db';
import { Track, LibraryState, RepeatMode } from './types';
import { useMetadata } from './hooks/useMetadata';
import { parseTrackMetadata } from './utils/metadata';
import LoadingOverlay from './components/LoadingOverlay';
import BottomNav from './components/BottomNav';
import Home from './components/Home';
import Library from './components/Library';
import Search from './components/Search';
import MiniPlayer from './components/MiniPlayer';
import FullPlayer from './components/FullPlayer';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { ToastProvider, useToast } from './components/Toast';

type LibraryTab = 'Songs' | 'Albums' | 'Artists' | 'Playlists';

function MusicApp() {
  const metadata = useMetadata();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('home');
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('Songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [library, setLibrary] = useState<LibraryState>({ tracks: {}, playlists: {} });
  const [themeColor, setThemeColor] = useState('#6750A4'); // Default primary color
  const [loading, setLoading] = useState<{ active: boolean, progress: number, message: string }>({ active: false, progress: 0, message: '' });

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

  const {
    player,
    setPlayer,
    currentTime,
    duration,
    audioRef,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    handleSeek
  } = useAudioPlayer(library.tracks, updateMediaSession);

  // Initial Load
  useEffect(() => {
    dbService.init().then(async () => {
      await refreshLibrary();
      const lastId = await dbService.getSetting<string>('lastTrackId');
      const savedShuffle = await dbService.getSetting<boolean>('shuffle');
      const savedRepeat = await dbService.getSetting<RepeatMode>('repeat');

      if (lastId) {
          setPlayer(prev => ({
              ...prev,
              currentTrackId: lastId,
              shuffle: !!savedShuffle,
              repeat: savedRepeat || RepeatMode.OFF
          }));
      }
    });
  }, [refreshLibrary, setPlayer]);

  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const tracks = Object.values(library.tracks).filter((t: Track) =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.album.toLowerCase().includes(q)
    );
    return tracks.sort((a: Track, b: Track) => b.addedAt - a.addedAt);
  }, [library.tracks, searchQuery]);

  const currentTrack = useMemo(() =>
    player.currentTrackId ? library.tracks[player.currentTrackId] : null
  , [player.currentTrackId, library.tracks]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading({ active: true, progress: 0, message: 'Warming up the deck...' });

    try {
      // @ts-ignore
      const fileList = Array.from(files);
      const existingTitles = new Set(Object.values(library.tracks).map((t: any) => t.title));
      let addedCount = 0;

      for (let fIdx = 0; fIdx < fileList.length; fIdx++) {
        // @ts-ignore
        const file = fileList[fIdx];
        // @ts-ignore
        if (file.name.toLowerCase().endsWith('.zip')) {
          // @ts-ignore
          setLoading(l => ({ ...l, message: `Extracting ${file.name}...` }));
          // @ts-ignore
          const zip = await JSZip.loadAsync(file);
          // @ts-ignore
          const entries = Object.values(zip.files).filter((f: any) => !f.dir && f.name.match(/\.(mp3|wav|flac|m4a|ogg)$/i));

          for (let i = 0; i < entries.length; i++) {
            // @ts-ignore
            const entry = entries[i];
            // @ts-ignore
            if (entry.name.includes('__MACOSX') || entry.name.split('/').pop()?.startsWith('._')) continue;
            // @ts-ignore
            const rawTitle = entry.name.split('/').pop()!.replace(/\.[^/.]+$/, "");
            // @ts-ignore
            const blob = await entry.async('blob');
            const meta = await parseTrackMetadata(blob, rawTitle);

            if (existingTitles.has(meta.title)) continue;
            existingTitles.add(meta.title);

            const id = crypto.randomUUID();
            await dbService.saveTrack({
              id,
              title: meta.title,
              artist: meta.artist,
              album: meta.album,
              coverArt: meta.coverArt,
              duration: meta.duration,
              addedAt: Date.now()
            }, blob);
            addedCount++;
            setLoading(l => ({ ...l, progress: ((fIdx / fileList.length) * 100) + (((i + 1) / entries.length) * (100 / fileList.length)) }));
          }
        } else {
          // @ts-ignore
          const rawTitle = file.name.replace(/\.[^/.]+$/, "");
          // @ts-ignore
          const meta = await parseTrackMetadata(file, rawTitle);

          if (existingTitles.has(meta.title)) continue;
          existingTitles.add(meta.title);

          const id = crypto.randomUUID();
          await dbService.saveTrack({
            id,
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            coverArt: meta.coverArt,
            duration: meta.duration,
            addedAt: Date.now()
            // @ts-ignore
          }, file);
          addedCount++;
        }
        setLoading(l => ({ ...l, progress: ((fIdx + 1) / fileList.length) * 100 }));
      }
      await refreshLibrary();
      addToast(`Added ${addedCount} tracks to your library`, 'success');
    } catch (err) {
      console.error("Critical upload error:", err);
      addToast("Failed to process files. Ensure they are valid audio or ZIP archives.", 'error');
    } finally {
      setLoading({ active: false, progress: 0, message: '' });
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSeek(Number(e.target.value));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface text-surface-on safe-area-top safe-area-bottom">
      <AnimatePresence>{loading.active && <LoadingOverlay {...loading} />}</AnimatePresence>

      <div className="fixed inset-0 -z-10 opacity-[0.05]" style={{ background: `radial-gradient(circle at 50% 0%, ${themeColor}, transparent 70%)` }} />

      <header className="px-6 pt-12 pb-4 flex justify-between items-center bg-surface/80 backdrop-blur-md flex-shrink-0 z-10 sticky top-0">
        <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            <h1 className="text-display-small text-surface-on">
            {activeTab === 'home' ? metadata.name.split(' - ')[0] : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
          </h1>
        </motion.div>

        <label className="h-14 w-14 rounded-2xl bg-primary-container text-primary-on-container flex items-center justify-center cursor-pointer shadow-elevation-1 active:scale-95 transition-all hover:shadow-elevation-2">
          <Plus className="w-6 h-6" strokeWidth={2.5} />
          <input type="file" multiple accept="audio/*,.zip" onChange={handleFileUpload} className="hidden" />
        </label>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-32 scrollbar-hide scroll-smooth w-full max-w-[1600px] mx-auto">
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
        duration={duration}
        handleSeek={handleSeekChange}
        themeColor={themeColor}
      />

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MusicApp />
    </ToastProvider>
  );
}
