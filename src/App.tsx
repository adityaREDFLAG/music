import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import JSZip from 'jszip';
import { dbService } from './db';
import { Track, LibraryState, RepeatMode } from './types';
import { useMetadata } from './hooks/useMetadata';
import { parseTrackMetadata } from './utils/metadata';
import { extractDominantColor } from './utils/colors';
import LoadingOverlay from './components/LoadingOverlay';
import Home from './components/Home';
import Library from './components/Library';
import Search from './components/Search';
import MiniPlayer from './components/MiniPlayer';
import FullPlayer from './components/FullPlayer';
import { Layout } from './components/Layout';
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
  const [themeColor, setThemeColor] = useState('#6750A4'); 
  const [loading, setLoading] = useState<{ active: boolean, progress: number, message: string }>({ 
    active: false, progress: 0, message: '' 
  });

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
    togglePlay,
    nextTrack,
    prevTrack,
    handleSeek,
    toggleShuffle,
    playTrack
  } = useAudioPlayer(library.tracks, updateMediaSession);

  // --- NEW: Handle Queue Item Removal ---
  const handleRemoveFromQueue = useCallback((trackId: string) => {
    setPlayer(prev => ({
      ...prev,
      queue: prev.queue.filter(id => id !== trackId)
    }));
    addToast("Removed from queue", "success");
  }, [setPlayer, addToast]);

  // Initial Load
  useEffect(() => {
    dbService.init().then(async () => {
      await refreshLibrary();
      // Most of the state restoration happens inside useAudioPlayer now via 'playerState' key
    });
  }, [refreshLibrary]);

  // Handle Custom Settings Events (Quick bridge for Settings Tab)
  useEffect(() => {
      const handleSettingsUpdate = (e: any) => {
          const { detail } = e;
          if (detail) {
              setPlayer(prev => ({ ...prev, ...detail }));
          }
      };
      window.addEventListener('update-player-settings', handleSettingsUpdate);
      return () => window.removeEventListener('update-player-settings', handleSettingsUpdate);
  }, [setPlayer]);

  const currentTrack = useMemo(() =>
    player.currentTrackId ? library.tracks[player.currentTrackId] : null
  , [player.currentTrackId, library.tracks]);

  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const tracks = Object.values(library.tracks).filter((t: Track) =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.album.toLowerCase().includes(q)
    );
    return tracks.sort((a: Track, b: Track) => b.addedAt - a.addedAt);
  }, [library.tracks, searchQuery]);

  // Sync Theme Color
  useEffect(() => {
    if (currentTrack?.coverArt) {
      extractDominantColor(currentTrack.coverArt).then(color => {
        if (color) {
          const rgb = color.match(/\d+, \d+, \d+/)?.[0];
          if (rgb) {
            document.documentElement.style.setProperty('--color-primary', rgb);
            setThemeColor(color);
          }
        }
      });
    }
  }, [currentTrack]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading({ active: true, progress: 0, message: 'Warming up the deck...' });

    try {
      const fileList = Array.from(files);
      const existingTitles = new Set(Object.values(library.tracks).map((t: any) => t.title));
      let addedCount = 0;

      for (let fIdx = 0; fIdx < fileList.length; fIdx++) {
        const file = fileList[fIdx];
        if (file.name.toLowerCase().endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.values(zip.files).filter((f: any) => !f.dir && f.name.match(/\.(mp3|wav|flac|m4a|ogg)$/i));

          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry.name.includes('__MACOSX') || entry.name.split('/').pop()?.startsWith('._')) continue;
            const rawTitle = entry.name.split('/').pop()!.replace(/\.[^/.]+$/, "");
            const blob = await entry.async('blob');
            const meta = await parseTrackMetadata(blob, rawTitle);

            if (existingTitles.has(meta.title)) continue;
            existingTitles.add(meta.title);

            await dbService.saveTrack({
              id: crypto.randomUUID(),
              title: meta.title,
              artist: meta.artist,
              album: meta.album,
              coverArt: meta.coverArt,
              duration: meta.duration,
              addedAt: Date.now()
            }, blob);
            addedCount++;
          }
        } else {
          const rawTitle = file.name.replace(/\.[^/.]+$/, "");
          const meta = await parseTrackMetadata(file, rawTitle);
          if (existingTitles.has(meta.title)) continue;
          existingTitles.add(meta.title);

          await dbService.saveTrack({
            id: crypto.randomUUID(),
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            coverArt: meta.coverArt,
            duration: meta.duration,
            addedAt: Date.now()
          }, file);
          addedCount++;
        }
        setLoading(l => ({ ...l, progress: ((fIdx + 1) / fileList.length) * 100 }));
      }
      await refreshLibrary();
      addToast(`Added ${addedCount} tracks`, 'success');
    } catch (err) {
      addToast("Failed to process files", 'error');
    } finally {
      setLoading({ active: false, progress: 0, message: '' });
    }
  };

  return (
    /* LAYOUT IMPROVEMENT: 
       We pass isVisible={!isPlayerOpen} to the Layout so the BottomNav 
       hides when the full player is active.
    */
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      currentTrack={currentTrack}
      isVisible={!isPlayerOpen} 
    >
      <AnimatePresence>{loading.active && <LoadingOverlay {...loading} />}</AnimatePresence>

      <header className="pt-4 pb-6 flex justify-between items-center z-10 sticky top-0 bg-background/80 backdrop-blur-md px-4">
        <motion.h1 className="text-display-small text-on-background">
          {activeTab === 'home' ? 'Home' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        </motion.h1>

        <label className="h-12 w-12 rounded-xl bg-primary-container text-primary flex items-center justify-center cursor-pointer hover:bg-primary/20 transition-all">
          <Plus className="w-6 h-6" strokeWidth={2.5} />
          <input type="file" multiple accept="audio/*,.zip" onChange={handleFileUpload} className="hidden" />
        </label>
      </header>

      <main className="w-full pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && <Home key="home" filteredTracks={filteredTracks} playTrack={playTrack} activeTab={activeTab} />}
          {activeTab === 'library' && (
            <Library
              key="library"
              activeTab={activeTab}
              libraryTab={libraryTab}
              setLibraryTab={setLibraryTab}
              filteredTracks={filteredTracks}
              playerState={player}
              playTrack={playTrack}
              refreshLibrary={refreshLibrary}
            />
          )}
          {activeTab === 'search' && (
            <Search
              key="search"
              activeTab={activeTab}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filteredTracks={filteredTracks}
              playTrack={playTrack}
            />
          )}
        </AnimatePresence>
      </main>

      {/* MINI PLAYER POSITIONS ABOVE NAV: 
          The CSS in MiniPlayer handles its own offset from the bottom.
      */}
      <MiniPlayer
        currentTrack={currentTrack}
        playerState={player}
        isPlayerOpen={isPlayerOpen}
        onOpen={() => setIsPlayerOpen(true)}
        togglePlay={togglePlay}
        progress={currentTime / (duration || 1)}
      />

      <FullPlayer
        currentTrack={currentTrack}
        playerState={player}
        isPlayerOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        togglePlay={togglePlay}
        playTrack={playTrack}
        nextTrack={nextTrack}
        prevTrack={prevTrack}
        setPlayerState={setPlayer}
        currentTime={currentTime}
        duration={duration}
        handleSeek={(e) => handleSeek(Number(e.target.value))}
        themeColor={themeColor}
        toggleShuffle={toggleShuffle}
        onRemoveTrack={handleRemoveFromQueue} // Pass the new remove handler
      />
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MusicApp />
    </ToastProvider>
  );
}
