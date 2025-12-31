import React from 'react';
import { motion } from 'framer-motion';
import { Music, PlusCircle, Trash2, Loader2, MoreVertical } from 'lucide-react';
import { Track, LibraryState, PlayerState } from '../types';
import { dbService } from '../db';

type LibraryTab = 'Songs' | 'Albums' | 'Artists' | 'Playlists';

interface LibraryProps {
  activeTab: string;
  libraryTab: LibraryTab;
  setLibraryTab: (tab: LibraryTab) => void;
  filteredTracks: Track[];
  playerState: PlayerState;
  playTrack: (id: string) => void;
  refreshLibrary: () => void;
}

const Library: React.FC<LibraryProps> = ({ activeTab, libraryTab, setLibraryTab, filteredTracks, playerState, playTrack, refreshLibrary }) => {
  if (activeTab !== 'library') return null;

  return (
    <motion.div key="library" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6 pt-2">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2 pb-4">
        {(['Songs', 'Albums', 'Artists', 'Playlists'] as LibraryTab[]).map(t => (
          <button
            key={t}
            onClick={() => setLibraryTab(t)}
            className={`px-5 py-2.5 rounded-lg text-label-large border transition-all whitespace-nowrap ${
              libraryTab === t
                ? 'bg-secondary-container text-secondary-on-container border-transparent'
                : 'bg-transparent text-surface-on-variant border-outline/30 hover:bg-surface-container-high'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {libraryTab === 'Songs' && (
        <div className="flex flex-col gap-1">
          {filteredTracks.map((t, i) => {
            const isPlaying = playerState.currentTrackId === t.id;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.01 }}
                whileTap={{ backgroundColor: 'var(--m3-surface-container-highest)' }}
                onClick={() => playTrack(t.id)}
                className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors ${isPlaying ? 'bg-secondary-container' : 'hover:bg-surface-container-high'}`}
              >
                <div className="w-12 h-12 rounded-lg bg-surface-variant overflow-hidden flex items-center justify-center relative flex-shrink-0">
                  {t.coverArt ? (
                    <img src={t.coverArt} className="w-full h-full object-cover" />
                  ) : (
                     <Music className={`w-6 h-6 ${isPlaying ? 'text-primary' : 'text-surface-on-variant opacity-50'}`} />
                  )}
                  {isPlaying && playerState.isPlaying && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h4 className={`text-body-large truncate ${isPlaying ? 'text-secondary-on-container font-medium' : 'text-surface-on'}`}>{t.title}</h4>
                  <p className={`text-body-medium truncate ${isPlaying ? 'text-secondary-on-container/70' : 'text-surface-on-variant'}`}>{t.artist}</p>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); dbService.deleteTrack(t.id); refreshLibrary(); }}
                  className="p-3 text-surface-on-variant/50 hover:text-error hover:bg-error-container hover:bg-opacity-20 rounded-full transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {libraryTab === 'Playlists' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div onClick={() => alert("Playlist creation logic in development")} className="aspect-square rounded-2xl border border-dashed border-outline/40 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-container-high transition-all text-primary">
            <PlusCircle className="w-10 h-10" strokeWidth={1.5} />
            <span className="text-label-large font-medium">New Playlist</span>
          </div>
          <div className="aspect-square rounded-2xl bg-tertiary-container p-4 text-tertiary-on-container flex flex-col justify-end shadow-elevation-2 relative overflow-hidden group cursor-pointer transition-all hover:scale-[1.02]">
             <Music className="absolute -top-4 -right-4 w-24 h-24 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
             <h3 className="text-title-large font-medium leading-tight">My Vibe</h3>
             <p className="text-body-medium opacity-70">{filteredTracks.length} tracks</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Library;
