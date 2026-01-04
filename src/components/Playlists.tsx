import React, { useState, useMemo } from 'react'; // for swadeep daddy
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trash2, Plus, Shuffle, Music, X, ChevronLeft } from 'lucide-react';
import { Playlist, Track } from '../types';
import { dbService } from '../db';

interface PlaylistsProps {
  playlists: Record<string, Playlist>;
  tracks: Record<string, Track>;
  playTrack: (trackId: string, options?: { customQueue?: string[] }) => void;
  refreshLibrary: () => void;
}

// --- Helper Component: Dynamic Playlist Cover Art ---
const PlaylistCover = ({ playlist, tracks }: { playlist: Playlist; tracks: Record<string, Track> }) => {
  // Get first 4 valid cover arts
  const covers = useMemo(() => {
    return playlist.trackIds
      .map(id => tracks[id]?.coverArt)
      .filter(Boolean)
      .slice(0, 4);
  }, [playlist.trackIds, tracks]);

  if (covers.length === 0) {
    return (
      <div className="w-full h-full bg-surface-variant-dim flex items-center justify-center text-on-surface/20">
        <Music size={48} />
      </div>
    );
  }

  // 4-grid collage
  if (covers.length >= 4) {
    return (
      <div className="w-full h-full grid grid-cols-2 grid-rows-2">
        {covers.map((src, i) => (
          <img key={i} src={src} className="w-full h-full object-cover" alt="" />
        ))}
      </div>
    );
  }

  // Single full cover
  return <img src={covers[0]} className="w-full h-full object-cover" alt="Playlist cover" />;
};

// --- Sub-Component: Playlist Card ---
const PlaylistCard = ({ 
  playlist, 
  tracks, 
  onClick, 
  onDelete 
}: { 
  playlist: Playlist; 
  tracks: Record<string, Track>; 
  onClick: () => void; 
  onDelete: (e: React.MouseEvent) => void; 
}) => (
  <motion.div
    whileHover={{ y: -4 }}
    onClick={onClick}
    className="group relative cursor-pointer"
  >
    {/* Card Image */}
    <div className="aspect-square w-full rounded-2xl overflow-hidden bg-surface-variant mb-3 shadow-sm group-hover:shadow-md transition-all relative">
      <PlaylistCover playlist={playlist} tracks={tracks} />
      
      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            className="group-hover:opacity-100 transition-all bg-primary text-primary-on-container p-3 rounded-full shadow-lg"
        >
           <Play fill="currentColor" size={20} />
        </motion.div>
      </div>

      {/* Delete Button (Top Right) */}
      <button
        onClick={onDelete}
        className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-error hover:text-white transition-all transform scale-90 hover:scale-100"
        title="Delete Playlist"
      >
        <Trash2 size={16} />
      </button>
    </div>

    {/* Metadata */}
    <div>
      <h3 className="font-bold text-on-surface truncate">{playlist.name}</h3>
      <p className="text-sm text-on-surface/60">
        {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'track' : 'tracks'}
      </p>
    </div>
  </motion.div>
);

