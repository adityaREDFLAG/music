import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, Shuffle, ListFilter, Settings, Trash2, PlusCircle, Loader2, MoreVertical, X, Mic2, Users, ChevronLeft } from 'lucide-react';
import { Track, PlayerState, Playlist } from '../types';
import { dbService } from '../db';
import Playlists from './Playlists';
import AddToPlaylistModal from './AddToPlaylistModal';

type LibraryTab = 'Songs' | 'Albums' | 'Artists' | 'Playlists' | 'Settings';

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

// --- M3 LIST SKELETON ---
const SkeletonRow = () => (
  <div className="flex items-center gap-4 py-2 animate-pulse px-2">
    <div className="w-14 h-14 rounded-[12px] bg-surface-variant flex-shrink-0 relative overflow-hidden" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-1/2 bg-surface-variant rounded-full" />
      <div className="h-3 w-1/3 bg-surface-variant/50 rounded-full" />
    </div>
    <div className="w-8 h-8 rounded-full bg-surface-variant/30" />
  </div>
);

// --- ARTIST ROW COMPONENT ---
const ArtistRow = memo(({
    artist,
    trackCount,
    coverArt,
    onClick
}: {
    artist: string;
    trackCount: number;
    coverArt?: string;
    onClick: () => void;
}) => (
    <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="flex items-center gap-4 p-2 rounded-2xl cursor-pointer hover:bg-surface-variant/30 transition-all"
    >
        <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-variant flex-shrink-0">
            {coverArt ? (
                <img src={coverArt} alt={artist} className="w-full h-full object-cover" loading="lazy" />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-on-surface/50" />
                </div>
            )}
        </div>
        <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold truncate text-on-surface">{artist}</h3>
            <p className="text-sm text-on-surface/60">{trackCount} {trackCount === 1 ? 'Song' : 'Songs'}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-surface-variant/20 flex items-center justify-center">
            <Play className="w-4 h-4 fill-current text-primary ml-0.5" />
        </div>
    </motion.div>
));
ArtistRow.displayName = 'ArtistRow';


// --- TRACK ROW COMPONENT ---
const TrackRow = memo(({ 
  track, 
  index, 
  onPlay, 
  isPlaying, 
  isCurrentTrack, 
  onDelete,
  onAddToPlaylist
}: { 
  track: Track; 
  index: number; 
  onPlay: (id: string) => void;
  isPlaying: boolean; // Global playing state
  isCurrentTrack: boolean; // Is this specific track active?
  onDelete: (id: string) => void;
  onAddToPlaylist: (id: string) => void;
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ delay: index * 0.02, type: "spring", stiffness: 400, damping: 30 }}
    whileTap={{ scale: 0.98 }}
    onClick={() => onPlay(track.id)}
    className={`group relative flex items-center gap-4 p-2 rounded-2xl transition-all cursor-pointer border border-transparent ${
      isCurrentTrack 
        ? 'bg-primary/20 border-primary/10'
        : 'hover:bg-surface-variant/30'
    }`}
  >
    {/* Thumbnail Image */}
    <div className="relative w-14 h-14 flex-shrink-0">
      <div className={`w-full h-full rounded-[12px] overflow-hidden shadow-sm transition-all ${
        isCurrentTrack ? 'bg-primary/30' : 'bg-surface-variant'
      }`}>
        {track.coverArt ? (
          <img 
            src={track.coverArt} 
            alt={track.title}
            className={`w-full h-full object-cover transition-opacity ${isCurrentTrack && isPlaying ? 'opacity-40' : 'opacity-100'}`} 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music className={`w-6 h-6 ${isCurrentTrack ? 'text-primary' : 'text-on-surface/50'}`} />
          </div>
        )}
      </div>
      
      {/* Playing Indicator / Hover Overlay */}
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

    {/* Text Info */}
    <div className="flex-1 min-w-0 flex flex-col justify-center">
      <h3 className={`text-base font-semibold truncate leading-tight ${
        isCurrentTrack ? 'text-primary' : 'text-on-surface'
      }`}>
        {track.title}
      </h3>
      <p className="text-sm text-on-surface/60 truncate mt-0.5">
        {track.artist}
      </p>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
        onClick={(e) => {
            e.stopPropagation();
            onAddToPlaylist(track.id);
        }}
        className="p-2 rounded-full text-on-surface/50 hover:bg-surface-variant hover:text-primary transition-all"
        title="Add to Playlist"
        >
        <PlusCircle className="w-5 h-5" />
        </button>

        <button
        onClick={(e) => {
            e.stopPropagation();
            onDelete(track.id);
        }}
        className="p-2 rounded-full text-on-surface/50 hover:bg-error/20 hover:text-error transition-all"
        title="Delete Track"
        >
        <Trash2 className="w-5 h-5" />
        </button>
    </div>
  </motion.div>
));

