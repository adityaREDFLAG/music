// src/utils/automix.ts

import { Track } from '../types';

// --- CAMELOT WHEEL UTILS ---
// Keys are represented as "1A", "1B", etc.
const CAMELOT_KEYS: string[] = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B',
  '7A', '7B', '8A', '8B', '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'
];

/**
 * Returns a compatibility score (0-1) between two keys.
 * 1 = Perfect Match (Same Key)
 * 0.9 = Dominant/Subdominant (±1 hour on wheel) or Relative Major/Minor (Same number, different letter)
 * 0.5 = Compatible energy
 * 0.0 = Clash
 */
export const getKeyCompatibility = (key1?: string, key2?: string): number => {
  if (!key1 || !key2) return 0.5; // Unknown keys are neutral

  const k1 = key1.toUpperCase();
  const k2 = key2.toUpperCase();

  if (k1 === k2) return 1.0;

  // Parse Number and Letter
  const match1 = k1.match(/^(\d+)([AB])$/);
  const match2 = k2.match(/^(\d+)([AB])$/);

  if (!match1 || !match2) return 0.5;

  const num1 = parseInt(match1[1]);
  const char1 = match1[2];
  const num2 = parseInt(match2[1]);
  const char2 = match2[2];

  // 1. Same Number, Different Letter (Relative Major/Minor) -> High compatibility
  if (num1 === num2 && char1 !== char2) return 0.9;

  // 2. Adjacent Number (±1), Same Letter -> Harmonic mix
  const diff = Math.abs(num1 - num2);
  const isAdjacent = diff === 1 || diff === 11; // 12 wraps to 1
  if (isAdjacent && char1 === char2) return 0.8;

  // 3. Diagonal Mix (±1, different letter) -> Energy boost/drop
  if (isAdjacent && char1 !== char2) return 0.7;

  return 0.1;
};

/**
 * Returns BPM compatibility score (0-1).
 * 1 = Exact match
 * Drops off as BPM difference increases.
 */
export const getBpmCompatibility = (bpm1?: number, bpm2?: number): number => {
  if (!bpm1 || !bpm2) return 0.6; // Neutral if unknown

  // Check double/half time
  const ratios = [1, 0.5, 2];
  let minDiff = Infinity;

  ratios.forEach(r => {
    const adjustedBpm2 = bpm2 * r;
    const diff = Math.abs(bpm1 - adjustedBpm2);
    if (diff < minDiff) minDiff = diff;
  });

  // Tolerance window: 0-5 BPM is good. >20 BPM is bad.
  if (minDiff <= 1) return 1.0;
  if (minDiff <= 5) return 0.9;
  if (minDiff <= 10) return 0.7;
  if (minDiff <= 20) return 0.4;
  return 0.1;
};

/**
 * Heuristic to assign mock metadata if missing
 * In a real app, this would use audio analysis.
 */
export const enrichTrackMetadata = (track: Track): Track => {
  if (track.bpm && track.key) return track;

  // Deterministic mock based on ID hash
  let hash = 0;
  for (let i = 0; i < track.id.length; i++) {
    hash = ((hash << 5) - hash) + track.id.charCodeAt(i);
    hash |= 0;
  }

  const mockBpm = 70 + (Math.abs(hash) % 110); // 70-180 BPM
  const mockKeyIndex = Math.abs(hash) % CAMELOT_KEYS.length;

  return {
    ...track,
    bpm: track.bpm || Math.round(mockBpm),
    key: track.key || CAMELOT_KEYS[mockKeyIndex],
    energy: track.energy || (Math.abs(hash) % 10) / 10
  };
};

/**
 * Selects the best next track from candidates based on the current track.
 */
export const getSmartNextTrack = (currentTrack: Track, candidates: Track[]): Track | null => {
  if (candidates.length === 0) return null;

  const current = enrichTrackMetadata(currentTrack);

  // Score each candidate
  const scored = candidates.map(c => {
    const candidate = enrichTrackMetadata(c);
    const keyScore = getKeyCompatibility(current.key, candidate.key);
    const bpmScore = getBpmCompatibility(current.bpm, candidate.bpm);

    // Weighted score: BPM matters more for mixing, Key for harmony
    const totalScore = (keyScore * 0.4) + (bpmScore * 0.6);
    return { track: c, score: totalScore };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return best match if score is decent (> 0.5), else just return the first one (fallback)
  // But to add variety, we pick random from top 3
  const topCandidates = scored.slice(0, 3);
  if (topCandidates.length > 0) {
      return topCandidates[Math.floor(Math.random() * topCandidates.length)].track;
  }

  return candidates[0];
};
