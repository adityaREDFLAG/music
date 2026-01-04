import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Music, Play, Shuffle, ListFilter, Settings, Trash2, 
  PlusCircle, Loader2, X, Mic2, Users, ChevronLeft, 
  Disc, Heart, Check, Sparkles, Key
} from 'lucide-react';
import { Track, PlayerState, Playlist } from '../types';
import { dbService } from '../db';
import Playlists from './Playlists';
import AddToPlaylistModal from './AddToPlaylistModal';
import { getOrFetchArtistImage } from '../utils/artistImage';

// --- TYPES ---
type LibraryTab = 'Songs' | 'Albums' | 'Artists' | 'Playlists' | 'Settings';
type SortOption = 'added' | 'title' | 'artist';

interface LibraryProps {
  activeTab: string;
  libraryTab: LibraryTab;
  setLibraryTab: (tab: LibraryTab) => void;
  filteredTracks: Track[];
  playerState: PlayerState;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
  playTrack: (id: string, options?: any) => void;
  refreshLibrary: () => void;
  isLoading?: boolean;
}

// --- UTILS ---
const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

// --- COMPONENTS ---

const SkeletonRow = () => (
  <div className="flex items-center gap-4 py-2 px-2 opacity-50">
    <div className="w-14 h-14 rounded-[12px] bg-surface-variant animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-1/3 bg-surface-variant rounded-full animate-pulse" />
      <div className="h-3 w-1/4 bg-surface-variant/50 rounded-full animate-pulse" />
    </div>
  </div>
);

