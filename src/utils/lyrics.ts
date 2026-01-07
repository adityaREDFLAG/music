import { Track, Lyrics, LyricLine, LyricWord } from '../types';
import { dbService } from '../db';

// --- HELPERS ---

/**
 * Parses "mm:ss.xx" or "mm:ss:xx" into seconds.
 */
const parseTime = (timeStr: string): number | null => {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:[\.\:](\d{1,3}))?$/);
  if (!match) return null;

  const min = parseInt(match[1], 10);
  const sec = parseInt(match[2], 10);
  const msPart = match[3] || "0";

  // Handle varying precision (.1 vs .01 vs .001)
  const divisor = Math.pow(10, msPart.length);
  const ms = parseInt(msPart, 10) / divisor;

  return min * 60 + sec + ms;
};

// --- PARSER ---

export const parseLrc = (lrc: string): Lyrics => {
  const lines: LyricLine[] = [];
  const lineRegex = /^\[(\d{1,2}:\d{2}(?:[\.\:]\d{1,3})?)\](.*)$/;

  const rawLines = lrc.split(/\r?\n/);

  rawLines.forEach((rawLine, index) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    const match = trimmed.match(lineRegex);
    if (!match) return;

    const lineTime = parseTime(match[1]);
    if (lineTime === null) return;

    const content = match[2].trim();
    
    // Parse Word Tags <mm:ss.xx> (Enhanced LRC format)
    const parts = content.split(/(<\d{1,2}:\d{2}(?:[\.\:]\d{1,3})?>)/);
    const hasTags = parts.length > 1;
    const words: LyricWord[] = [];
    let currentTime = lineTime;

    if (hasTags) {
      parts.forEach((part) => {
        if (!part) return;

        if (part.startsWith('<') && part.endsWith('>')) {
          const t = parseTime(part.slice(1, -1));
          if (t !== null) currentTime = t;
          return;
        }

        const text = part.trim();
        if (text) {
          words.push({ time: currentTime, text, endTime: 0, confidence: 1.0 }); // Init endTime, max confidence for real synced lyrics
        }
      });

      // Fix: Ensure every word has an endTime
      for (let i = 0; i < words.length; i++) {
        if (i < words.length - 1) {
          words[i].endTime = words[i + 1].time;
        } else {
          // Last word logic: Try to find start of next line, otherwise guess +0.5s
          let nextLineTime = lineTime + 5; // Fallback

          // Peek ahead to find the next valid line time
          for(let j = index + 1; j < rawLines.length; j++) {
               const nextMatch = rawLines[j].trim().match(lineRegex);
               if(nextMatch) {
                   const t = parseTime(nextMatch[1]);
                   if(t !== null) {
                       nextLineTime = t;
                       break;
                   }
               }
          }
          words[i].endTime = Math.min(words[i].time + 1.5, nextLineTime);
        }
      }
    }

    if (hasTags && words.length > 0) {
      lines.push({
        time: lineTime,
        text: words.map((w) => w.text).join(' '), // Reconstruct clean text from words
        words,
      });
    } else if (content) {
      lines.push({ time: lineTime, text: content });
    }
  });

  const sortedLines = lines.sort((a, b) => a.time - b.time);
  return {
    lines: sortedLines,
    synced: true,
    isWordSynced: sortedLines.some((l) => l.words && l.words.length > 1),
    error: false,
  };
};

// --- DETERMINISTIC WORD TIMING GENERATOR (OFFLINE SAFE) ---

interface WordAnalysis {
  weight: number;
  confidence: number;
  syllables: number;
}

const COUNT_VOWELS_REGEX = /[aeiouy]+/gi;
const LONG_VOWEL_REGEX = /(?:ee|oo|ea|ai|oa|au|ou|ie|ei|oy|uy|aa|ii|uu)/i;
const CONNECTORS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor',
  'at', 'by', 'for', 'from', 'in', 'into', 'of', 'off', 'on', 'onto', 'out', 'over', 'to', 'up', 'with',
  'it', 'is', 'was', 'are', 'am', 'be',
  'oh', 'uh', 'ah', 'hm', 'hmm'
]);

