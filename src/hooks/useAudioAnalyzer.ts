import { useEffect, useRef, useState } from 'react';
import { useMotionValue, MotionValue } from 'framer-motion';

export interface AudioAnalysis {
  bass: MotionValue<number>;
  mid: MotionValue<number>;
  treble: MotionValue<number>;
  beat: boolean; // Keep as boolean state for event-driven triggers
}

// Global map to store source nodes to prevent "can only be connected once" error
const sourceNodes = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();
// Global audio context to prevent "max context" errors
let globalAudioContext: AudioContext | null = null;

const getAudioContext = () => {
    if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return globalAudioContext;
};

export const useAudioAnalyzer = (audioElement: HTMLAudioElement | null, isPlaying: boolean) => {
  const [beat, setBeat] = useState(false);

  // Use MotionValues to avoid React renders for continuous data
  const bass = useMotionValue(0);
  const mid = useMotionValue(0);
  const treble = useMotionValue(0);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>();
  const dataArrayRef = useRef<Uint8Array>();

  // Beat detection state
  const historyRef = useRef<number[]>([]);
  const lastBeatTimeRef = useRef(0);

  useEffect(() => {
    if (!audioElement) return;

    try {
        const audioCtx = getAudioContext();

        // Resume context if suspended (browser policy)
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        let source = sourceNodes.get(audioElement);
        if (!source) {
            source = audioCtx.createMediaElementSource(audioElement);
            sourceNodes.set(audioElement, source);
        }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        // Connect: Source -> Analyser -> Destination
        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        analyserRef.current = analyser;
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        return () => {
            // CRITICAL FIX: Ensure we don't break the audio path on unmount.
            // If we disconnect the analyser from destination, we must reconnect source to destination?
            // BUT, if we keep the hook at the App level, this cleanup only runs on App unmount (refresh), so it's fine.
            // If this hook is used in a child component that unmounts, we MUST handle reconnection.
            //
            // Better strategy:
            // If we disconnect analyser, the source is still connected to analyser.
            // We should disconnect source -> analyser.
            // AND ensure source -> destination is restored IF we want to bypass processing.
            // However, typically we just leave it connected if we plan to reuse.
            //
            // Given the plan to move this hook to App.tsx, the unmount won't happen during navigation.
            // So standard cleanup is safer.
            try {
                source?.disconnect(analyser);
                analyser.disconnect();
                // Reconnect source directly to destination to ensure playback continues
                // if this hook is unmounted but audio element persists.
                source?.connect(audioCtx.destination);
            } catch (e) {
                // Ignore disconnect errors
            }
        };
    } catch (e) {
        console.error("Audio Context Error:", e);
    }
  }, [audioElement]);

  useEffect(() => {
    if (!isPlaying || !analyserRef.current || !dataArrayRef.current) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        return;
    }

    const analyze = () => {
        const analyser = analyserRef.current!;
        const dataArray = dataArrayRef.current!;

        analyser.getByteFrequencyData(dataArray);

        let bassSum = 0;
        let midSum = 0;
        let trebleSum = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const val = dataArray[i] / 255;
            if (i < 3) bassSum += val;
            else if (i < 24) midSum += val;
            else trebleSum += val;
        }

        const b = bassSum / 3;
        const m = midSum / 21;
        const t = trebleSum / (128 - 24);

        // Update MotionValues directly (no render)
        bass.set(b);
        mid.set(m);
        treble.set(t);

        // Beat Detection
        const energy = b;
        const history = historyRef.current;
        history.push(energy);
        if (history.length > 40) history.shift();

        const avgEnergy = history.reduce((acc, val) => acc + val, 0) / history.length;

        const now = performance.now();
        const isBeat = energy > avgEnergy * 1.4 && (now - lastBeatTimeRef.current > 300) && energy > 0.3;

        if (isBeat) {
            lastBeatTimeRef.current = now;
            setBeat(true);
            // Reset beat state quickly to allow re-trigger
            setTimeout(() => setBeat(false), 100);
        }

        rafRef.current = requestAnimationFrame(analyze);
    };

    analyze();

    return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, bass, mid, treble]);

  return { bass, mid, treble, beat };
};
