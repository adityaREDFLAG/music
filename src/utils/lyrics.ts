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

// --- PROFESSIONAL WORD TIMING ENGINE ---

interface WordAnalysis {
  weight: number;
  confidence: number;
  syllables: number;
  isFiller: boolean;
}

const MIN_WORD_DURATION = 0.08; // 80ms absolute minimum
const MAX_WORD_DURATION = 1.2;  // 1.2s soft cap
const OVERLAP_DURATION = 0.08;  // Slight overlap for smoothness

const analyzeWordStructure = (word: string): WordAnalysis => {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');

  // Empty/Symbol handling
  if (!clean) return { weight: 0.1, confidence: 0.0, syllables: 0, isFiller: true };

  // 1. Syllable Counting (Heuristic)
  const vowelMatches = clean.match(/[aeiouy]+/g);
  let syllables = vowelMatches ? vowelMatches.length : 1;
  // Adjustment: silent 'e' at end
  if (clean.endsWith('e') && syllables > 1 && !/[aeiouy]le$/i.test(clean)) {
      syllables -= 1;
  }

  // 2. Weight Factors
  let weight = syllables * 1.0;

  // Phonetics: Long Vowels (digraphs)
  const hasLongVowel = /(?:ee|oo|ea|ai|oa|au|ou|ie|ei|oy|uy|aa|ii|uu)/i.test(clean);
  if (hasLongVowel) weight += 0.4; // Elongated vowel bonus

  // Connectors / Fillers
  const isConnector = /^(and|the|to|of|in|it|is|on|at|by|my|so|up|or|as|be|do|if|me|we|he|no|oh|uh|ah)$/.test(clean);
  if (isConnector) {
      weight *= 0.5; // Shorten connectors significantly
  } else if (clean.length > 5) {
      weight *= 1.1; // Longer words naturally take slightly more time
  }

  // Punctuation/Emphasis
  // "Emotional or sustained words may overlap neighbors slightly"
  // We give them more weight so they take up more time in the allocation
  if (/[\!\?\u2026]$/.test(word)) weight *= 1.4; // Strong emotion/sustain
  else if (/[\,\.]$/.test(word)) weight *= 1.2; // Pause/Comma

  // Capitalization (Emphasis)
  if (word === word.toUpperCase() && clean.length > 1) weight *= 1.2;

  // Clamp weight
  weight = Math.max(0.2, weight);

  // 3. Confidence Scoring
  let confidence = 0.8;
  if (syllables >= 2) confidence += 0.1;
  if (isConnector) confidence -= 0.1; // Short words are harder to predict perfectly

  return {
      weight,
      confidence: Math.min(0.95, Math.max(0.2, confidence)),
      syllables,
      isFiller: isConnector
  };
};

