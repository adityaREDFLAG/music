import React from 'react';
import { motion } from 'framer-motion';

const Waveform = ({ isPlaying }: { isPlaying: boolean }) => (
  <div className="flex items-end gap-1.5 h-16 px-10">
    {[...Array(24)].map((_, i) => (
      <motion.div
        key={i}
        animate={isPlaying ? {
          height: [12, Math.random() * 48 + 12, 12],
          opacity: [0.3, 0.8, 0.3]
        } : { height: 8, opacity: 0.2 }}
        transition={{
          duration: 0.5 + Math.random() * 0.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="w-2 bg-current rounded-full"
      />
    ))}
  </div>
);

export default Waveform;
