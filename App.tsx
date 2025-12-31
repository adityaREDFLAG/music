
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { dbService } from './db';
import { Track, Playlist, RepeatMode, PlayerState, LibraryState } from './types';
import { extractPrimaryColor } from './utils/color';
import JSZip from 'jszip';
import { Layout } from './components/Layout/Layout';
import { LoadingOverlay } from './components/Shared/SharedComponents';
import { RecentHeat } from './components/Home/RecentHeat';
import { TrackList } from './components/Library/TrackList';
import { PlaylistGrid } from './components/Library/PlaylistGrid';
import { MiniPlayer } from './components/Player/MiniPlayer';
import { FullScreenPlayer } from './components/Player/FullScreenPlayer';
import { Search, PlayCircle, Music, Loader2 } from 'lucide-react';
import { config } from './utils/config';

type LibraryTab = 'Songs' | 'Albums' | 'Artists' | 'Playlists';

export default function App() {
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
  const [themeColor, setThemeColor] = useState(config.themeColor);
  const [loading, setLoading] = useState<{ active: boolean, progress: number, message: string }>({ active: false, progress: 0, message: '' });
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync Document Title
  useEffect(() => {
    document.title = config.name;
  }, []);

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

    if (track?.coverArt) {
      const color = await extractPrimaryColor(track.coverArt);
      setThemeColor(color);
    } else {
      setThemeColor(config.themeColor);
    }
    
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
    const tracks = Object.values(library.tracks).filter((t: any) =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.album.toLowerCase().includes(q)
    );
    return tracks.sort((a: any, b: any) => b.addedAt - a.addedAt);
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
      for (let fIdx = 0; fIdx < fileList.length; fIdx++) {
        const file = fileList[fIdx] as File;
        if (file.name.toLowerCase().endsWith('.zip')) {
          setLoading(l => ({ ...l, message: `Extracting ${file.name}...` }));
          const zip = await JSZip.loadAsync(file);
          // Explicitly type JSZip files to avoid implicit any/unknown errors
          const entries = Object.values(zip.files).filter((f: any) => !f.dir && f.name.match(/\.(mp3|wav|flac|m4a|ogg)$/i));
          
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i] as any;
            const blob = await entry.async('blob');
            const id = crypto.randomUUID();
            await dbService.saveTrack({ 
              id, 
              title: entry.name.split('/').pop()!.replace(/\.[^/.]+$/, ""), 
              artist: 'Local Vibe', 
              album: 'Zip Import', 
              duration: 0, 
              addedAt: Date.now() 
            }, blob);
            setLoading(l => ({ ...l, progress: ((fIdx / fileList.length) * 100) + (((i + 1) / entries.length) * (100 / fileList.length)) }));
          }
        } else {
          const id = crypto.randomUUID();
          await dbService.saveTrack({ 
            id, 
            title: file.name.replace(/\.[^/.]+$/, ""), 
            artist: 'Local Vibe', 
            album: 'Local Upload', 
            duration: 0, 
            addedAt: Date.now() 
          }, file as Blob);
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

  const handleDeleteTrack = async (id: string) => {
    await dbService.deleteTrack(id);
    refreshLibrary();
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      trackCount={filteredTracks.length}
      onFileUpload={handleFileUpload}
      themeColor={themeColor}
    >
      <AnimatePresence>{loading.active && <LoadingOverlay {...loading} />}</AnimatePresence>

      <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-16">
            <RecentHeat tracks={filteredTracks} onPlayAll={() => filteredTracks[0] && playTrack(filteredTracks[0].id)} onPlayTrack={playTrack} />
          </motion.div>
        )}

        {activeTab === 'library' && (
          <motion.div key="library" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
            <div className="flex gap-4 overflow-x-auto scrollbar-hide py-2">
              {(['Songs', 'Albums', 'Artists', 'Playlists'] as LibraryTab[]).map(t => (
                <button key={t} onClick={() => setLibraryTab(t)} className={`px-12 py-5 rounded-[32px] font-black text-xl transition-all shadow-sm ${libraryTab === t ? 'bg-[#21005D] text-white shadow-[#21005D]/20' : 'bg-white text-[#49454F] border border-black/[0.05]'}`}>{t}</button>
              ))}
            </div>

            {libraryTab === 'Songs' && (
              <TrackList tracks={filteredTracks} currentTrackId={player.currentTrackId} isPlaying={player.isPlaying} onPlay={playTrack} onDelete={handleDeleteTrack} />
            )}

            {libraryTab === 'Playlists' && (
              <PlaylistGrid playlists={[]} trackCount={filteredTracks.length} onCreate={() => alert("Playlist creation logic in development")} />
            )}
          </motion.div>
        )}

        {activeTab === 'search' && (
          <motion.div key="search" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-12">
            <div className="relative group">
              <Search className="absolute left-10 top-1/2 -translate-y-1/2 text-[#49454F] w-10 h-10 transition-colors group-focus-within:text-[#6750A4]" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Find your frequency..."
                className="w-full bg-[#F3EDF7] rounded-[60px] py-10 pl-24 pr-12 text-3xl font-black outline-none border-4 border-transparent focus:border-[#6750A4]/15 focus:bg-white transition-all shadow-inner"
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              {filteredTracks.map(t => (
                <motion.div
                  key={t.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => playTrack(t.id)}
                  className="p-8 bg-white rounded-[56px] shadow-sm flex items-center justify-between border border-black/[0.02] hover:shadow-xl transition-all"
                >
                  <div className="flex items-center gap-8">
                    <div className="w-20 h-20 bg-[#F3EDF7] rounded-[32px] flex items-center justify-center flex-shrink-0"><Music className="w-10 h-10 opacity-20" /></div>
                    <div>
                      <h4 className="text-2xl font-black tracking-tight">{t.title}</h4>
                      <p className="text-lg font-bold opacity-30 tracking-tight">{t.artist}</p>
                    </div>
                  </div>
                  <PlayCircle className="w-14 h-14 text-[#6750A4] opacity-40" strokeWidth={1.5} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MiniPlayer
        currentTrack={currentTrack}
        isPlaying={player.isPlaying}
        onTogglePlay={togglePlay}
        onOpenPlayer={() => setIsPlayerOpen(true)}
        isOpen={isPlayerOpen}
      />

      <FullScreenPlayer
        currentTrack={currentTrack}
        isPlaying={player.isPlaying}
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        onTogglePlay={togglePlay}
        onNext={nextTrack}
        onPrev={prevTrack}
        onShuffle={() => setPlayer(p => ({ ...p, shuffle: !p.shuffle }))}
        onRepeat={() => setPlayer(p => ({ ...p, repeat: p.repeat === RepeatMode.OFF ? RepeatMode.ALL : p.repeat === RepeatMode.ALL ? RepeatMode.ONE : RepeatMode.OFF }))}
        shuffle={player.shuffle}
        repeat={player.repeat}
        currentTime={currentTime}
        duration={audioRef.current?.duration || 0}
        onSeek={handleSeek}
        themeColor={themeColor}
      />
    </Layout>
  );
}
