import React from 'react';
import { motion } from 'framer-motion';
import { Music, PlusCircle, Trash2, Shuffle, Filter, Loader2 } from 'lucide-react';
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
    <motion.div key="library" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4 pt-2">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
        {(['Songs', 'Albums', 'Artists', 'Playlists'] as LibraryTab[]).map(t => (
          <button
            key={t}
            onClick={() => setLibraryTab(t)}
            className={`px-6 py-2 rounded-full text-label-large transition-all whitespace-nowrap uppercase tracking-wide ${
              libraryTab === t
                ? 'bg-primary text-primary-on font-bold'
                : 'bg-transparent text-surface-on-variant hover:bg-surface-container-high font-medium'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Action Row */}
      {libraryTab === 'Songs' && (
        <div className="flex items-center gap-2 pb-2">
          <button className="flex items-center gap-2 px-5 py-3 rounded-full bg-secondary-container text-secondary-on-container text-label-large font-medium hover:brightness-110 transition-all flex-1 justify-center">
             <Shuffle className="w-5 h-5" />
             <span>Shuffle</span>
          </button>
          <button className="w-12 h-12 rounded-full bg-surface-container-high text-surface-on-variant flex items-center justify-center hover:bg-surface-container-highest transition-all">
             <Filter className="w-5 h-5" />
          </button>
        </div>
      )}

      {libraryTab === 'Songs' && (
        <div className="flex flex-col gap-0">
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
                className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-colors group ${isPlaying ? 'bg-surface-container-high' : 'hover:bg-surface-container/50'}`}
              >
                <div className="w-14 h-14 rounded-xl bg-surface-variant overflow-hidden flex items-center justify-center relative flex-shrink-0 shadow-sm">
                  {t.coverArt ? (
                    <img src={t.coverArt} className="w-full h-full object-cover" />
                  ) : (
                     <Music className={`w-6 h-6 ${isPlaying ? 'text-primary' : 'text-surface-on-variant opacity-50'}`} />
                  )}
                  {isPlaying && playerState.isPlaying && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center backdrop-blur-[1px]">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h4 className={`text-body-large truncate font-medium ${isPlaying ? 'text-primary' : 'text-surface-on'}`}>{t.title}</h4>
                  <p className={`text-body-medium truncate ${isPlaying ? 'text-primary/80' : 'text-surface-on-variant'}`}>{t.artist}</p>
                </div>

                <div className="relative">
                    <button
                      onClick={(e) => {
                          e.stopPropagation();
                          if(confirm('Delete track?')) {
                              dbService.deleteTrack(t.id);
                              refreshLibrary();
                          }
                      }}
                      className="p-2 text-surface-on-variant/60 hover:text-error hover:bg-error-container rounded-full transition-all"
                      title="Delete track"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                </div>
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