// --- Sub-Component: Detailed Playlist View ---
const PlaylistDetail = ({ 
  playlist, 
  tracks, 
  playTrack, 
  onBack, 
  refreshLibrary 
}: { 
  playlist: Playlist; 
  tracks: Record<string, Track>; 
  playTrack: (id: string, opts?: any) => void; 
  onBack: () => void;
  refreshLibrary: () => void;
}) => {
  
  const handleRemoveTrack = async (trackIdToRemove: string) => {
    const updatedIds = playlist.trackIds.filter(id => id !== trackIdToRemove);
    const updatedPlaylist = { ...playlist, trackIds: updatedIds, updatedAt: Date.now() };
    await dbService.savePlaylist(updatedPlaylist);
    refreshLibrary();
  };

  const handlePlay = (shuffle = false) => {
    if (playlist.trackIds.length === 0) return;
    let queue = [...playlist.trackIds];
    if (shuffle) {
      queue = queue.sort(() => Math.random() - 0.5);
    }
    playTrack(queue[0], { customQueue: queue });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-surface rounded-3xl min-h-[50vh]"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row gap-8 mb-8">
        {/* Big Cover Art */}
        <div className="w-48 h-48 md:w-64 md:h-64 flex-shrink-0 rounded-2xl overflow-hidden shadow-xl mx-auto md:mx-0">
          <PlaylistCover playlist={playlist} tracks={tracks} />
        </div>

        {/* Info & Actions */}
        <div className="flex flex-col justify-end items-center md:items-start flex-1 gap-4">
          <div className="w-full">
            <button onClick={onBack} className="text-on-surface/60 hover:text-on-surface flex items-center gap-2 mb-2 transition-colors">
              <ChevronLeft size={20} /> Back to Playlists
            </button>
            <h1 className="text-4xl md:text-5xl font-black text-on-surface mb-2">{playlist.name}</h1>
            <p className="text-on-surface/60 font-medium">
              {playlist.trackIds.length} tracks • Created {new Date(playlist.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex gap-3 mt-2">
            <button 
                onClick={() => handlePlay(false)}
                disabled={playlist.trackIds.length === 0}
                className="bg-primary text-primary-on-container px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play fill="currentColor" size={20} /> Play
            </button>
            <button 
                onClick={() => handlePlay(true)}
                disabled={playlist.trackIds.length === 0}
                className="bg-surface-variant text-on-surface px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-surface-variant-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shuffle size={20} /> Shuffle
            </button>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-1">
        {playlist.trackIds.length === 0 ? (
            <div className="text-center py-12 text-on-surface/40 bg-surface-variant/20 rounded-2xl border border-dashed border-on-surface/10">
                <Music size={48} className="mx-auto mb-3 opacity-50" />
                <p>This playlist is empty.</p>
                <p className="text-sm">Add songs from your library.</p>
            </div>
        ) : (
            playlist.trackIds.map((trackId, index) => {
            const track = tracks[trackId];
            if (!track) return null; // Handle deleted tracks gracefully

            return (
                <div key={`${trackId}-${index}`} className="group flex items-center gap-4 p-3 hover:bg-surface-variant/40 rounded-xl transition-colors">
                    <span className="text-on-surface/40 w-6 text-center font-mono text-sm">{index + 1}</span>
                    
                    <div className="h-12 w-12 rounded-lg bg-surface-variant-dim overflow-hidden flex-shrink-0 relative">
                        {track.coverArt ? (
                            <img src={track.coverArt} className="w-full h-full object-cover" alt="" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><Music size={16} className="text-on-surface/20"/></div>
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                             onClick={() => playTrack(trackId, { customQueue: playlist.trackIds })}>
                            <Play fill="white" className="text-white" size={16} />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h4 className="text-on-surface font-medium truncate">{track.title}</h4>
                        <p className="text-on-surface/60 text-sm truncate">{track.artist}</p>
                    </div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); handleRemoveTrack(trackId); }}
                        className="p-2 text-on-surface/30 hover:text-error hover:bg-error/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        title="Remove from playlist"
                    >
                        <X size={18} />
                    </button>
                </div>
            );
            })
        )}
      </div>
    </motion.div>
  );
};


// --- Main Component ---
const Playlists: React.FC<PlaylistsProps> = ({ playlists, tracks, playTrack, refreshLibrary }) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const id = crypto.randomUUID();
    const newPlaylist: Playlist = {
      id,
      name: newPlaylistName,
      trackIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await dbService.savePlaylist(newPlaylist);
    setNewPlaylistName('');
    setIsCreating(false);
    refreshLibrary();
  };

  const handleDeletePlaylist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this playlist? This cannot be undone.')) {
        await dbService.deletePlaylist(id);
        if (selectedPlaylistId === id) setSelectedPlaylistId(null);
        refreshLibrary();
    }
  };

  const selectedPlaylist = selectedPlaylistId ? playlists[selectedPlaylistId] : null;

  return (
    <div className="w-full pb-32 px-4 md:px-8 max-w-7xl mx-auto">
      <AnimatePresence mode="wait">
        
        {/* VIEW: Playlist List */}
        {!selectedPlaylist ? (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="flex justify-between items-end">
              <div>
                  <h2 className="text-4xl font-bold text-on-surface">Your Playlists</h2>
                  <p className="text-on-surface/60 mt-1">{Object.keys(playlists).length} collections</p>
              </div>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-on-container px-4 py-2 rounded-full transition-all font-medium"
              >
                <Plus size={20} />
                <span>New Playlist</span>
              </button>
            </div>

            {/* Creation Input */}
            <AnimatePresence>
              {isCreating && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-surface-variant/30 border border-surface-variant-dim rounded-2xl p-4 flex gap-3 items-center">
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      placeholder="Give your playlist a name..."
                      className="flex-1 bg-surface-variant text-on-surface px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none placeholder:text-on-surface/30"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                    />
                    <button onClick={handleCreatePlaylist} className="bg-primary text-primary-on-container px-6 py-3 rounded-xl font-bold hover:brightness-110">Create</button>
                    <button onClick={() => setIsCreating(false)} className="px-4 py-3 text-on-surface/60 hover:text-on-surface">Cancel</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {Object.values(playlists)
                .sort((a, b) => b.updatedAt - a.updatedAt) // Sort by recently updated
                .map(playlist => (
                  <PlaylistCard 
                    key={playlist.id} 
                    playlist={playlist} 
                    tracks={tracks}
                    onClick={() => setSelectedPlaylistId(playlist.id)}
                    onDelete={(e) => handleDeletePlaylist(playlist.id, e)}
                  />
              ))}
              
              {/* Empty State Helper */}
              {Object.keys(playlists).length === 0 && !isCreating && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-on-surface/40">
                      <Music size={64} strokeWidth={1} className="mb-4"/>
                      <p className="text-lg">No playlists yet.</p>
                      <button onClick={() => setIsCreating(true)} className="text-primary mt-2 hover:underline">Create one now</button>
                  </div>
              )}
            </div>
          </motion.div>
        ) : (
          /* VIEW: Playlist Details */
          <PlaylistDetail 
            key="detail"
            playlist={selectedPlaylist}
            tracks={tracks}
            playTrack={playTrack}
            refreshLibrary={refreshLibrary}
            onBack={() => setSelectedPlaylistId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Playlists;
