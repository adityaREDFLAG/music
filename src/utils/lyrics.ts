import { Lyrics, LyricLine, Track, LyricWord } from '../types';
import { dbService } from '../db';

// --- Helpers ---

/**
 * Parses time string (mm:ss.xx or mm:ss) into seconds.
 * Handles flexible milliseconds lengths (1, 2 or 3 digits).
 */
const parseTime = (timeStr: string): number | null => {
  // FIXED: Changed \d{2,3} to \d{1,3} to handle [00:12.5] (1 digit ms)
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;

  const min = parseInt(match[1], 10);
  const sec = parseInt(match[2], 10);
  const msPart = match[3];

  let ms = 0;
  if (msPart) {
    // FIXED: Robust logic for .5 vs .50 vs .500
    // If string is "5", it means 500ms (0.5s), not 5ms (0.005s) usually in LRC
    // But standard calculation is usually: value / (10^length)
    const divisor = Math.pow(10, msPart.length);
    ms = parseInt(msPart, 10) / divisor;
  }

  return min * 60 + sec + ms;
};

/**
 * Aggressively extracts the first valid JSON object from a string.
 * Handles Markdown blocks, preambles, and trailing text.
 */
const extractJSON = (text: string): any | null => {
  try {
    // 1. Fast path: Is it already pure JSON?
    return JSON.parse(text);
  } catch {
    // 2. Regex to find the first '{' and the last '}'
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

// --- Core Logic ---

/**
 * Robust LRC Parser.
 * Handles:
 * - Standard: [mm:ss.xx] Line content
 * - Enhanced A: [mm:ss.xx] <mm:ss.xx> Word <mm:ss.xx> Word
 * - Enhanced B: [mm:ss.xx] Word <mm:ss.xx> Word
 */
export const parseLrc = (lrc: string): LyricLine[] => {
  const lines: LyricLine[] = [];
  // FIXED: Relaxed regex for ms part to (\.\d{1,3})?
  const lineRegex = /^\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\](.*)$/;
  const wordTimeRegex = /(<\d{1,2}:\d{2}\.\d{1,3}>)/; 

  lrc.split(/\r?\n/).forEach(lineStr => {
    const trimmed = lineStr.trim();
    if (!trimmed) return;

    const match = trimmed.match(lineRegex);
    if (!match) return; // Skip non-lyric lines (metadata)

    const lineStartTime = parseTime(match[1]);
    if (lineStartTime === null) return;

    const rawContent = match[2].trim();

    // Strategy: Split by the timestamp regex.
    // Since regex has capturing group (), split will include the separators in the result array.
    // "Word <00:01> Word2" -> ["Word ", "<00:01>", " Word2"]
    const parts = rawContent.split(wordTimeRegex);
    
    const words: LyricWord[] = [];
    let currentWordTime = lineStartTime;

    parts.forEach(part => {
      // Check if this part is a timestamp tag
      if (wordTimeRegex.test(part)) {
        // Remove < and > and parse
        const t = parseTime(part.slice(1, -1));
        if (t !== null) currentWordTime = t;
      } else {
        // It's text
        const text = part.trim();
        if (text) {
          words.push({ time: currentWordTime, text });
        }
      }
    });

    // If we detected word-level sync, add it.
    if (words.length > 0) {
      lines.push({ 
        time: lineStartTime, 
        text: words.map(w => w.text).join(' '), 
        words 
      });
    } else {
      // Standard line
      if (rawContent) {
        lines.push({ time: lineStartTime, text: rawContent });
      }
    }
  });

  // FIXED: Sort lines by time to ensure binary search or findIndex works correctly
  return lines.sort((a, b) => a.time - b.time);
};

/**
 * Interfaces with Gemini to upgrade lyrics to word-level sync.
 */
const getGeminiLyrics = async (
  track: Track,
  apiKey: string,
  context: { synced?: string, plain?: string }
): Promise<Lyrics | null> => {
  const { title, artist } = track;
  let promptParts: string[] = [];

  // Construct Prompt based on available data
  if (context.synced) {
    promptParts = [
      `Task: Convert line-synced LRC to word-synced JSON.`,
      `Song: "${title}" by "${artist}".`,
      `Instructions:`,
      `1. Keep the existing line timestamps EXACTLY as provided.`,
      `2. Interpolate timestamps for individual words based on natural rhythm.`,
      `3. Do NOT change any words or punctuation.`,
      `Input LRC:`,
      context.synced
    ];
  } else {
    promptParts = [
      `Task: Generate word-synced lyrics JSON.`,
      `Song: "${title}" by "${artist}".`,
      `Instructions: Estimate timestamps for every word.`,
      `Lyrics:`,
      context.plain || ""
    ];
  }

  // Common Schema Instruction
  promptParts.push(`
    Output Format: return ONLY valid JSON. Structure:
    {
      "lines": [
        {
          "time": number (seconds),
          "text": string,
          "words": [{ "time": number (seconds), "text": string }]
        }
      ]
    }
  `);

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptParts.join('\n') }] }],
        generationConfig: {
          temperature: 0.2, // Low temp for stability
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) throw new Error(`Gemini API: ${response.statusText}`);

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) return null;

    const parsed = extractJSON(rawText);

    if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
       // Sanity Check: If we had original lines, did we lose too many?
       // (Optional: Compare lengths if context.synced existed)
       return {
           lines: parsed.lines,
           synced: true,
           isWordSynced: true,
           error: false
       };
    }
  } catch (e) {
    console.warn("Gemini sync failed:", e);
  }
  return null;
};

