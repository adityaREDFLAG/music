import React from 'react';
import { motion } from 'framer-motion';
import { Music, PlusCircle, Trash2, Loader2 } from 'lucide-react';
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
    <motion.div key="library" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-10">
      <div className="flex gap-4 overflow-x-auto scrollbar-hide py-2">
        {(['Songs', 'Albums', 'Artists', 'Playlists'] as LibraryTab[]).map(t => (
          <button key={t} onClick={() => setLibraryTab(t)} className={`px-12 py-5 rounded-[32px] font-black text-xl transition-all shadow-sm ${libraryTab === t ? 'bg-[#21005D] text-white shadow-[#21005D]/20' : 'bg-white text-[#49454F] border border-black/[0.05]'}`}>{t}</button>
        ))}
      </div>

      {libraryTab === 'Songs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTracks.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => playTrack(t.id)}
              className={`flex items-center gap-8 p-6 rounded-[48px] cursor-pointer transition-all ${playerState.currentTrackId === t.id ? 'bg-[#EADDFF] shadow-lg' : 'hover:bg-white border border-transparent hover:border-black/[0.03]'}`}
            >
              <div className="w-20 h-20 rounded-[32px] bg-white/60 flex items-center justify-center shadow-inner relative overflow-hidden flex-shrink-0">
                <Music className={`w-10 h-10 ${playerState.currentTrackId === t.id ? 'text-[#6750A4]' : 'opacity-10'}`} />
                {playerState.currentTrackId === t.id && playerState.isPlaying && (
                  <div className="absolute inset-0 bg-[#6750A4]/10 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-[#6750A4] animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-2xl font-black truncate leading-tight tracking-tight">{t.title}</h4>
                <p className="text-lg font-bold opacity-30 truncate tracking-tight">{t.artist}</p>
              </div>
              <div className="flex items-center gap-2">
                 <button onClick={(e) => { e.stopPropagation(); dbService.deleteTrack(t.id); refreshLibrary(); }} className="p-5 text-red-300 hover:text-red-500 rounded-full hover:bg-red-50 transition-all"><Trash2 className="w-7 h-7" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {libraryTab === 'Playlists' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div onClick={() => alert("Playlist creation logic in development")} className="aspect-square rounded-[60px] border-4 border-dashed border-black/10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-[#6750A4] hover:text-[#6750A4] transition-all">
            <PlusCircle className="w-16 h-16" strokeWidth={1} /><span className="text-2xl font-black">Craft Playlist</span>
          </div>
          <div className="aspect-square rounded-[60px] bg-[#21005D] p-12 text-white flex flex-col justify-end shadow-2xl relative overflow-hidden group">
             <Music className="absolute -top-10 -right-10 w-48 h-48 opacity-10 group-hover:rotate-12 transition-transform duration-700" />
             <h3 className="text-4xl font-black leading-tight">My Vibe</h3>
             <p className="text-xl font-bold opacity-60">{filteredTracks.length} tracks</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Library;
