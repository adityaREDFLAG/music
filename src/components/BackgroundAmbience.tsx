import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BackgroundAmbienceProps {
  coverArt?: string;
  className?: string;
}

export const BackgroundAmbience: React.FC<BackgroundAmbienceProps> = ({
  coverArt,
  className = ""
}) => {
  return (
    <div className={`fixed inset-0 -z-10 bg-background overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout">
        {coverArt ? (
          <motion.div
            key={coverArt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            className="absolute inset-0 z-0"
          >
             {/* Large soft blurry background */}
             <img
               src={coverArt}
               alt=""
               className="absolute inset-0 w-full h-full object-cover blur-[120px] scale-150 opacity-40 saturate-150"
             />

             {/* Secondary layer for depth */}
             <img
               src={coverArt}
               alt=""
               className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] object-cover blur-[180px] opacity-20 animate-pulse-slow mix-blend-color-dodge"
             />

             {/* Dark overlay to ensure text readability */}
             <div className="absolute inset-0 bg-black/40" />
          </motion.div>
        ) : (
          <motion.div
            key="default-blobs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 bg-[#09090b]"
          >
             <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/20 via-black to-rose-900/20" />
             <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-indigo-500/10 blur-[180px] rounded-full mix-blend-screen animate-pulse-slow" />
             <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[80%] bg-rose-500/10 blur-[180px] rounded-full mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grain Texture for Film/Cinema Look */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay z-[1]"
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
      />
    </div>
  );
};