// Optimized Artist Row
// Handles lazy loading of artist images
const ArtistRow = memo(({ artist, displayArtist, trackCount, coverArt, onClick }: {
    artist: string; displayArtist: string; trackCount: number; coverArt?: string; onClick: () => void;
}) => {
    const [image, setImage] = useState<string | undefined>(coverArt);

    useEffect(() => {
        let active = true;
        // If we don't have a coverArt (album art fallback), or we want to try to get a better artist image
        // Actually, let's prioritize the Artist Image from Wikipedia if available, otherwise fallback to coverArt

        const load = async () => {
             const wikiImage = await getOrFetchArtistImage(displayArtist);
             if (active) {
                 if (wikiImage) {
                     setImage(wikiImage);
                 } else if (!image && coverArt) {
                     // Fallback to what was passed (album art)
                     setImage(coverArt);
                 }
             }
        };
        load();
        return () => { active = false; };
    }, [displayArtist, coverArt]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="flex items-center gap-4 p-2 rounded-2xl cursor-pointer hover:bg-surface-variant/40 transition-colors group"
        >
            <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-variant flex-shrink-0 shadow-sm relative">
                {image ? (
                    <img src={image} alt={displayArtist} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-variant to-surface-variant-dim">
                        <Users className="w-6 h-6 text-on-surface/40" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold truncate text-on-surface">{displayArtist}</h3>
                <p className="text-sm text-on-surface/60">{trackCount} {trackCount === 1 ? 'Song' : 'Songs'}</p>
            </div>
            <div className="w-10 h-10 rounded-full border border-surface-variant/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-5 h-5 fill-current text-primary ml-0.5" />
            </div>
        </motion.div>
    );
});
ArtistRow.displayName = 'ArtistRow';

// Optimized Track Row
const TrackRow = memo(({ 
  track, index, onPlay, isPlaying, isCurrentTrack, onDelete, onAddToPlaylist 
}: { 
  track: Track; 
  index: number; 
  onPlay: (id: string) => void;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  onDelete: (id: string) => void;
  onAddToPlaylist: (id: string) => void;
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.2 }}
            className={`group relative flex items-center gap-4 p-2 rounded-2xl transition-all cursor-pointer border border-transparent ${
                isCurrentTrack 
                ? 'bg-primary/10 border-primary/5' 
                : 'hover:bg-surface-variant/30'
            }`}
            onClick={() => onPlay(track.id)}
        >
            {/* Thumbnail */}
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0">
                <div className={`w-full h-full rounded-[12px] overflow-hidden shadow-sm transition-all ${
                    isCurrentTrack ? 'ring-2 ring-primary/30' : 'bg-surface-variant'
                }`}>
                    {track.coverArt ? (
                        <img 
                            src={track.coverArt} 
                            alt={track.title}
                            className={`w-full h-full object-cover transition-opacity ${isCurrentTrack && isPlaying ? 'opacity-40' : 'opacity-100'}`} 
                            loading="lazy" 
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-surface-variant">
                            <Music className={`w-6 h-6 ${isCurrentTrack ? 'text-primary' : 'text-on-surface/40'}`} />
                        </div>
                    )}
                </div>
                
                {/* Overlay Icon */}
                <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                    isCurrentTrack && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 bg-black/20 rounded-[12px]'
                }`}>
                    {isCurrentTrack && isPlaying ? (
                        <Loader2 className="w-6 h-6 text-primary animate-spin drop-shadow-md" />
                    ) : (
                        <Play className="w-6 h-6 fill-white text-white drop-shadow-md ml-0.5" />
                    )}
                </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <h3 className={`text-base font-semibold truncate ${isCurrentTrack ? 'text-primary' : 'text-on-surface'}`}>
                    {track.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-on-surface/60 truncate">
                    <span className="truncate hover:text-on-surface transition-colors">{track.artist}</span>
                </div>
            </div>

            {/* Duration (Hidden on small screens) */}
            <span className="hidden sm:block text-xs text-on-surface/40 font-mono tracking-wider">
                {formatDuration(track.duration)}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                    onClick={(e) => { e.stopPropagation(); onAddToPlaylist(track.id); }}
                    className="p-2 rounded-full text-on-surface/50 hover:bg-surface-variant hover:text-primary transition-all"
                    title="Add to Playlist"
                >
                    <PlusCircle className="w-5 h-5" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(track.id); }}
                    className="p-2 rounded-full text-on-surface/50 hover:bg-error/10 hover:text-error transition-all"
                    title="Delete Track"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
        </motion.div>
    );
});
TrackRow.displayName = 'TrackRow';


// --- SETTINGS COMPONENT ---
const ToggleRow = ({ label, subLabel, checked, onChange, children }: any) => (
    <div className="flex flex-col gap-3 py-2">
        <div className="flex items-center justify-between">
            <div className="flex flex-col">
                <span className="text-base font-medium text-on-surface">{label}</span>
                {subLabel && <span className="text-xs text-on-surface/60">{subLabel}</span>}
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
                <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-focus:ring-4 peer-focus:ring-primary/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
        </div>
        {checked && children && (
            <div className="mt-2 pl-2 border-l-2 border-primary/20 animate-in fade-in slide-in-from-top-2 duration-200">
                {children}
            </div>
        )}
    </div>
);

const SettingsTab = ({ playerState, setPlayerState }: { playerState: PlayerState, setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>> }) => {
    const [wordSyncEnabled, setWordSyncEnabled] = useState(false);
    const [geminiKey, setGeminiKey] = useState('');

    useEffect(() => {
        dbService.getSetting<boolean>('wordSyncEnabled').then(val => setWordSyncEnabled(val || false));
        dbService.getSetting<string>('geminiApiKey').then(val => setGeminiKey(val || ''));
    }, []);

    const handleWordSyncToggle = (enabled: boolean) => {
        setWordSyncEnabled(enabled);
        dbService.setSetting('wordSyncEnabled', enabled);
    };

    const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setGeminiKey(val);
        dbService.setSetting('geminiApiKey', val);
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
            className="flex flex-col gap-6 p-1 max-w-2xl mx-auto w-full"
        >
            <section>
                <h2 className="text-sm font-bold text-on-surface/50 uppercase tracking-wider mb-3">Playback</h2>
                <div className="bg-surface-variant/20 border border-white/5 rounded-3xl p-5 flex flex-col gap-4">
                    <ToggleRow 
                        label="Automix" 
                        subLabel="Smart transitions & AI blending" 
                        checked={playerState.automixEnabled} 
                        onChange={(val: boolean) => setPlayerState(p => ({ ...p, automixEnabled: val }))}
                    >
                        <div className="flex flex-col gap-3 pt-2">
                            <span className="text-xs font-medium text-on-surface/80">Transition Style</span>
                            <div className="grid grid-cols-3 gap-2">
                                {['classic', 'smart', 'shuffle'].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setPlayerState(p => ({ ...p, automixMode: mode as any }))}
                                        className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all border ${
                                            playerState.automixMode === mode
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-surface-variant/50 border-transparent text-on-surface/70 hover:bg-surface-variant'
                                        }`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </ToggleRow>

                    <div className="h-px bg-surface-variant/50" />

                    <ToggleRow 
                        label="Crossfade" 
                        subLabel="Overlap songs for smoothness" 
                        checked={playerState.crossfadeEnabled} 
                        onChange={(val: boolean) => setPlayerState(p => ({ ...p, crossfadeEnabled: val }))}
                    >
                        <div className="flex flex-col gap-2 pt-1">
                            <div className="flex justify-between text-xs text-on-surface/70">
                                <span>Overlap</span>
                                <span>{playerState.crossfadeDuration || 5}s</span>
                            </div>
                            <input
                                type="range" min="1" max="12" step="1"
                                value={playerState.crossfadeDuration || 5}
                                onChange={(e) => setPlayerState(p => ({ ...p, crossfadeDuration: Number(e.target.value) }))}
                                className="w-full h-1.5 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                        </div>
                    </ToggleRow>

                    <div className="h-px bg-surface-variant/50" />
                    
                    <ToggleRow 
                        label="Normalize Volume" 
                        subLabel="Consistent loudness across tracks"
                        checked={playerState.normalizationEnabled}
                        onChange={(val: boolean) => setPlayerState(p => ({ ...p, normalizationEnabled: val }))} 
                    />
                </div>
            </section>

            <section>
                <h2 className="text-sm font-bold text-on-surface/50 uppercase tracking-wider mb-3">Experimental</h2>
                <div className="bg-surface-variant/20 border border-white/5 rounded-3xl p-5 flex flex-col gap-4">
                     <ToggleRow
                        label="Word-by-word Lyrics"
                        subLabel="Use AI to generate synced lyrics (Requires Gemini API Key)"
                        checked={wordSyncEnabled}
                        onChange={handleWordSyncToggle}
                    >
                        <div className="flex flex-col gap-2 pt-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-on-surface/80">
                                <Sparkles className="w-3 h-3 text-primary" />
                                <span>Gemini API Key</span>
                            </div>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface/40" />
                                <input 
                                    type="password"
                                    value={geminiKey}
                                    onChange={handleKeyChange}
                                    placeholder="Enter your API Key"
                                    className="w-full h-10 pl-10 pr-4 bg-surface-variant/50 rounded-xl text-sm text-on-surface placeholder:text-on-surface/30 border border-transparent focus:border-primary/50 focus:bg-surface-variant outline-none transition-all"
                                />
                            </div>
                             <p className="text-[10px] text-on-surface/40 leading-relaxed">
                                Your key is stored locally on your device and never sent to our servers.
                            </p>
                        </div>
                    </ToggleRow>
                </div>
            </section>

            <section>
                <h2 className="text-sm font-bold text-on-surface/50 uppercase tracking-wider mb-3">About</h2>
                <div className="bg-surface-variant/20 border border-white/5 rounded-3xl p-5 text-center">
                    <p className="font-bold text-on-surface">Adi Music</p>
                    <p className="text-xs text-on-surface/50 mt-1">v1.2.0 • Build 2024</p>
                </div>
            </section>
        </motion.div>
    );
};


