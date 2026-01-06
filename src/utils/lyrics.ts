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

/**
 * Extracts JSON from AI strings, handling markdown blocks or raw text.
 */
const extractJSON = (text: string): any | null => {
  try {
    // Finds { ... } or [ ... ]
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON Extraction failed", e);
    return null;
  }
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
    const words: LyricWord[] = [];
    let currentTime = lineTime;

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
        // (This prevents the last word from highlighting forever)
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

    if (words.length > 0) {
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

// --- GEMINI ENHANCER ---

const getGeminiLyrics = async (
  track: Track,
  apiKey: string,
  context: { synced?: string; plain?: string }
): Promise<Lyrics | null> => {
  // CLEANING: Remove existing time tags to avoid confusing the AI
  const cleanInput = (context.plain || (context.synced || ''))
    .replace(/[\[<]\d{1,2}:\d{2}(?:\.\d{1,3})?[\]>]/g, '')
    .trim();

  // Updated Prompt: Ask for a NESTED structure (Lines -> Words)
  // This prevents the "desync" issue where one extra word breaks the whole song.
  const prompt = `
  System: You are a karaoke engine.
  Task: Return a JSON object containing the lyrics synced word-by-word.
  
  Instructions:
  1. The "input_text" is the reference. Do not add or remove lines.
  2. "start" and "end" must be in seconds (number).
  3. Ensure "text" in the output matches the input.
  
  Output Schema:
  {
    "karaokeLines": [
      {
        "text": "Full line text here",
        "time": 10.5,
        "words": [
          { "text": "Full", "start": 10.5, "end": 10.8 },
          { "text": "line", "start": 10.8, "end": 11.2 },
          ...
        ]
      }
    ]
  }
  
  Song: "${track.title}"
  Duration: ${track.duration}s
  Input Text:
  ${cleanInput}
  `;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.2, 
            responseMimeType: 'application/json' 
          },
        }),
      }
    );

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = extractJSON(rawText);

    // Validate structure
    if (parsed && Array.isArray(parsed.karaokeLines)) {
      const lines: LyricLine[] = parsed.karaokeLines.map((line: any) => ({
        time: line.time || line.words?.[0]?.start || 0,
        text: line.text,
        words: line.words.map((w: any) => ({
          text: w.text,
          time: w.start,
          endTime: w.end
        }))
      }));

      return { 
        lines, 
        synced: true, 
        isWordSynced: true, 
        error: false 
      };
    }
    
    return null;
  } catch (e) {
    console.error('Gemini Sync failed:', e);
    return null;
  }
};

// --- MAIN FETCH STRATEGY ---

export const fetchLyrics = async (track: Track, force = false, forceAISync = false): Promise<Lyrics> => {
  const wordSyncEnabled = await dbService.getSetting<boolean>('wordSyncEnabled');
  const geminiApiKey = await dbService.getSetting<string>('geminiApiKey');

  // Decide if we should try AI sync (if enabled or forced, AND key is present)
  const shouldTryAISync = (wordSyncEnabled || forceAISync) && !!geminiApiKey;

  // Return cache if valid
  // If force is true, we bypass cache.
  if (!force && track.lyrics && !track.lyrics.error) {
    // If we want AI sync but don't have it, don't return cache
    // Otherwise return cache
    if (track.lyrics.isWordSynced || !shouldTryAISync) return track.lyrics;
  }

  let bestResult: Lyrics = { lines: [], synced: false, error: true };
  let rawData: { synced?: string; plain?: string } | null = null;

  // 1. Try LRCLIB
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist)}&track_name=${encodeURIComponent(track.title)}&duration=${track.duration}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        bestResult = parseLrc(data.syncedLyrics);
        rawData = { synced: data.syncedLyrics, plain: data.plainLyrics };
      } else if (data.plainLyrics) {
        bestResult = { lines: [], synced: false, plain: data.plainLyrics, error: false };
        rawData = { plain: data.plainLyrics };
      }
    }
  } catch (e) {
    console.warn('LRCLIB failed', e);
  }

  // FALLBACK: If LRCLIB failed (or returned no lyrics) but we have cached lyrics, use them as base
  // This is crucial for "Sync with AI" on existing lyrics when LRCLIB is down or fails
  if ((!rawData || (!rawData.synced && !rawData.plain)) && track.lyrics && !track.lyrics.error) {
     console.log("LRCLIB failed or empty, falling back to cached lyrics for AI sync base.");
     bestResult = track.lyrics;

     // We need to reconstruct rawData for the AI
     // Preference: plain text from lines, or the plain field if available
     const plainText = track.lyrics.plain || track.lyrics.lines.map(l => l.text).join('\n');
     rawData = { plain: plainText };
  }

  // 2. Gemini Enhancement if word sync is missing
  // If forceAISync is true, we attempt it even if bestResult thinks it is word synced?
  // Usually we only need to enhance if NOT word synced.
  // But if the user clicks "Sync with AI", maybe the current word sync is bad or they want to re-run it.
  // So we allow re-running if forceAISync is set.
  if (shouldTryAISync && rawData && (!bestResult.isWordSynced || forceAISync)) {
    console.log("Enhancing lyrics with Gemini...");
    const enhanced = await getGeminiLyrics(track, geminiApiKey, rawData);
    if (enhanced) {
      bestResult = { ...enhanced, plain: rawData.plain || rawData.synced };
    }
  }

  if (!bestResult.error) {
    await dbService.saveTrack({ ...track, lyrics: bestResult });
  }

  return bestResult;
};
