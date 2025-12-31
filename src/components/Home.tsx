import React from 'react';
import { motion } from 'framer-motion';
import { Music, Play } from 'lucide-react';
import { Track } from '../types';

interface HomeProps {
  filteredTracks: Track[];
  playTrack: (id: string) => void;
  activeTab: string;
}

const Home: React.FC<HomeProps> = ({ filteredTracks, playTrack, activeTab }) => {
  if (activeTab !== 'home') return null;

  return (
    <motion.div key="home" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8 pt-4">
      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-title-large text-surface-on font-medium">Recent Heat</h2>
          <button
            onClick={() => filteredTracks[0] && playTrack(filteredTracks[0].id)}
            className="text-label-large font-medium text-primary bg-primary-container px-6 py-2.5 rounded-full hover:bg-opacity-80 transition-colors shadow-sm"
          >
            Play All
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredTracks.slice(0, 10).map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => playTrack(t.id)}
              className="group cursor-pointer flex flex-col gap-3"
            >
              <div className="aspect-square rounded-xl bg-surface-container-high overflow-hidden relative shadow-elevation-1 group-hover:shadow-elevation-3 transition-all duration-300">
                {t.coverArt ? (
                  <img src={t.coverArt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-variant">
                    <Music className="w-12 h-12 text-surface-on-variant opacity-50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <div className="bg-surface-on/80 rounded-full p-3 backdrop-blur-sm">
                     <Play className="w-6 h-6 text-surface fill-surface" />
                   </div>
                </div>
              </div>
              <div>
                <h3 className="text-body-large font-medium text-surface-on truncate">{t.title}</h3>
                <p className="text-body-medium text-surface-on-variant truncate">{t.artist}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </motion.div>
  );
};

export default Home;
