import React from 'react';
import { motion } from 'framer-motion';

interface WaveformProps {
  isPlaying: boolean;
  color?: string;
  barCount?: number;
}

const Waveform: React.FC<WaveformProps> = ({ 
  isPlaying, 
  color = '#FFFFFF', 
  barCount = 24 // Number of bars to render
}) => {
  return (
    <div className="flex items-center justify-center gap-[3px] h-12">
      {Array.from({ length: barCount }).map((_, i) => (
        <Bar key={i} index={i} isPlaying={isPlaying} color={color} />
      ))}
    </div>
  );
};

const Bar: React.FC<{ index: number; isPlaying: boolean; color: string }> = ({ 
  index, 
  isPlaying, 
  color 
}) => {
  // Generate random animation parameters for "organic" look
  const randomDuration = 0.4 + Math.random() * 0.4; // Between 0.4s and 0.8s
  const randomDelay = Math.random() * 0.2;
  const maxHeight = 20 + Math.random() * 80; // Height between 20% and 100%

  return (
    <motion.div
      initial={{ height: "10%" }}
      animate={{
        // If playing, cycle between small and random height. If paused, go to 10%
        height: isPlaying ? ["10%", `${maxHeight}%`, "10%"] : "10%",
        opacity: isPlaying ? 1 : 0.5,
      }}
      transition={{
        duration: randomDuration,
        repeat: Infinity,
        repeatType: "reverse",
        delay: randomDelay,
        ease: "easeInOut",
      }}
      style={{ backgroundColor: color }}
      className="w-1.5 rounded-full"
    />
  );
};

export default Waveform;