export const fetchLyrics = async (track: Track): Promise<Lyrics> => {
  const { title, artist } = track;
  const wordSyncEnabled = await dbService.getSetting<boolean>('wordSyncEnabled');
  const geminiApiKey = await dbService.getSetting<string>('geminiApiKey');

  // 1. Check existing (DB) lyrics
  // If we already have word-sync (and want it), or have line-sync (and don't want word-sync), return early.
  if (track.lyrics && !track.lyrics.error) {
     const hasWordSync = track.lyrics.isWordSynced;
     if (hasWordSync) return track.lyrics; 
     if (track.lyrics.synced && !wordSyncEnabled) return track.lyrics;
  }

  // Container for whatever we find
  let bestAvailable: Lyrics = { lines: [], synced: false, error: true };
  let rawForEnhancement: { synced?: string, plain?: string } | null = null;

  // 2. Try Lrclib (High Quality, often Synced)
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      
      if (data.syncedLyrics) {
        const lines = parseLrc(data.syncedLyrics);
        // Check if Lrclib actually gave us Enhanced LRC directly (rare but possible)
        const isWordSynced = lines.some(l => l.words && l.words.length > 0);
        
        bestAvailable = { 
          lines, 
          synced: true, 
          isWordSynced, 
          plain: data.plainLyrics,
          error: false 
        };
        rawForEnhancement = { synced: data.syncedLyrics, plain: data.plainLyrics };
      } else if (data.plainLyrics) {
        // We only found plain text
        bestAvailable = { ...bestAvailable, plain: data.plainLyrics, error: false };
        rawForEnhancement = { plain: data.plainLyrics };
      }
    }
  } catch (e) { console.warn("Lrclib error", e); }

  // 3. Fallback to Popcat (Good for Plain Text)
  // Only search if we found nothing, or if we want to sync but only found plain text so far
  if (bestAvailable.error || (!bestAvailable.synced && !rawForEnhancement?.plain)) {
     try {
       const url = `https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(title + " " + artist)}`;
       const res = await fetch(url);
       const data = await res.json();
       if (data.lyrics) {
         bestAvailable = { lines: [], synced: false, plain: data.lyrics, error: false };
         rawForEnhancement = { plain: data.lyrics };
       }
     } catch (e) { console.warn("Popcat error", e); }
  }

  // 4. AI Enhancement (Gemini)
  // Trigger if: User wants word sync + We have an API key + We have SOME lyrics + Result isn't already word synced
  if (wordSyncEnabled && geminiApiKey && rawForEnhancement && !bestAvailable.isWordSynced) {
    const enhanced = await getGeminiLyrics(track, geminiApiKey, rawForEnhancement);
    if (enhanced) {
      const newLyrics = { ...enhanced, plain: bestAvailable.plain };
      await dbService.saveTrack({ ...track, lyrics: newLyrics });
      return newLyrics;
    }
  }

  // 5. Final Save & Return
  if (!bestAvailable.error) {
    await dbService.saveTrack({ ...track, lyrics: bestAvailable });
    return bestAvailable;
  }

  return { lines: [], synced: false, error: true };
};