TrackRow.displayName = 'TrackRow';

// --- SETTINGS COMPONENT ---
const SettingsTab = ({ playerState, setPlayerState }: { playerState: PlayerState, setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>> }) => {
    return (
        <div className="flex flex-col gap-6 p-4">
           <h2 className="text-xl font-bold text-on-surface">Automix System</h2>

           <div className="bg-surface-variant/30 rounded-2xl p-4 flex flex-col gap-6">
               {/* Automix Toggle */}
               <div className="flex items-center justify-between">
                   <div className="flex flex-col">
                       <span className="text-lg font-medium text-on-surface">Automix</span>
                       <span className="text-sm text-on-surface/60">Smart transitions & seamless blends</span>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={playerState.automixEnabled || false}
                            onChange={(e) => {
                                const val = e.target.checked;
                                setPlayerState(p => ({ ...p, automixEnabled: val }));
                            }}
                        />
                        <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-focus:ring-4 peer-focus:ring-primary/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
               </div>

               {playerState.automixEnabled && (
                   <div className="flex flex-col gap-4 pl-2 border-l-2 border-primary/20">
                       <div className="flex flex-col gap-2">
                           <span className="text-sm font-medium text-on-surface/80">Transition Style</span>
                           <div className="flex gap-2">
                               {['classic', 'smart', 'shuffle'].map((mode) => (
                                   <button
                                       key={mode}
                                       onClick={() => setPlayerState(p => ({ ...p, automixMode: mode as any }))}
                                       className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-all ${
                                           playerState.automixMode === mode
                                           ? 'bg-primary text-on-primary'
                                           : 'bg-surface-variant text-on-surface hover:bg-surface-variant-dim'
                                       }`}
                                   >
                                       {mode}
                                   </button>
                               ))}
                           </div>
                           <p className="text-xs text-on-surface/50 mt-1">
                               {playerState.automixMode === 'classic' && "Standard crossfade between songs."}
                               {playerState.automixMode === 'smart' && "Analyzes BPM & Key for perfect blends."}
                               {playerState.automixMode === 'shuffle' && "Jumps to compatible songs randomly."}
                           </p>
                       </div>

                       <div className="flex items-center justify-between">
                           <span className="text-sm font-medium text-on-surface/80">Volume Normalization</span>
                            <label className="relative inline-flex items-center cursor-pointer scale-90 origin-right">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={playerState.normalizationEnabled || false}
                                    onChange={(e) => {
                                        setPlayerState(p => ({ ...p, normalizationEnabled: e.target.checked }));
                                    }}
                                />
                                <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-focus:ring-4 peer-focus:ring-primary/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                       </div>
                   </div>
               )}

               <div className="h-px bg-surface-variant/50 my-1" />

               {/* Crossfade Settings */}
               <div className="flex items-center justify-between">
                   <div className="flex flex-col">
                       <span className="text-lg font-medium text-on-surface">Crossfade</span>
                       <span className="text-sm text-on-surface/60">Overlap songs for a smooth transition</span>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={playerState.crossfadeEnabled || false}
                            onChange={(e) => {
                                const val = e.target.checked;
                                setPlayerState(p => ({ ...p, crossfadeEnabled: val }));
                            }}
                        />
                        <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-focus:ring-4 peer-focus:ring-primary/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
               </div>

               {playerState.crossfadeEnabled && (
                   <div className="flex flex-col gap-2 pt-2">
                       <div className="flex justify-between text-sm text-on-surface/70">
                           <span>Duration</span>
                           <span>{playerState.crossfadeDuration || 5}s</span>
                       </div>
                       <input
                            type="range"
                            min="1"
                            max="12"
                            step="1"
                            value={playerState.crossfadeDuration || 5}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setPlayerState(p => ({ ...p, crossfadeDuration: val }));
                            }}
                            className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
                       />
                   </div>
               )}
           </div>

           <h2 className="text-xl font-bold text-on-surface mt-4">About</h2>
           <div className="bg-surface-variant/30 rounded-2xl p-4">
               <p className="text-on-surface/80">Adi Music v1.0</p>
               <p className="text-sm text-on-surface/60 mt-1">
                   A high-performance, music player built with React, Framer Motion, and Tailwind.
                 Built with love & a lot of AI 😞❤️‍🔥
               </p>
           </div>
        </div>
    );
};


// --- MAIN LIBRARY COMPONENT ---
const Library: React.FC<LibraryProps> = ({ 
  activeTab, 
  libraryTab, 
  setLibraryTab, 
  filteredTracks, 
  playerState, 
  setPlayerState,
  playTrack, 
  refreshLibrary,
  isLoading = false
}) => {
  const [playlists, setPlaylists] = React.useState<Record<string, Playlist>>({});
  const [tracksMap, setTracksMap] = React.useState<Record<string, Track>>({});

  // Drill Down State for Artists
  const [selectedArtist, setSelectedArtist] = React.useState<string | null>(null);

  // Sorting
  const [sortOption, setSortOption] = React.useState<'added' | 'title' | 'artist'>('added');

  // Playlist Modal State
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = React.useState(false);
  const [trackToAddId, setTrackToAddId] = React.useState<string | null>(null);

  // Effect to load playlists
  React.useEffect(() => {
    // We load playlists always now so we can show them in modal
    const load = async () => {
        const pl = await dbService.getAllPlaylists();
        const t = await dbService.getAllTracks();
        setPlaylists(pl.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
        setTracksMap(t.reduce((acc, tr) => ({ ...acc, [tr.id]: tr }), {}));
    };
    load();
  }, [activeTab, libraryTab, refreshLibrary]);

  // Derived Artists List
  const artistsList = React.useMemo(() => {
    const map = new Map<string, { count: number; cover?: string }>();
    filteredTracks.forEach(t => {
        const artist = t.artist || 'Unknown Artist';
        const current = map.get(artist) || { count: 0 };
        map.set(artist, {
            count: current.count + 1,
            cover: current.cover || t.coverArt // use first available cover
        });
    });
    return Array.from(map.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        cover: data.cover
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTracks]);

  const handleDelete = (id: string) => {
    if(confirm('Delete track permanently?')) {
       dbService.deleteTrack(id);
       refreshLibrary();
    }
  };

  const handleAddToPlaylistClick = (trackId: string) => {
      setTrackToAddId(trackId);
      setIsPlaylistModalOpen(true);
  };

  const handlePlaylistSelect = async (playlistId: string) => {
      if (!trackToAddId) return;

      const playlist = playlists[playlistId];
      if (playlist.trackIds.includes(trackToAddId)) {
          alert("Track already in playlist");
          return;
      }

      const updatedPlaylist = {
          ...playlist,
          trackIds: [...playlist.trackIds, trackToAddId],
          updatedAt: Date.now()
      };

      await dbService.savePlaylist(updatedPlaylist);

      // Update local state
      setPlaylists(prev => ({ ...prev, [playlistId]: updatedPlaylist }));
      setIsPlaylistModalOpen(false);
      setTrackToAddId(null);
  };

  const handleCreatePlaylist = async (name: string) => {
      if (!trackToAddId) return;
      const id = crypto.randomUUID();
      const newPlaylist: Playlist = {
          id,
          name,
          trackIds: [trackToAddId],
          createdAt: Date.now(),
          updatedAt: Date.now()
      };
      await dbService.savePlaylist(newPlaylist);

      // Update local state
      setPlaylists(prev => ({ ...prev, [id]: newPlaylist }));
      setIsPlaylistModalOpen(false);
      setTrackToAddId(null);
  };

  // Reset selected artist when tab changes
  React.useEffect(() => {
      if (libraryTab !== 'Artists') setSelectedArtist(null);
  }, [libraryTab]);

  return (
    <>
        <motion.div
        key="library-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col h-full px-4 md:px-8 max-w-5xl mx-auto w-full"
        >
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8 pt-4">
            <h1 className="text-display-small font-bold text-on-surface">Library</h1>
            <button
                onClick={() => setLibraryTab('Settings')}
                aria-label="Settings"
                className={`p-2 rounded-full transition-colors ${libraryTab === 'Settings' ? 'bg-primary text-on-primary' : 'hover:bg-surface-variant text-on-surface'}`}
            >
                <Settings className="w-6 h-6" />
            </button>
        </div>

        {/* Tabs / Pills */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar mb-8 pb-2">
            {(['Songs', 'Albums', 'Artists', 'Playlists'] as LibraryTab[]).map((tab) => (
            <button
                key={tab}
                onClick={() => setLibraryTab(tab)}
                className={`px-6 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                libraryTab === tab
                    ? 'bg-primary-container text-primary shadow-sm'
                    : 'bg-surface-variant text-on-surface/70 hover:bg-surface-variant-dim'
                }`}
            >
                {tab}
            </button>
            ))}
        </div>

        {/* Action Row (Only for Songs) */}
        {libraryTab === 'Songs' && (
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => {
                        if (filteredTracks[0]) {
                            const trackIds = filteredTracks.map(t => t.id);
                            const randomId = trackIds[Math.floor(Math.random() * trackIds.length)];
                            playTrack(randomId, { customQueue: trackIds });
                        }
                    }}
                    className="flex-1 h-12 rounded-full bg-primary text-primary-on-container hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-medium shadow-sm"
                >
                    <Shuffle className="w-5 h-5" />
                    <span>Shuffle All</span>
                </button>

                <div className="relative group">
                    <button className="h-12 w-12 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:bg-surface-variant-dim transition-colors">
                        <ListFilter className="w-5 h-5" />
                    </button>
                    <div className="absolute right-0 top-14 w-40 bg-surface-container-high rounded-xl shadow-xl overflow-hidden hidden group-hover:block z-20">
                         <div className="p-2 flex flex-col gap-1">
                             {[
                                 { label: 'Recently Added', val: 'added' },
                                 { label: 'Title', val: 'title' },
                                 { label: 'Artist', val: 'artist' }
                             ].map((opt) => (
                                 <button
                                    key={opt.val}
                                    onClick={() => setSortOption(opt.val as any)}
                                    className={`text-left px-3 py-2 rounded-lg text-sm ${sortOption === opt.val ? 'bg-primary/20 text-primary' : 'text-on-surface hover:bg-white/5'}`}
                                 >
                                     {opt.label}
                                 </button>
                             ))}
                         </div>
                    </div>
                </div>
            </div>
        )}

        {/* CONTENT AREA */}
        <div className="flex flex-col flex-1 min-h-0 w-full">
            {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={`skel-${i}`} />)
            ) : (
            <AnimatePresence mode="popLayout">
                {libraryTab === 'Songs' && (
                <div className="flex flex-col gap-1 w-full">
                    {[...filteredTracks]
                        .sort((a, b) => {
                            if (sortOption === 'title') return a.title.localeCompare(b.title);
                            if (sortOption === 'artist') return a.artist.localeCompare(b.artist);
                            return b.addedAt - a.addedAt;
                        })
                        .map((track, i) => (
                        <TrackRow
                            key={track.id}
                            track={track}
                            index={i}
                            onPlay={(id) => playTrack(id, { customQueue: filteredTracks.map(t => t.id) })}
                            isPlaying={playerState.isPlaying}
                            isCurrentTrack={playerState.currentTrackId === track.id}
                            onDelete={handleDelete}
                            onAddToPlaylist={handleAddToPlaylistClick}
                        />
                    ))}
                </div>
                )}

                {libraryTab === 'Artists' && (
                    selectedArtist ? (
                        <motion.div
                            key="artist-songs"
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -20, opacity: 0 }}
                            className="flex flex-col gap-2"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <button
                                    onClick={() => setSelectedArtist(null)}
                                    className="p-2 rounded-full hover:bg-surface-variant transition-colors"
                                >
                                    <ChevronLeft className="w-6 h-6 text-on-surface" />
                                </button>
                                <h2 className="text-xl font-bold text-on-surface">{selectedArtist}</h2>
                            </div>

                            {filteredTracks
                                .filter(t => t.artist === selectedArtist)
                                .map((track, i) => (
                                    <TrackRow
                                        key={track.id}
                                        track={track}
                                        index={i}
                                        onPlay={(id) => playTrack(id, {
                                            customQueue: filteredTracks.filter(t => t.artist === selectedArtist).map(t => t.id)
                                        })}
                                        isPlaying={playerState.isPlaying}
                                        isCurrentTrack={playerState.currentTrackId === track.id}
                                        onDelete={handleDelete}
                                        onAddToPlaylist={handleAddToPlaylistClick}
                                    />
                                ))
                            }
                        </motion.div>
                    ) : (
                        <div className="flex flex-col gap-2">
                             {artistsList.map((artist) => (
                                 <ArtistRow
                                     key={artist.name}
                                     artist={artist.name}
                                     trackCount={artist.count}
                                     coverArt={artist.cover}
                                     onClick={() => setSelectedArtist(artist.name)}
                                 />
                             ))}
                        </div>
                    )
                )}

                {libraryTab === 'Playlists' && (
                <Playlists
                    playlists={playlists}
                    tracks={tracksMap}
                    playTrack={playTrack}
                    refreshLibrary={() => {
                        refreshLibrary();
                        // Trigger local reload
                        const load = async () => {
                            const pl = await dbService.getAllPlaylists();
                            setPlaylists(pl.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}));
                        };
                        load();
                    }}
                />
                )}

                {libraryTab === 'Settings' && (
                    <SettingsTab playerState={playerState} setPlayerState={setPlayerState} />
                )}

                {!isLoading && filteredTracks.length === 0 && libraryTab === 'Songs' && (
                <div className="flex flex-col items-center justify-center py-20 opacity-60">
                    <Music className="w-16 h-16 mb-4 text-surface-variant stroke-[1.5]" />
                    <p className="text-lg text-on-surface/60">No tracks found</p>
                </div>
                )}
            </AnimatePresence>
            )}
        </div>
        </motion.div>

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
