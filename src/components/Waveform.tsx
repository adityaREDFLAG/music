import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface WaveformProps {
  isPlaying: boolean;
  color?: string;
  barCount?: number;
}

const Waveform: React.FC<WaveformProps> = React.memo(({ 
  isPlaying, 
  color = '#3B82F6', // Better default blue
  barCount = 32
}) => {
  // Generate unique animation configs for each bar
  const barConfigs = useMemo(() => 
    Array.from({ length: barCount }, (_, i) => {
      // Create varied patterns across the spectrum
      const position = i / barCount;
      const baseDuration = 0.5 + Math.sin(position * Math.PI) * 0.3;
      const phase = Math.random() * Math.PI * 2;
      
      return {
        duration: baseDuration + Math.random() * 0.2,
        delay: (Math.sin(phase) + 1) * 0.15,
        minHeight: 8 + Math.random() * 12, // 8-20%
        maxHeight: 40 + Math.random() * 55, // 40-95%
        phase,
      };
    }),
    [barCount]
  );

  return (
    <div 
      className="flex items-center justify-center gap-[2.5px] h-12"
      role="img"
      aria-label={isPlaying ? "Audio visualizer - playing" : "Audio visualizer - paused"}
    >
      {barConfigs.map((config, i) => (
        <Bar 
          key={i} 
          config={config}
          isPlaying={isPlaying} 
          color={color} 
        />
      ))}
    </div>
  );
});

Waveform.displayName = 'Waveform';

interface BarProps {
  config: {
    duration: number;
    delay: number;
    minHeight: number;
    maxHeight: number;
    phase: number;
  };
  isPlaying: boolean;
  color: string;
}

const Bar: React.FC<BarProps> = React.memo(({ 
  config,
  isPlaying, 
  color 
}) => {
  const { duration, delay, minHeight, maxHeight } = config;

  return (
    <motion.div
      initial={{ height: `${minHeight}%` }}
      animate={{
        height: isPlaying 
          ? [`${minHeight}%`, `${maxHeight}%`, `${minHeight}%`] 
          : `${minHeight}%`,
        opacity: isPlaying ? [0.7, 1, 0.7] : 0.3,
        scaleY: isPlaying ? [1, 1.05, 1] : 1,
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: "mirror",
        delay,
        ease: [0.45, 0.05, 0.55, 0.95], // Custom smooth ease
      }}
      style={{ 
        backgroundColor: color,
        boxShadow: isPlaying ? `0 0 8px ${color}40` : 'none'
      }}
      className="w-[3px] rounded-full"
    />
  );
}, (prev, next) => 
  prev.isPlaying === next.isPlaying && prev.color === next.color
);

Bar.displayName = 'Bar';

export default Waveform;
