import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, Shuffle, ListFilter, Settings, Trash2, PlusCircle, Loader2, MoreVertical, X } from 'lucide-react';
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
  playTrack: (id: string) => void;
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
const SettingsTab = ({ playerState }: { playerState: PlayerState }) => {
    const [crossfade, setCrossfade] = React.useState(playerState.crossfadeEnabled || false);
    const [duration, setDuration] = React.useState(playerState.crossfadeDuration || 5);

    // Sync with global state logic (Usually this would be via a setPlayer method passed down or context)
    // But since we persist to DB and useAudioPlayer reads from DB/State, we need a way to update it.
    // The playerState prop is read-only from the parent.
    // We should probably update the DB directly and let the hook pick it up or require a setPlayerState callback.
    // Since App.tsx owns the state, we need to pass a setter or an update function.
    // For now, let's assume we update DB and force a reload or use a callback if available.
    // Ideally we pass `setPlayer` from `App` -> `Library` -> `SettingsTab`.

    // We will update DB. The hook in useAudioPlayer might not pick it up instantly unless we also update state.
    // Wait, useAudioPlayer has `setPlayer`. We need to pass that down.

    // For this implementation, I will just update the DB. The user might need to reload or change tracks for it to take effect if we don't update React state.
    // Actually, I'll modify LibraryProps to accept `setPlayer`.

    // BUT since I can't easily change App.tsx props without seeing it again (I did see it, but I want to minimize diffs),
    // I will use a custom event or just update DB.
    // Wait, `useAudioPlayer` does NOT listen to DB changes. It only writes.
    // So updating DB is not enough for live changes.

    // I will add `setPlayer` to LibraryProps in a later step if needed, or I'll just check if I can modify App.tsx easily.
    // Yes, I can. I will do that in the next step.
    // For now, I'll build the UI and make it functional with local state and DB,
    // and assume the parent will pass a setter.

    // Actually, let's use a callback prop `onUpdateSettings`.

    return (
        <div className="flex flex-col gap-6 p-4">
           <h2 className="text-xl font-bold text-on-surface">Playback</h2>

           <div className="bg-surface-variant/30 rounded-2xl p-4 flex flex-col gap-4">
               <div className="flex items-center justify-between">
                   <div className="flex flex-col">
                       <span className="text-lg font-medium text-on-surface">Crossfade</span>
                       <span className="text-sm text-on-surface/60">Overlap songs for a smooth transition</span>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={crossfade}
                            onChange={(e) => {
                                const val = e.target.checked;
                                setCrossfade(val);
                                // This needs to propagate up!
                                // We'll dispatch a custom event for now as a quick fix or rely on parent
                                window.dispatchEvent(new CustomEvent('update-player-settings', { detail: { crossfadeEnabled: val } }));
                            }}
                        />
                        <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-focus:ring-4 peer-focus:ring-primary/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
               </div>

               {crossfade && (
                   <div className="flex flex-col gap-2 pt-2">
                       <div className="flex justify-between text-sm text-on-surface/70">
                           <span>Duration</span>
                           <span>{duration}s</span>
                       </div>
                       <input
                            type="range"
                            min="1"
                            max="12"
                            step="1"
                            value={duration}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setDuration(val);
                                window.dispatchEvent(new CustomEvent('update-player-settings', { detail: { crossfadeDuration: val } }));
                            }}
                            className="w-full h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer accent-primary"
                       />
                   </div>
               )}
           </div>

           <h2 className="text-xl font-bold text-on-surface mt-4">About</h2>
           <div className="bg-surface-variant/30 rounded-2xl p-4">
               <p className="text-on-surface/80">Vibe Music v1.0</p>
               <p className="text-sm text-on-surface/60 mt-1">
                   A high-performance, glassmorphic music player built with React, Framer Motion, and Tailwind.
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
  playTrack, 
  refreshLibrary,
  isLoading = false
}) => {
  const [playlists, setPlaylists] = React.useState<Record<string, Playlist>>({});
  const [tracksMap, setTracksMap] = React.useState<Record<string, Track>>({});

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

  if (activeTab !== 'library') return null;

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
                onClick={() => filteredTracks[0] && playTrack(filteredTracks[0].id)}
                className="flex-1 h-12 rounded-full bg-primary text-primary-on-container hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-medium shadow-sm"
            >
                <Shuffle className="w-5 h-5" />
                <span>Shuffle All</span>
            </button>

            <button className="h-12 w-12 rounded-full bg-surface-variant text-on-surface flex items-center justify-center hover:bg-surface-variant-dim transition-colors">
                <ListFilter className="w-5 h-5" />
            </button>
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
                    {filteredTracks.map((track, i) => (
                    <TrackRow
                        key={track.id}
                        track={track}
                        index={i}
                        onPlay={playTrack}
                        isPlaying={playerState.isPlaying}
                        isCurrentTrack={playerState.currentTrackId === track.id}
                        onDelete={handleDelete}
                        onAddToPlaylist={handleAddToPlaylistClick}
                    />
                    ))}
                </div>
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
                    <SettingsTab playerState={playerState} />
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
