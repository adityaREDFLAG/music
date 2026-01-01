import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Playlist } from '../types';
import { Plus, X } from 'lucide-react';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlists: Playlist[];
  onSelectPlaylist: (playlistId: string) => void;
  onCreatePlaylist: (name: string) => void;
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlists,
  onSelectPlaylist,
  onCreatePlaylist
}) => {
  const [newPlaylistName, setNewPlaylistName] = React.useState('');
  const [isCreating, setIsCreating] = React.useState(false);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-sm bg-surface-container-high rounded-3xl p-6 shadow-2xl overflow-hidden z-10"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-title-large font-bold text-on-surface">Add to Playlist</h3>
            <button onClick={onClose} className="p-2 hover:bg-surface-variant rounded-full text-on-surface">
              <X size={24} />
            </button>
          </div>

          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
            <button
                onClick={() => setIsCreating(!isCreating)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-primary/10 text-primary font-medium transition-colors"
            >
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Plus size={20} />
                </div>
                <span>New Playlist</span>
            </button>

            <AnimatePresence>
                {isCreating && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-2"
                    >
                        <div className="flex gap-2">
                            <input
                                autoFocus
                                value={newPlaylistName}
                                onChange={(e) => setNewPlaylistName(e.target.value)}
                                placeholder="Playlist Name"
                                className="flex-1 bg-surface-variant px-3 py-2 rounded-lg text-on-surface outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button
                                onClick={() => {
                                    if(newPlaylistName.trim()) {
                                        onCreatePlaylist(newPlaylistName);
                                        setNewPlaylistName('');
                                        setIsCreating(false);
                                    }
                                }}
                                className="bg-primary text-primary-on-container px-3 py-2 rounded-lg text-sm font-bold"
                            >
                                Create
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {playlists.length === 0 && !isCreating && (
                <p className="text-center text-on-surface/50 py-4 text-sm">No playlists found</p>
            )}

            {playlists.map(playlist => (
              <button
                key={playlist.id}
                onClick={() => onSelectPlaylist(playlist.id)}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-variant transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-variant-dim flex items-center justify-center text-on-surface-variant font-bold text-xs">
                    {playlist.trackIds.length}
                </div>
                <div className="text-left flex-1 min-w-0">
                    <p className="font-medium text-on-surface truncate group-hover:text-primary transition-colors">{playlist.name}</p>
                    <p className="text-xs text-on-surface/50">{playlist.trackIds.length} tracks</p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddToPlaylistModal;
