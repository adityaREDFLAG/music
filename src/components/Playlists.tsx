import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Play, Trash2, Plus } from 'lucide-react';
import { Playlist, Track } from '../types';
import { dbService } from '../db';

interface PlaylistsProps {
  playlists: Record<string, Playlist>;
  tracks: Record<string, Track>;
  playTrack: (trackId: string, customQueue?: string[]) => void;
  refreshLibrary: () => void;
}

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
    if (confirm('Are you sure you want to delete this playlist?')) {
        await dbService.deletePlaylist(id);
        if (selectedPlaylistId === id) setSelectedPlaylistId(null);
        refreshLibrary();
    }
  };

  const selectedPlaylist = selectedPlaylistId ? playlists[selectedPlaylistId] : null;

  return (
    <div className="w-full pb-20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-headline-medium text-on-surface">Your Playlists</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="p-2 bg-primary-container text-primary rounded-full hover:bg-primary/20 transition-colors"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Create Playlist Input */}
      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist Name"
                className="flex-1 bg-surface-variant text-on-surface px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-primary outline-none"
                autoFocus
              />
              <button
                onClick={handleCreatePlaylist}
                className="bg-primary text-primary-on-container px-6 py-3 rounded-xl font-medium"
              >
                Create
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="bg-surface-variant text-on-surface px-4 py-3 rounded-xl"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Playlist List (Horizontal or Grid?) Vertical list for now */}
      {!selectedPlaylist && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.values(playlists).map(playlist => (
            <motion.div
              key={playlist.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPlaylistId(playlist.id)}
              className="aspect-square bg-surface-variant rounded-2xl p-4 flex flex-col justify-between relative group cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="z-10 flex justify-end">
                <button
                    onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                    className="p-2 text-on-surface/50 hover:text-error hover:bg-surface/50 rounded-full transition-colors"
                >
                    <Trash2 size={18} />
                </button>
              </div>

              <div className="z-10">
                <h3 className="text-title-large font-bold text-on-surface break-words">{playlist.name}</h3>
                <p className="text-body-medium text-on-surface/60">{playlist.trackIds.length} tracks</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Selected Playlist View */}
      {selectedPlaylist && (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-surface rounded-3xl"
        >
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => setSelectedPlaylistId(null)}
                    className="text-primary hover:underline"
                >
                    &larr; Back
                </button>
                <h2 className="text-3xl font-bold text-on-surface">{selectedPlaylist.name}</h2>
                <button
                    onClick={() => {
                         if (selectedPlaylist.trackIds.length > 0) {
                             playTrack(selectedPlaylist.trackIds[0], { customQueue: selectedPlaylist.trackIds });
                         }
                    }}
                    className="ml-auto bg-primary text-primary-on-container p-3 rounded-full hover:scale-105 transition-transform"
                >
                    <Play fill="currentColor" />
                </button>
            </div>

            <div className="space-y-2">
                {selectedPlaylist.trackIds.length === 0 ? (
                    <p className="text-on-surface/50 italic">No tracks yet.</p>
                ) : (
                    selectedPlaylist.trackIds.map((trackId, index) => {
                        const track = tracks[trackId];
                        if (!track) return null;
                        return (
                            <div key={`${trackId}-${index}`} className="flex items-center gap-4 p-3 hover:bg-surface-variant/50 rounded-xl transition-colors group">
                                <span className="text-on-surface/40 w-6 text-center">{index + 1}</span>
                                <div className="h-10 w-10 rounded-lg bg-surface-variant-dim overflow-hidden">
                                    {track.coverArt && <img src={track.coverArt} className="w-full h-full object-cover" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-on-surface font-medium truncate">{track.title}</h4>
                                    <p className="text-on-surface/60 text-sm truncate">{track.artist}</p>
                                </div>
                                <button
                                    onClick={() => playTrack(trackId, { customQueue: selectedPlaylist.trackIds })}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-primary bg-primary/10 rounded-full"
                                >
                                    <Play size={16} fill="currentColor" />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </motion.div>
      )}
    </div>
  );
};

export default Playlists;