// --- MAIN LIBRARY COMPONENT ---
const Library: React.FC<LibraryProps> = ({ 
  activeTab, libraryTab, setLibraryTab, filteredTracks, 
  playerState, setPlayerState, playTrack, refreshLibrary, isLoading = false 
}) => {
  
  // State
  const [playlists, setPlaylists] = useState<Record<string, Playlist>>({});
  const [tracksMap, setTracksMap] = useState<Record<string, Track>>({});
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [selectedArtistKey, setSelectedArtistKey] = useState<string | null>(null); // New: Store normalized key
  const [sortOption, setSortOption] = useState<SortOption>('added');
  
  // Modal State
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [trackToAddId, setTrackToAddId] = useState<string | null>(null);

  // Load Data
  useEffect(() => {
    const load = async () => {
        const pl = await dbService.getAllPlaylists();
        const t = await dbService.getAllTracks();
        setPlaylists(pl.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
        setTracksMap(t.reduce((acc, tr) => ({ ...acc, [tr.id]: tr }), {}));
    };
    load();
  }, [libraryTab, refreshLibrary]);

  // Derived: Artists
  // Optimization: Merging logic
  const artistsList = useMemo(() => {
    // Key: Normalized Name (lower cased)
    // Value: { display: string, count: number, cover: string }
    const map = new Map<string, { display: string; count: number; cover?: string }>();

    filteredTracks.forEach(t => {
        const artist = t.artist || 'Unknown Artist';
        const normalized = artist.trim().toLowerCase();

        const current = map.get(normalized);

        if (current) {
             map.set(normalized, {
                 display: current.display, // Keep the first display name encountered, or logic to find best?
                 count: current.count + 1,
                 cover: current.cover || t.coverArt
             });
        } else {
             map.set(normalized, {
                 display: artist, // Use this casing as the display name
                 count: 1,
                 cover: t.coverArt
             });
        }
    });

    return Array.from(map.entries())
        .map(([key, data]) => ({
            key, // normalized key for filtering
            name: data.display,
            count: data.count,
            cover: data.cover
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTracks]);

  // Derived: Sorted Tracks
  const sortedTracks = useMemo(() => {
      return [...filteredTracks].sort((a, b) => {
          if (sortOption === 'title') return a.title.localeCompare(b.title);
          if (sortOption === 'artist') return a.artist.localeCompare(b.artist);
          return b.addedAt - a.addedAt; // Default 'added'
      });
  }, [filteredTracks, sortOption]);

  // Handlers (Memoized for performance)
  const handlePlayTrack = useCallback((id: string) => {
      // Create the queue based on current view
      let queue = sortedTracks.map(t => t.id);

      // If we are in artist view, filter by normalized key
      if (selectedArtistKey) {
          queue = sortedTracks
            .filter(t => (t.artist || 'Unknown Artist').trim().toLowerCase() === selectedArtistKey)
            .map(t => t.id);
      }
      playTrack(id, { customQueue: queue });
  }, [playTrack, sortedTracks, selectedArtistKey]);

  const handleDelete = useCallback((id: string) => {
    if(confirm('Delete track permanently?')) {
       dbService.deleteTrack(id);
       refreshLibrary();
    }
  }, [refreshLibrary]);

  const openAddToPlaylist = useCallback((id: string) => {
      setTrackToAddId(id);
      setIsPlaylistModalOpen(true);
  }, []);

  const handleShuffleAll = () => {
     if (sortedTracks.length > 0) {
        const randomId = sortedTracks[Math.floor(Math.random() * sortedTracks.length)].id;
        playTrack(randomId, { customQueue: sortedTracks.map(t => t.id) });
     }
  };

  const handlePlaylistSelect = async (playlistId: string) => {
      if (!trackToAddId) return;
      const playlist = playlists[playlistId];
      if (playlist.trackIds.includes(trackToAddId)) {
          alert("Track already in playlist");
          return;
      }
      const updatedPlaylist = { ...playlist, trackIds: [...playlist.trackIds, trackToAddId], updatedAt: Date.now() };
      await dbService.savePlaylist(updatedPlaylist);
      setPlaylists(prev => ({ ...prev, [playlistId]: updatedPlaylist }));
      setIsPlaylistModalOpen(false);
      setTrackToAddId(null);
  };

  const handleCreatePlaylist = async (name: string) => {
      if (!trackToAddId) return;
      const id = crypto.randomUUID();
      const newPlaylist: Playlist = {
          id, name, trackIds: [trackToAddId], createdAt: Date.now(), updatedAt: Date.now()
      };
      await dbService.savePlaylist(newPlaylist);
      setPlaylists(prev => ({ ...prev, [id]: newPlaylist }));
      setIsPlaylistModalOpen(false);
      setTrackToAddId(null);
  };

  // View Helpers
  const tracksToRender = selectedArtistKey
    ? sortedTracks.filter(t => (t.artist || 'Unknown Artist').trim().toLowerCase() === selectedArtistKey)
    : sortedTracks;

  return (
    <>
        <div className="flex flex-col h-full px-4 md:px-8 max-w-5xl mx-auto w-full">
            {/* Header & Tabs */}
            <div className="sticky top-0 z-20 bg-surface/95 backdrop-blur-md pt-6 pb-2 -mx-4 px-4 md:-mx-8 md:px-8 transition-all">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-3xl font-bold text-on-surface tracking-tight">Library</h1>
                    <button 
                        onClick={() => setLibraryTab('Settings')}
                        className={`p-2.5 rounded-full transition-all duration-300 ${libraryTab === 'Settings' ? 'bg-primary text-on-primary rotate-90' : 'hover:bg-surface-variant text-on-surface'}`}
                    >
                        <Settings className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                    {(['Songs', 'Albums', 'Artists', 'Playlists'] as LibraryTab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => { setLibraryTab(tab); setSelectedArtist(null); setSelectedArtistKey(null); }}
                        className={`px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                        libraryTab === tab
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-surface-variant/30 text-on-surface/70 border-transparent hover:bg-surface-variant hover:text-on-surface'
                        }`}
                    >
                        {tab}
                    </button>
                    ))}
                </div>
            </div>

            {/* Controls Row (Songs View Only) */}
            {libraryTab === 'Songs' && !selectedArtistKey && (
                <div className="flex items-center gap-3 my-4 animate-in slide-in-from-top-2 fade-in duration-300">
                    <button 
                        onClick={handleShuffleAll}
                        disabled={sortedTracks.length === 0}
                        className="flex-1 h-12 rounded-2xl bg-primary text-on-primary hover:bg-primary-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-semibold shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Shuffle className="w-5 h-5" />
                        <span>Shuffle Library</span>
                    </button>

                    <div className="relative group">
                        <button className="h-12 w-12 rounded-2xl bg-surface-variant/50 text-on-surface flex items-center justify-center hover:bg-surface-variant transition-colors">
                            <ListFilter className="w-5 h-5" />
                        </button>
                        {/* Hover Menu */}
                        <div className="absolute right-0 top-12 pt-2 w-48 hidden group-hover:block z-30">
                            <div className="bg-surface-container-high border border-white/10 rounded-xl shadow-2xl overflow-hidden p-1.5 flex flex-col gap-0.5 backdrop-blur-xl">
                                {[
                                    { label: 'Recently Added', val: 'added' },
                                    { label: 'Title (A-Z)', val: 'title' },
                                    { label: 'Artist (A-Z)', val: 'artist' }
                                ].map((opt) => (
                                    <button
                                        key={opt.val}
                                        onClick={() => setSortOption(opt.val as SortOption)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between group/item ${
                                            sortOption === opt.val ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-white/5'
                                        }`}
                                    >
                                        {opt.label}
                                        {sortOption === opt.val && <Check className="w-4 h-4" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex flex-col flex-1 min-h-0 w-full pb-20">
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : (
                    <AnimatePresence mode="wait">
                        {/* VIEW: SONGS */}
                        {libraryTab === 'Songs' && (
                            <motion.div 
                                key="songs-list"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="flex flex-col gap-1 w-full"
                            >
                                {tracksToRender.length > 0 ? (
                                    tracksToRender.map((track, i) => (
                                        <TrackRow
                                            key={track.id}
                                            track={track}
                                            index={i}
                                            onPlay={handlePlayTrack}
                                            isPlaying={playerState.isPlaying}
                                            isCurrentTrack={playerState.currentTrackId === track.id}
                                            onDelete={handleDelete}
                                            onAddToPlaylist={openAddToPlaylist}
                                        />
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-on-surface/40">
                                        <Music className="w-16 h-16 mb-4 opacity-50 stroke-1" />
                                        <p>Your library is empty</p>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* VIEW: ARTISTS */}
                        {libraryTab === 'Artists' && (
                            selectedArtistKey ? (
                                <motion.div key="artist-detail" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                                    <div className="flex items-center gap-4 mb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10 py-2">
                                        <button onClick={() => { setSelectedArtist(null); setSelectedArtistKey(null); }} className="p-2 -ml-2 rounded-full hover:bg-surface-variant/50">
                                            <ChevronLeft className="w-6 h-6" />
                                        </button>
                                        {/* We can use the Artist Image here too, but for now just name */}
                                        <h2 className="text-2xl font-bold">{selectedArtist}</h2>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        {tracksToRender.map((track, i) => (
                                            <TrackRow
                                                key={track.id}
                                                track={track}
                                                index={i}
                                                onPlay={handlePlayTrack}
                                                isPlaying={playerState.isPlaying}
                                                isCurrentTrack={playerState.currentTrackId === track.id}
                                                onDelete={handleDelete}
                                                onAddToPlaylist={openAddToPlaylist}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div key="artists-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
                                    {artistsList.map((artist) => (
                                        <ArtistRow
                                            key={artist.key}
                                            artist={artist.key}
                                            displayArtist={artist.name}
                                            trackCount={artist.count}
                                            coverArt={artist.cover}
                                            onClick={() => { setSelectedArtist(artist.name); setSelectedArtistKey(artist.key); }}
                                        />
                                    ))}
                                </motion.div>
                            )
                        )}

                        {/* VIEW: PLAYLISTS */}
                        {libraryTab === 'Playlists' && (
                            <Playlists
                                playlists={playlists}
                                tracks={tracksMap}
                                playTrack={playTrack}
                                refreshLibrary={refreshLibrary}
                            />
                        )}

                        {/* VIEW: SETTINGS */}
                        {libraryTab === 'Settings' && (
                             <SettingsTab playerState={playerState} setPlayerState={setPlayerState} />
                        )}
                    </AnimatePresence>
                )}
            </div>
        </div>

        <AddToPlaylistModal
            isOpen={isPlaylistModalOpen}
            onClose={() => setIsPlaylistModalOpen(false)}
            playlists={Object.values(playlists)}
            onSelectPlaylist={handlePlaylistSelect}
            onCreatePlaylist={handleCreatePlaylist}
        />
    </>
  );
};

export default Library;
