import { Track, Lyrics, LyricLine, LyricWord } from '../types';
import { dbService } from '../db'; // Assuming this exists in your project

// --- HELPERS ---

// Parse "mm:ss.xx" into seconds (number)
const parseTime = (timeStr: string): number | null => {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;

  const min = parseInt(match[1], 10);
  const sec = parseInt(match[2], 10);
  const msPart = match[3];

  let ms = 0;
  if (msPart) {
    // Handle .1 vs .01 vs .001 correctly
    const divisor = Math.pow(10, msPart.length);
    ms = parseInt(msPart, 10) / divisor;
  }

  return min * 60 + sec + ms;
};

// Robust JSON extraction from AI chatter
const extractJSON = (text: string): any | null => {
  try {
    // Attempt direct parse
    return JSON.parse(text);
  } catch {
    // Attempt to find JSON block ```json ... ``` or just { ... }
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

// --- PARSER ---

export const parseLrc = (lrc: string): Lyrics => {
  const lines: LyricLine[] = [];
  const lineRegex = /^\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\](.*)$/;
  const wordTagRegex = /(<\d{1,2}:\d{2}\.\d{1,3}>)/;

  lrc.split(/\r?\n/).forEach((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    // 1. Parse Line Time [mm:ss.xx]
    const match = trimmed.match(lineRegex);
    if (!match) return;

    const lineTime = parseTime(match[1]);
    if (lineTime === null) return;

    const content = match[2].trim();
    
    // 2. Parse Word Tags <mm:ss.xx>
    // Split by the tag regex to get alternating [text, tag, text, tag...]
    const parts = content.split(wordTagRegex);
    const words: LyricWord[] = [];
    let currentTime = lineTime;

    parts.forEach((part) => {
      if (wordTagRegex.test(part)) {
        // It's a time tag, update current time pointer
        const t = parseTime(part.slice(1, -1));
        if (t !== null) currentTime = t;
      } else {
        // It's text
        const text = part.trim();
        if (text) {
          words.push({ time: currentTime, text });
        }
      }
    });

    // 3. Construct Line
    if (words.length > 0) {
      lines.push({
        time: lineTime,
        text: words.map((w) => w.text).join(' '),
        words,
      });
    } else if (content) {
      lines.push({
        time: lineTime,
        text: content,
      });
    }
  });

  const sortedLines = lines.sort((a, b) => a.time - b.time);
  const isWordSynced = sortedLines.some((l) => l.words && l.words.length > 1);

  return {
    lines: sortedLines,
    synced: true,
    isWordSynced,
    error: false,
  };
};

// --- GEMINI ENHANCER ---

const getGeminiLyrics = async (
  track: Track,
  apiKey: string,
  context: { synced?: string; plain?: string }
): Promise<Lyrics | null> => {
  const prompt = `
    Task: Generate precise word-level synced lyrics (Karaoke style).
    Song: "${track.title}" by "${track.artist}"
    Duration: ${track.duration}s
    
    Instructions:
    1. Output strictly valid JSON.
    2. Do NOT change the lyrics text provided below.
    3. Estimate natural timing for each word based on the song structure.
    4. Format: { "lines": [ { "time": number (seconds), "text": string, "words": [ { "time": number, "text": string } ] } ] }

    Input Data:
    ${context.synced ? `Reference LRC:\n${context.synced}` : `Lyrics Text:\n${context.plain}`}
  `;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!res.ok) throw new Error(`Gemini API Error: ${res.status}`);
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) return null;

    const parsed = extractJSON(rawText);
    if (!parsed?.lines || !Array.isArray(parsed.lines)) return null;

    return {
      lines: parsed.lines,
      synced: true,
      isWordSynced: true,
      error: false,
    };
  } catch (e) {
    console.warn('Gemini Sync Generation failed:', e);
    return null;
  }
};

// --- MAIN FETCH STRATEGY ---

export const fetchLyrics = async (track: Track): Promise<Lyrics> => {
  // 1. Check DB / Settings
  const wordSyncEnabled = await dbService.getSetting<boolean>('wordSyncEnabled');
  const geminiApiKey = await dbService.getSetting<string>('geminiApiKey');

  // 2. Return Cached if valid
  if (track.lyrics && !track.lyrics.error) {
    if (track.lyrics.isWordSynced) return track.lyrics;
    // If we have synced lines but user doesn't want word-sync, return existing
    if (track.lyrics.synced && !wordSyncEnabled) return track.lyrics;
  }

  let bestResult: Lyrics = { lines: [], synced: false, error: true };
  let rawData: { synced?: string; plain?: string } | null = null;

  // 3. Strategy A: LRCLIB (Best Free Source)
  try {
    const url = new URL('https://lrclib.net/api/get');
    url.searchParams.append('artist_name', track.artist);
    url.searchParams.append('track_name', track.title);
    url.searchParams.append('album_name', track.album || '');
    url.searchParams.append('duration', track.duration.toString());

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        const parsed = parseLrc(data.syncedLyrics);
        bestResult = { ...parsed, plain: data.plainLyrics };
        rawData = { synced: data.syncedLyrics, plain: data.plainLyrics };
      } else if (data.plainLyrics) {
        bestResult = { lines: [], synced: false, plain: data.plainLyrics, error: false };
        rawData = { plain: data.plainLyrics };
      }
    }
  } catch (e) {
    console.warn('LRCLIB fetch failed', e);
  }

  // 4. Strategy B: Popcat (Fallback for plain text)
  if (bestResult.error && !bestResult.plain) {
    try {
      const res = await fetch(`https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(`${track.title} ${track.artist}`)}`);
      const data = await res.json();
      if (data.lyrics) {
        bestResult = { lines: [], synced: false, plain: data.lyrics, error: false };
        rawData = { plain: data.lyrics };
      }
    } catch (e) {
      console.warn('Popcat fetch failed', e);
    }
  }

  // 5. Strategy C: Gemini Enhancement (The "Magic" Step)
  // If we have content, but no word-sync, and the user wants it...
  if (wordSyncEnabled && geminiApiKey && rawData && !bestResult.isWordSynced) {
    const enhanced = await getGeminiLyrics(track, geminiApiKey, rawData);
    if (enhanced) {
      const finalLyrics = { ...enhanced, plain: bestResult.plain };
      await dbService.saveTrack({ ...track, lyrics: finalLyrics });
      return finalLyrics;
    }
  }

  // 6. Final Save & Return
  if (!bestResult.error) {
    await dbService.saveTrack({ ...track, lyrics: bestResult });
    return bestResult;
  }

  return { lines: [], synced: false, error: true };
};
