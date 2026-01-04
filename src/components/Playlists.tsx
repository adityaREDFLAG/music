import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Play, Trash2, Plus, Shuffle, Music, X, ChevronLeft, GripVertical, Edit2, Save, Search, Clock } from 'lucide-react';
import { Playlist, Track } from '../types';
import { dbService } from '../db';

interface PlaylistsProps {
  playlists: Record<string, Playlist>;
  tracks: Record<string, Track>;
  playTrack: (trackId: string, options?: { customQueue?: string[] }) => void;
  refreshLibrary: () => void;
}

// --- Helper: Format Time ---
const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

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
      <p className="text-sm text-on-surface/60 truncate">
        {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'track' : 'tracks'}
        {playlist.description ? ` • ${playlist.description}` : ''}
      </p>
    </div>
  </motion.div>
);

// --- Sub-Component: Playlist Track Item (Reorderable) ---
const PlaylistTrackItem = ({
  item,
  track,
  index,
  onRemove,
  onPlay
}: {
  item: { key: string, trackId: string };
  track: Track;
  index: number;
  onRemove: () => void;
  onPlay: () => void;
}) => {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      id={item.key} // Unique key for reorder
      dragListener={false}
      dragControls={controls}
      className="group flex items-center gap-4 p-2 md:p-3 hover:bg-surface-variant/40 rounded-xl transition-colors select-none"
    >
      {/* Drag Handle */}
      <div
        onPointerDown={(e) => controls.start(e)}
        className="text-on-surface/20 hover:text-on-surface cursor-grab active:cursor-grabbing p-1 touch-none"
      >
        <GripVertical size={16} />
      </div>

      <span className="text-on-surface/40 w-6 text-center font-mono text-sm hidden md:block">{index + 1}</span>

      <div className="h-10 w-10 md:h-12 md:w-12 rounded-lg bg-surface-variant-dim overflow-hidden flex-shrink-0 relative group/cover">
        {track.coverArt ? (
            <img src={track.coverArt} className="w-full h-full object-cover" alt="" />
        ) : (
            <div className="w-full h-full flex items-center justify-center"><Music size={16} className="text-on-surface/20"/></div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer"
              onClick={(e) => { e.stopPropagation(); onPlay(); }}>
            <Play fill="white" className="text-white" size={16} />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-on-surface font-medium truncate">{track.title}</h4>
        <div className="flex items-center gap-2 text-on-surface/60 text-sm truncate">
            <span>{track.artist}</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">{track.album}</span>
        </div>
      </div>

      <div className="text-on-surface/40 text-sm font-mono mr-2 hidden sm:block">
        {formatTime(track.duration)}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="p-2 text-on-surface/30 hover:text-error hover:bg-error/10 rounded-full opacity-0 group-hover:opacity-100 transition-all"
        title="Remove from playlist"
      >
        <Trash2 size={18} />
      </button>
    </Reorder.Item>
  );
};


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
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const [editDesc, setEditDesc] = useState(playlist.description || '');
  
  // Local state for reordering (wrapped in unique objects to handle duplicates)
  const [items, setItems] = useState<{key: string, trackId: string}[]>([]);

  // Sync with playlist prop changes (e.g. if updated externally)
  useEffect(() => {
    // Generate new keys only when the underlying ID list actually changes length or content
    // This is a simple approximation. For true stability we'd need a more complex diff.
    // But for this app, generating new keys on load/refresh is acceptable.
    setItems(playlist.trackIds.map((id) => ({ key: `${id}-${crypto.randomUUID()}`, trackId: id })));
    setEditName(playlist.name);
    setEditDesc(playlist.description || '');
  }, [playlist]);

  const handleSaveDetails = async () => {
    const updated = { ...playlist, name: editName, description: editDesc, updatedAt: Date.now() };
    await dbService.savePlaylist(updated);
    setIsEditing(false);
    refreshLibrary();
  };

  const handleReorder = async (newItems: {key: string, trackId: string}[]) => {
    setItems(newItems);
    const newTrackIds = newItems.map(i => i.trackId);

    // Save to DB
    const updated = { ...playlist, trackIds: newTrackIds, updatedAt: Date.now() };
    await dbService.savePlaylist(updated);
    refreshLibrary();
  };

  const handleRemoveTrack = async (indexToRemove: number) => {
    const newItems = [...items];
    newItems.splice(indexToRemove, 1);

    // Optimistic update
    setItems(newItems);

    const newTrackIds = newItems.map(i => i.trackId);
    const updated = { ...playlist, trackIds: newTrackIds, updatedAt: Date.now() };
    await dbService.savePlaylist(updated);
    refreshLibrary();
  };

  const handlePlay = (shuffle = false) => {
    if (items.length === 0) return;
    let queue = items.map(i => i.trackId);
    if (shuffle) {
      queue = queue.sort(() => Math.random() - 0.5);
    }
    playTrack(queue[0], { customQueue: queue });
  };

  const totalDuration = items.reduce((acc, item) => acc + (tracks[item.trackId]?.duration || 0), 0);
  const formattedDuration = useMemo(() => {
     const hrs = Math.floor(totalDuration / 3600);
     const mins = Math.floor((totalDuration % 3600) / 60);
     if (hrs > 0) return `${hrs}h ${mins}m`;
     return `${mins}m`;
  }, [totalDuration]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-surface rounded-3xl min-h-[50vh] pb-20"
    >
      {/* Header Section */}
      <div className="flex flex-col md:flex-row gap-8 mb-8 p-1">
        {/* Big Cover Art */}
        <div className="w-48 h-48 md:w-64 md:h-64 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl mx-auto md:mx-0 bg-surface-variant">
          <PlaylistCover playlist={playlist} tracks={tracks} />
        </div>

        {/* Info & Actions */}
        <div className="flex flex-col justify-end items-center md:items-start flex-1 gap-4 min-w-0 w-full">
          <div className="w-full text-center md:text-left">
            <button onClick={onBack} className="text-on-surface/60 hover:text-on-surface flex items-center justify-center md:justify-start gap-2 mb-4 transition-colors">
              <ChevronLeft size={20} /> Back to Playlists
            </button>

            {isEditing ? (
                <div className="space-y-3 w-full max-w-lg">
                    <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full bg-surface-variant text-2xl md:text-4xl font-black text-on-surface p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Playlist Name"
                    />
                    <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        className="w-full bg-surface-variant text-on-surface/80 p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Description (optional)"
                    />
                    <div className="flex gap-2 justify-center md:justify-start pt-2">
                        <button onClick={handleSaveDetails} className="bg-primary text-primary-on-container px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                            <Save size={18} /> Save
                        </button>
                        <button onClick={() => { setIsEditing(false); setEditName(playlist.name); setEditDesc(playlist.description || ''); }} className="bg-surface-variant text-on-surface px-4 py-2 rounded-lg font-medium">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="group relative inline-block">
                        <h1 className="text-4xl md:text-5xl font-black text-on-surface mb-2 break-words">{playlist.name}</h1>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="absolute -right-8 top-2 text-on-surface/20 hover:text-primary opacity-0 group-hover:opacity-100 transition-all p-1"
                        >
                            <Edit2 size={20} />
                        </button>
                    </div>
                    {playlist.description && (
                        <p className="text-lg text-on-surface/70 mb-2 max-w-2xl">{playlist.description}</p>
                    )}
                    <p className="text-on-surface/50 font-medium flex items-center justify-center md:justify-start gap-2 text-sm md:text-base mt-2">
                      <span>{items.length} tracks</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock size={14}/> {formattedDuration}</span>
                      <span>•</span>
                      <span>Updated {new Date(playlist.updatedAt).toLocaleDateString()}</span>
                    </p>
                </>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button 
                onClick={() => handlePlay(false)}
                disabled={items.length === 0}
                className="bg-primary text-primary-on-container px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              <Play fill="currentColor" size={20} /> Play
            </button>
            <button 
                onClick={() => handlePlay(true)}
                disabled={items.length === 0}
                className="bg-surface-variant text-on-surface px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:bg-surface-variant-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Shuffle size={20} /> Shuffle
            </button>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-1">
        {items.length === 0 ? (
            <div className="text-center py-20 text-on-surface/40 bg-surface-variant/20 rounded-3xl border border-dashed border-on-surface/10">
                <Music size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">This playlist is empty.</p>
                <p className="text-sm">Add songs from your library to get started.</p>
            </div>
        ) : (
            <Reorder.Group axis="y" values={items} onReorder={handleReorder}>
                {items.map((item, index) => {
                    const track = tracks[item.trackId];
                    if (!track) return null;

                    return (
                        <PlaylistTrackItem
                            key={item.key}
                            item={item}
                            track={track}
                            index={index}
                            onRemove={() => handleRemoveTrack(index)}
                            onPlay={() => playTrack(item.trackId, { customQueue: items.map(i => i.trackId) })}
                        />
                    );
                })}
            </Reorder.Group>
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredPlaylists = useMemo(() => {
    return Object.values(playlists)
        .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [playlists, searchQuery]);

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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                  <h2 className="text-4xl font-bold text-on-surface">Your Playlists</h2>
                  <p className="text-on-surface/60 mt-1">{Object.keys(playlists).length} collections</p>
              </div>

              <div className="flex gap-3 w-full md:w-auto">
                  <div className="flex-1 md:w-64 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface/40" size={18} />
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search playlists..."
                        className="w-full bg-surface-variant/50 text-on-surface pl-10 pr-4 py-2.5 rounded-full border border-transparent focus:bg-surface-variant focus:border-primary/50 outline-none transition-all"
                      />
                  </div>
                  <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center gap-2 bg-primary text-primary-on-container px-5 py-2.5 rounded-full hover:brightness-110 transition-all font-bold shadow-lg shadow-primary/20 shrink-0"
                  >
                    <Plus size={20} />
                    <span className="hidden sm:inline">New Playlist</span>
                  </button>
              </div>
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
                  <div className="bg-surface-variant/30 border border-surface-variant-dim rounded-2xl p-4 flex gap-3 items-center mb-6">
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
              {filteredPlaylists.map(playlist => (
                  <PlaylistCard 
                    key={playlist.id} 
                    playlist={playlist} 
                    tracks={tracks}
                    onClick={() => setSelectedPlaylistId(playlist.id)}
                    onDelete={(e) => handleDeletePlaylist(playlist.id, e)}
                  />
              ))}
              
              {/* Empty State Helper */}
              {filteredPlaylists.length === 0 && !isCreating && (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center text-on-surface/40">
                      <Music size={64} strokeWidth={1} className="mb-4"/>
                      <p className="text-lg">No playlists found.</p>
                      {searchQuery ? (
                          <button onClick={() => setSearchQuery('')} className="text-primary mt-2 hover:underline">Clear search</button>
                      ) : (
                          <button onClick={() => setIsCreating(true)} className="text-primary mt-2 hover:underline">Create one now</button>
                      )}
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