export const generateWordTiming = (lines: LyricLine[], durationTotal?: number): LyricLine[] => {
  return lines.map((line, i) => {
    // If words are already synced (Enhanced LRC), preserve them
    if (line.words && line.words.length > 0) {
      return line;
    }

    // Determine strictly immutable line start and end
    const lineStart = line.time;
    let lineEnd = 0;
    if (i < lines.length - 1) {
      lineEnd = lines[i + 1].time;
    } else {
      // Last line: default to line start + 5s or total duration
      lineEnd = durationTotal ? Math.min(line.time + 5, durationTotal) : line.time + 5;
    }

    // Hard Constraint: All word timings must stay strictly within the line duration
    let lineDuration = Math.max(0.1, lineEnd - lineStart);

    // Split text
    const rawWords = line.text.trim().split(/\s+/);
    if (rawWords.length === 0 || (rawWords.length === 1 && rawWords[0] === '')) {
      return { ...line, words: [] };
    }

    // Phase 1: Analyze
    const analyses = rawWords.map(analyzeWordStructure);
    const totalWeight = analyses.reduce((sum, a) => sum + a.weight, 0);

    // Phase 2: Allocate Duration
    // Initial naive allocation
    let wordDurations = analyses.map(a => (a.weight / totalWeight) * lineDuration);

    // Phase 3: Enforce Quality Controls (Min Duration)
    // We try to enforce 80ms min. If a word is < 0.08s, we steal from neighbors.
    // Iterative correction
    let needsCorrection = true;
    let iterations = 0;

    while (needsCorrection && iterations < 5) {
        needsCorrection = false;
        iterations++;

        for (let j = 0; j < wordDurations.length; j++) {
            if (wordDurations[j] < MIN_WORD_DURATION) {
                const deficit = MIN_WORD_DURATION - wordDurations[j];

                // Find a donor (preferably a long neighbor)
                // Check right neighbor first, then left
                let donorIndex = -1;

                if (j < wordDurations.length - 1 && wordDurations[j+1] > MIN_WORD_DURATION + deficit) {
                    donorIndex = j + 1;
                } else if (j > 0 && wordDurations[j-1] > MIN_WORD_DURATION + deficit) {
                    donorIndex = j - 1;
                }

                if (donorIndex !== -1) {
                    wordDurations[j] += deficit;
                    wordDurations[donorIndex] -= deficit;
                    needsCorrection = true; // Re-check constraints
                }
            }
        }
    }

    // If still failing (e.g. extremely fast rap), normalize to fit exactly
    // (We prioritize line duration over min-width if we have to choose)
    const currentTotal = wordDurations.reduce((a, b) => a + b, 0);
    if (Math.abs(currentTotal - lineDuration) > 0.001) {
        const scale = lineDuration / currentTotal;
        wordDurations = wordDurations.map(d => d * scale);
    }

    // Phase 4: Generate Timestamps & Smoothing
    let cursor = lineStart;
    let words: LyricWord[] = [];

    rawWords.forEach((text, idx) => {
        let duration = wordDurations[idx];
        const analysis = analyses[idx];

        // "Word timings must progress forward without jitter"
        // Start is exactly current cursor
        const start = cursor;
        const end = cursor + duration; // Logical end

        // "Emotional or sustained words may overlap neighbors slightly"
        // We add overlap to visual endTime only, not affecting the next word's start time
        const overlap = analysis.isFiller ? 0 : OVERLAP_DURATION;

        // Enforce Max Duration (Soft Cap)
        // If a word is really long (e.g. > 1.2s), we visually cap it to prevent "stuck" highlight look,
        // UNLESS it's a very long word (high syllable count) which justifies the length.
        let visualEndTime = end + overlap;

        // If duration is > 1.2s and syllables < 3, cap it.
        // We do this by modifying visualEndTime.
        // We do NOT modify 'cursor' or 'duration' because we need to preserve the timing slot for the next word.
        if (duration > MAX_WORD_DURATION && analysis.syllables < 3) {
             // Cap visual duration to 1.2s
             visualEndTime = start + MAX_WORD_DURATION + overlap;
        }

        words.push({
            text,
            time: start, // Visual start
            endTime: visualEndTime, // Visual end (potentially capped)
            confidence: analysis.confidence
        });

        cursor += duration;
    });

    // Phase 5: Fallback / Grouping
    // "If confident word-level timing cannot be produced, return grouped words"
    // We group if confidence is very low.
    const groupedWords: LyricWord[] = [];
    for (let j = 0; j < words.length; j++) {
        let current = words[j];

        // Look ahead for low confidence sequence
        while (
            j < words.length - 1 &&
            (current.confidence! < 0.5 || words[j+1].confidence! < 0.5) &&
            // Don't create groups longer than 1.5s usually
            (words[j+1].endTime! - current.time < 1.5)
        ) {
            const next = words[j+1];
            current.text += ' ' + next.text;
            current.endTime = next.endTime;
            current.confidence = (current.confidence! + next.confidence!) / 2;
            j++;
        }
        groupedWords.push(current);
    }

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
  if (!force && track.lyrics && !track.lyrics.error) {
    if (track.lyrics.isWordSynced || !shouldGenerateWordTiming) {
      return track.lyrics;
    }
  }

  let bestResult: Lyrics = { lines: [], synced: false, error: true };

  // 1. Try LRCLIB
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

  // FALLBACK: Use cached lyrics
  if (!fetchedNewLyrics && track.lyrics && !track.lyrics.error) {
     bestResult = track.lyrics;
  }

  // 2. Deterministic Word Timing Generation
  if (shouldGenerateWordTiming && bestResult.synced && !bestResult.isWordSynced) {
    console.log("Generating professional word timings...");
    const enhancedLines = generateWordTiming(bestResult.lines, track.duration);
    bestResult = {
      ...bestResult,
      lines: enhancedLines,
      isWordSynced: true
    };
  } else if (forceResync && bestResult.synced) {
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
