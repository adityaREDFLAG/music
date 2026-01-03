import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import JSZip from 'jszip';
import { dbService } from './db';
import { Track, LibraryState, RepeatMode } from './types';
import { useMetadata } from './hooks/useMetadata';
import { parseTrackMetadata } from './utils/metadata';
import { extractDominantColor, ThemePalette } from './utils/colors';
import LoadingOverlay from './components/LoadingOverlay';
import Home from './components/Home';
import Library from './components/Library';
import Search from './components/Search';
import MiniPlayer from './components/MiniPlayer';
import FullPlayer from './components/FullPlayer';
import { Layout } from './components/Layout';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer'; // IMPORTED HERE
import { ToastProvider, useToast } from './components/Toast';

type LibraryTab = 'Songs' | 'Albums' | 'Artists' | 'Playlists';

function MusicApp() {
  const metadata = useMetadata();
  const { addToast } = useToast();
  
  // UI State
  const [activeTab, setActiveTab] = useState('home');
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('Songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePalette | null>(null);
  
  // Data State
  const [library, setLibrary] = useState<LibraryState>({ tracks: {}, playlists: {} });
  const [loading, setLoading] = useState<{ active: boolean, progress: number, message: string }>({ 
    active: false, progress: 0, message: '' 
  });

  // --- LIBRARY MANAGEMENT ---

  const refreshLibrary = useCallback(async () => {
    const tracksArr = await dbService.getAllTracks();
    const playlistsArr = await dbService.getAllPlaylists();
    setLibrary({
      tracks: tracksArr.reduce((acc, t) => ({ ...acc, [t.id]: t }), {}),
      playlists: playlistsArr.reduce((acc, p) => ({ ...acc, [p.id]: p }), {})
    });
  }, []);

  // Initial Load
  useEffect(() => {
    dbService.init().then(async () => {
      await refreshLibrary();
    });
  }, [refreshLibrary]);

  // --- AUDIO PLAYER INTEGRATION ---

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
    setVolume,
    toggleShuffle,
    playTrack,
    setAudioElement // Exposed from useAudioPlayer
  } = useAudioPlayer(library.tracks, updateMediaSession);

  // We need to access the actual audio element ref here to pass to the analyzer
  // But setAudioElement is a callback ref. We can wrap it.
  const [audioElementNode, setAudioElementNode] = useState<HTMLAudioElement | null>(null);
  const setAudioRef = useCallback((node: HTMLAudioElement | null) => {
      setAudioElement(node);
      setAudioElementNode(node);
  }, [setAudioElement]);

  // ANALYZER MOVED TO APP LEVEL
  const analyzerData = useAudioAnalyzer(audioElementNode, player.isPlaying);

  // Queue Management
  const handleRemoveFromQueue = useCallback((trackId: string) => {
    setPlayer(prev => ({
      ...prev,
      queue: prev.queue.filter(id => id !== trackId)
    }));
    addToast("Removed from queue", "success");
  }, [setPlayer, addToast]);

  const handleTrackUpdate = useCallback((updatedTrack: Track) => {
    setLibrary(prev => ({
      ...prev,
      tracks: { ...prev.tracks, [updatedTrack.id]: updatedTrack }
    }));
  }, []);

  // Handle Settings Events (Custom Event Bridge)
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

  // --- DERIVED STATE ---

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

  // Dynamic Theme Color from Cover Art
  useEffect(() => {
    if (currentTrack?.coverArt) {
      extractDominantColor(currentTrack.coverArt).then(palette => {
        if (palette) {
          setTheme(palette);
          // Set global CSS variable for other components if needed
          const rgb = palette.primary.match(/\d+, \d+, \d+/)?.[0];
          if (rgb) {
              document.documentElement.style.setProperty('--color-primary', rgb);
          }
        }
      });
    }
  }, [currentTrack]);

  // --- FILE UPLOAD LOGIC ---

  const processFiles = async (files: FileList | null) => {
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  // --- GLOBAL DRAG & DROP ---

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }); 

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowRight':
                e.preventDefault();
                handleSeek(currentTime + 5);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                handleSeek(currentTime - 5);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setVolume(player.volume + 0.05);
                break;
            case 'ArrowDown':
                e.preventDefault();
                setVolume(player.volume - 0.05);
                break;
            case 'KeyM':
                e.preventDefault();
                setVolume(player.volume === 0 ? 1 : 0);
                break;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleSeek, currentTime, player.volume, setVolume]);

  return (
    <>
      {/* 2. THE BACKGROUND PLAY FIX: Render Audio Element Here */}
      <audio 
        ref={setAudioRef} // CHANGED to wrapped ref
        playsInline 
        crossOrigin="anonymous" // ADDED for Web Audio API
        preload="auto"
        onError={(e) => console.error("Audio tag error:", e)}
      />

      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        currentTrack={currentTrack}
        isVisible={!isPlayerOpen}
      >
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
                setPlayerState={setPlayer}
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
      </Layout>

      {/* OVERLAYS */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-primary/20 backdrop-blur-sm border-4 border-primary border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none"
          >
             <div className="bg-surface p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
                 <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center">
                    <Plus className="w-8 h-8 text-primary" />
                 </div>
                 <h2 className="text-xl font-bold text-on-surface">Drop files to add</h2>
             </div>
          </motion.div>
        )}
        {loading.active && <LoadingOverlay {...loading} />}
      </AnimatePresence>

      <AnimatePresence>
        {currentTrack && !isPlayerOpen && (
          <MiniPlayer
            currentTrack={currentTrack}
            playerState={player}
            isPlayerOpen={isPlayerOpen}
            onOpen={() => setIsPlayerOpen(true)}
            togglePlay={togglePlay}
            progress={currentTime / (duration || 1)}
          />
        )}
      </AnimatePresence>

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
        handleSeek={handleSeek}
        onVolumeChange={setVolume}
        theme={theme}
        toggleShuffle={toggleShuffle}
        onRemoveTrack={handleRemoveFromQueue}
        onTrackUpdate={handleTrackUpdate}
        analyzerData={analyzerData} // Pass analyzer data
      />
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MusicApp />
    </ToastProvider>
  );
}
