import React from 'react';
import { motion } from 'framer-motion';
import { Music } from 'lucide-react';

interface LoadingOverlayProps {
  progress: number;
  message: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ progress, message }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] glass-dark flex flex-col items-center justify-center p-10 text-white"
  >
    <motion.div
      animate={{ scale: [1, 1.1, 1], rotate: [0, 360] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="mb-12 p-10 rounded-[60px] bg-white/10 shadow-2xl"
    >
      <Music className="w-24 h-24 text-[#EADDFF]" strokeWidth={1} />
    </motion.div>
    <h2 className="text-4xl font-black mb-3 tracking-tighter">Syncing...</h2>
    <p className="text-white/40 font-bold mb-10 text-center max-w-sm text-lg">{message || "Preparing your collection..."}</p>
    <div className="w-full max-w-md h-4 bg-white/5 rounded-full overflow-hidden mb-4 p-1">
      <motion.div
        className="h-full bg-[#EADDFF] rounded-full shadow-[0_0_20px_rgba(234,221,255,0.4)]"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
      />
    </div>
    <span className="text-2xl font-black opacity-90 tabular-nums">{Math.round(progress)}%</span>
  </motion.div>
);

export default LoadingOverlay;