const analyzeWordStructure = (word: string): WordAnalysis => {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return { weight: 0.5, confidence: 0.5, syllables: 1 };

  // 1. Syllable Approximation
  const vowelMatches = clean.match(COUNT_VOWELS_REGEX);
  const syllables = vowelMatches ? vowelMatches.length : 1;

  // 2. Base Weight Calculation
  let weight = syllables * 1.0;

  // Vocal Behavior Rules
  const hasLongVowel = LONG_VOWEL_REGEX.test(clean);
  if (hasLongVowel) weight += 0.5; // Stretch vowels

  const isConnector = CONNECTORS.has(clean);
  if (isConnector) weight *= 0.6; // Rush connectors

  if (word.length >= 7) weight *= 1.2; // Complex words take longer

  // Punctuation check (Pause before emotional/end words)
  // "Pause before emotional words" -> effectively implies the current word is held longer if it has punctuation
  if (/[\.,\!\?]$/.test(word)) weight *= 1.3;

  weight = Math.max(0.3, weight);

  // 3. Confidence Scoring
  let confidence = 0.8; // Base confidence
  if (syllables >= 2) confidence += 0.1;
  if (clean.length > 6) confidence += 0.1;
  if (isConnector) confidence -= 0.1;
  if (clean.length < 3 && syllables === 1) confidence -= 0.1; // Short monosyllabic words are risky

  return {
    weight,
    confidence: Math.min(0.95, Math.max(0.3, confidence)),
    syllables
  };
};

export const generateWordTiming = (lines: LyricLine[], durationTotal?: number): LyricLine[] => {
  return lines.map((line, i) => {
    // If words are already synced (Enhanced LRC), preserve them
    if (line.words && line.words.length > 0) {
      return line;
    }

    // Determine end time of the line (Next line start)
    let lineEndTime = 0;
    if (i < lines.length - 1) {
      lineEndTime = lines[i + 1].time;
    } else {
      // Last line: default to line start + 5s or total duration if available
      lineEndTime = durationTotal ? Math.min(line.time + 5, durationTotal) : line.time + 5;
    }

    // Ensure strictly positive duration
    const lineDuration = Math.max(0.1, lineEndTime - line.time);

    // Split text into words, preserving content
    const rawWords = line.text.trim().split(/\s+/);
    if (rawWords.length === 0 || (rawWords.length === 1 && rawWords[0] === '')) {
      return { ...line, words: [] };
    }

    // Phase 1: Analyze & Weighting
    const analyses = rawWords.map(analyzeWordStructure);
    const totalWeight = analyses.reduce((sum, a) => sum + a.weight, 0);

    let currentTime = line.time;
    let words: LyricWord[] = [];

    // Phase 2: Allocation & Timing
    rawWords.forEach((text, idx) => {
      const analysis = analyses[idx];
      const wordDuration = (analysis.weight / totalWeight) * lineDuration;

      // Visual Timing Behavior: Lead (-40ms) & Tail (+60ms)
      // Note: We track the "logical" time for calculation flow, but output the "visual" time.
      // However, we must ensure sequential consistency.

      const calculatedStart = currentTime;
      const calculatedEnd = currentTime + wordDuration;

      const visualStart = calculatedStart - 0.04;
      const visualEnd = calculatedEnd + 0.06;

      words.push({
        text,
        time: visualStart,
        endTime: visualEnd,
        confidence: analysis.confidence
      });

      currentTime += wordDuration;
    });

    // Phase 3: Grouping (Confidence-based Fallback)
    // "If confidence < 0.6, group words"
    // We iterate backwards to merge into previous or forwards to merge next?
    // Forward merge strategy: If current is low conf, merge with next.
    const groupedWords: LyricWord[] = [];

    for (let j = 0; j < words.length; j++) {
      let current = words[j];

      // Attempt to group if confidence is low, but don't group if it makes the chunk too long (> 3 words)
      // We will perform a lookahead merge.

      while (
        j < words.length - 1 &&
        (current.confidence! < 0.6 || words[j+1].confidence! < 0.6) &&
        // Safety break: don't merge across long gaps (unlikely here since we densely packed)
        // Safety break: limit group size? Let's just merge pairs or triplets naturally.
        (groupedWords.length === 0 || groupedWords[groupedWords.length - 1].endTime! <= current.time) // Sanity check
      ) {
         // Merge j and j+1
         const next = words[j+1];

         // Combined text
         current.text += ' ' + next.text;

         // Combined timing: Start of first, End of second (plus the tail logic is already in 'next')
         // Actually, current.endTime is (T1 + 0.06), next.endTime is (T2 + 0.06).
         // We want the visual group to span from T1_start to T2_end.
         current.endTime = next.endTime;

         // Average confidence? Or take min?
         current.confidence = (current.confidence! + next.confidence!) / 2;

         // Update loop index to skip the merged word
         j++;
      }

      groupedWords.push(current);
    }

    // Phase 4: Final visual polish (clamp overlaps if they got too wild due to merging?)
    // Our logic `visualEnd = calculatedEnd + 0.06` and `visualStart = calculatedStart - 0.04`
    // naturally creates 0.1s overlap.
    // The grouping preserves the outer bounds.

    return {
      ...line,
      words: groupedWords
    };
  });
};

