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
          words.push({ time: currentTime, text, endTime: 0 }); // Init endTime
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

export const generateWordTiming = (lines: LyricLine[], durationTotal?: number): LyricLine[] => {
  return lines.map((line, i) => {
    // If words are already synced (Enhanced LRC), preserve them
    if (line.words && line.words.length > 0) {
      return line;
    }

    // Determine end time of the line (Next line start)
    let endTime = 0;
    if (i < lines.length - 1) {
      endTime = lines[i + 1].time;
    } else {
      // Last line: default to line start + 5s or total duration if available
      endTime = durationTotal ? Math.min(line.time + 5, durationTotal) : line.time + 5;
    }

    // Ensure strictly positive duration, slightly reduced min to allow for fast lines
    const lineDuration = Math.max(0.2, endTime - line.time);

    // Split text into words, preserving content
    const rawWords = line.text.trim().split(/\s+/);
    if (rawWords.length === 0 || (rawWords.length === 1 && rawWords[0] === '')) {
      return line;
    }

    const wordCount = rawWords.length;

    // --- 3. Insert micro gaps ---
    // Rule: GAP = 0.03–0.05 seconds
    const GAP = 0.04;

    // Safety: Don't let gaps consume more than 50% of the line
    let actualGap = GAP;
    const totalGapNeeded = (wordCount - 1) * GAP;
    if (totalGapNeeded > lineDuration * 0.5) {
      actualGap = (lineDuration * 0.5) / Math.max(1, wordCount - 1);
    }

    const totalGapTime = (wordCount - 1) * actualGap;
    const availableForWords = Math.max(0, lineDuration - totalGapTime);

    // --- 2. Bias long words ---
    // Rule: If word.length >= 6, duration *= 1.3–1.6
    let totalWeight = 0;
    const weights = rawWords.map(word => {
      const len = word.length;
      let weight = 1.0;
      if (len >= 6) {
        weight = 1.5;
      }
      totalWeight += weight;
      return weight;
    });

    let cursor = line.time;

    const words: LyricWord[] = rawWords.map((text, wIdx) => {
      const weight = weights[wIdx];
      const wordDuration = (weight / totalWeight) * availableForWords;

      const start = cursor;
      const end = start + wordDuration;

      // Advance cursor: word duration + gap (if not last word)
      if (wIdx < wordCount - 1) {
        cursor = end + actualGap;
      } else {
        cursor = end;
      }

      return {
        text,
        time: start,
        endTime: end
      };
    });

    // --- 1. Clamp last word aggressively ---
    // Rule: lastWord.endTime = nextLine.time
    if (words.length > 0) {
      words[words.length - 1].endTime = endTime;
    }

    return {
      ...line,
      words
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
