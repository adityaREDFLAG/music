import React from 'react';
import { motion } from 'framer-motion';

interface WaveformProps {
  isPlaying: boolean;
  // keeping the prop for future use, but focusing on refined CSS animation for reliability
  audioRef?: React.MutableRefObject<HTMLAudioElement | null>;
}

const Waveform: React.FC<WaveformProps> = ({ isPlaying }) => {
  // We'll use 16 bars for a denser, more professional look
  const barCount = 16;
  
  return (
    <div className="flex items-center gap-[3px] h-10 px-2 justify-center">
      {[...Array(barCount)].map((_, i) => {
        // Calculate a "base" height to create a bell-curve effect (taller in middle)
        const distanceFromCenter = Math.abs(i - barCount / 2) / (barCount / 2);
        const baseHeight = 32 * (1 - distanceFromCenter * 0.5); 
        
        return (
          <motion.div
            key={i}
            initial={{ height: 4, opacity: 0.3 }}
            animate={isPlaying ? {
              height: [
                `${baseHeight * 0.4}px`, 
                `${baseHeight}px`, 
                `${baseHeight * 0.6}px`, 
                `${baseHeight * 0.9}px`, 
                `${baseHeight * 0.4}px`
              ],
              opacity: [0.4, 1, 0.7, 1, 0.4],
            } : { 
              height: 4, 
              opacity: 0.2 
            }}
            transition={{
              duration: 0.6 + (i % 3) * 0.1, // Staggered speeds
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.05, // Sequential entry wave
            }}
            style={{ backgroundColor: 'white' }}
            className="w-[3px] rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]"
          />
        );
      })}
    </div>
  );
};

export default Waveform;