// --- MAIN FETCH STRATEGY ---

export const fetchLyrics = async (track: Track, force = false, forceResync = false): Promise<Lyrics> => {
  const wordSyncEnabled = await dbService.getSetting<boolean>('wordSyncEnabled');

  // Decide if we should generate word timings
  const shouldGenerateWordTiming = wordSyncEnabled || forceResync;

  // Return cache if valid
  // If force is true, we bypass cache.
  // If forceResync is true, we might need to re-process the cached lyrics if they aren't word-synced.
  if (!force && track.lyrics && !track.lyrics.error) {
    // If we want word sync, but the cache doesn't have it, we should proceed to generation
    // unless force is false and we rely on the cache.
    // However, if we have cache, we can just upgrade it in-place without fetching LRCLIB again.
    if (track.lyrics.isWordSynced || !shouldGenerateWordTiming) {
      return track.lyrics;
    }
    // If we have cached lyrics but they are not word synced and we want them to be,
    // we can skip the network fetch and go straight to generation using the cache.
    // But we need to make sure we don't skip the "Best Result" logic below.
  }

  let bestResult: Lyrics = { lines: [], synced: false, error: true };

  // 1. Try LRCLIB (only if force is true or we don't have good cached lyrics to work with)
  let fetchedNewLyrics = false;
  if (force || !track.lyrics || track.lyrics.error) {
    try {
      const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist)}&track_name=${encodeURIComponent(track.title)}&duration=${track.duration}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics) {
          bestResult = parseLrc(data.syncedLyrics);
          fetchedNewLyrics = true;
        } else if (data.plainLyrics) {
          bestResult = { lines: [], synced: false, plain: data.plainLyrics, error: false };
          fetchedNewLyrics = true;
        }
      }
    } catch (e) {
      console.warn('LRCLIB failed', e);
    }
  }

  // FALLBACK: Use cached lyrics as base if LRCLIB failed or we didn't fetch
  if (!fetchedNewLyrics && track.lyrics && !track.lyrics.error) {
     bestResult = track.lyrics;
  }

  // 2. Deterministic Word Timing Generation
  // Apply if enabled/forced AND the lyrics are synced (have lines) BUT not yet word-synced
  if (shouldGenerateWordTiming && bestResult.synced && !bestResult.isWordSynced) {
    console.log("Generating deterministic word timings...");
    const enhancedLines = generateWordTiming(bestResult.lines, track.duration);
    bestResult = {
      ...bestResult,
      lines: enhancedLines,
      isWordSynced: true
    };
  } else if (forceResync && bestResult.synced) {
     // Even if it says isWordSynced, forceResync might mean "regenerate" (e.g. if previous was bad)
     // But wait, if it was Enhanced LRC from source, we shouldn't overwrite it with dumb generation?
     // generateWordTiming checks `if (line.words...) return line;` so it preserves Enhanced LRC.
     // So calling it again is safe.
     const enhancedLines = generateWordTiming(bestResult.lines, track.duration);
     bestResult = {
        ...bestResult,
        lines: enhancedLines,
        isWordSynced: true
     };
  }

  if (!bestResult.error) {
    await dbService.saveTrack({ ...track, lyrics: bestResult });
  }

  return bestResult;
};
