import { useState } from 'react';
import { useMotionValue, MotionValue } from 'framer-motion';

export interface AudioAnalysis {
  bass: MotionValue<number>;
  mid: MotionValue<number>;
  treble: MotionValue<number>;
  beat: boolean;
}

// Global audio context to prevent "max context" errors (kept for compatibility)
let globalAudioContext: AudioContext | null = null;

export const getAudioContext = () => {
    if (!globalAudioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        globalAudioContext = new AudioContextClass();
        (window as any).audioContext = globalAudioContext;
    }
    return globalAudioContext;
};

export const resumeAudioContext = async () => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch (e) {
            console.error("Failed to resume AudioContext", e);
        }
    }
};

export const useAudioAnalyzer = (audioElement: HTMLAudioElement | null, isPlaying: boolean) => {
  // Always false since analysis is disabled
  const [beat] = useState(false);

  // Initialize MotionValues with 0
  const bass = useMotionValue(0);
  const mid = useMotionValue(0);
  const treble = useMotionValue(0);

  // NOTE: We have intentionally disabled the Web Audio API analysis to fix background playback issues.
  // When an audio element is routed through the Web Audio API (createMediaElementSource),
  // the playback becomes dependent on the AudioContext. If the tab goes to the background,
  // browsers (especially on mobile) often suspend the AudioContext to save resources,
  // which kills the audio playback. By skipping this connection, we let the <audio> element
  // play natively, which handles background playback reliably.

  // Previously this hook would:
  // 1. Create a MediaElementAudioSourceNode from the audio element.
  // 2. Connect it to an AnalyserNode.
  // 3. Connect the source to the destination (speakers).
  // 4. Run a loop to analyze frequency data and update the motion values.

  // This logic is completely removed to ensure the audio element is never hijacked.

  return { bass, mid, treble, beat };
};
