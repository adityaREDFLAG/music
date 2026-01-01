import React, { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, Shuffle, ListFilter, Settings, Trash2, PlusCircle, Loader2, MoreVertical } from 'lucide-react';
import { Track, PlayerState, Playlist } from '../types';
import { dbService } from '../db';
import Playlists from './Playlists';
import AddToPlaylistModal from './AddToPlaylistModal';

type LibraryTab = 'Songs' | 'Albums' | 'Artists' | 'Playlists';

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
            <button className="p-2 rounded-full hover:bg-surface-variant transition-colors">
            <Settings className="w-6 h-6 text-on-surface" />
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
