import { Track, Lyrics, LyricLine, LyricWord } from '../types';
import { dbService } from '../db';

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
    // We split by the tag, capturing the tag itself.
    // Example: "Word <00:01> Two" -> ["Word ", "<00:01>", " Two"]
    const parts = content.split(/(<\d{1,2}:\d{2}\.\d{1,3}>)/);
    const words: LyricWord[] = [];
    let currentTime = lineTime;

    parts.forEach((part) => {
        if (!part) return; // Skip empty strings from split

        if (part.startsWith('<') && part.endsWith('>')) {
            // It's likely a tag
            const timeStr = part.slice(1, -1);
            const t = parseTime(timeStr);
            if (t !== null) {
                currentTime = t;
                return;
            }
        }

        // It's text
        const text = part.trim();
        if (text) {
            words.push({ time: currentTime, text });
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
    if (!parsed?.lines || !Array.isArray(parsed.lines)) {
      console.warn('Gemini returned junk – keeping original synced lyrics');
      return null;
    }

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

export const fetchLyrics = async (track: Track, force = false): Promise<Lyrics> => {
  // 1. Check DB / Settings
  const wordSyncEnabled = await dbService.getSetting<boolean>('wordSyncEnabled');
  const geminiApiKey = await dbService.getSetting<string>('geminiApiKey');

  // 2. Return Cached if valid
  if (!force && track.lyrics && !track.lyrics.error) {
    if (track.lyrics.isWordSynced) return track.lyrics;
    if (!wordSyncEnabled) return track.lyrics;
    // If here: we have non-word-synced lyrics, and user wants word-synced.
    // We proceed to see if we can enhance them or find better ones.
  }

  let bestResult: Lyrics = { lines: [], synced: false, error: true };
  let rawData: { synced?: string; plain?: string } | null = null;

  // 3. Strategy A: LRCLIB (Best Free Source)
  // New: If word sync is enabled, first try to search specifically for word-synced lyrics
  if (wordSyncEnabled) {
    try {
      const searchUrl = new URL('https://lrclib.net/api/search');
      searchUrl.searchParams.append('q', `${track.artist} ${track.title}`);
      
      const res = await fetch(searchUrl.toString());
      if (res.ok) {
        const searchData = await res.json();
        if (Array.isArray(searchData)) {
           // Filter candidates: must match duration within 15 seconds (increased tolerance)
           const candidates = searchData.filter((item: any) => 
             Math.abs(item.duration - track.duration) < 15
           );

           // Prioritize: Find first candidate with word-level timestamps (A-LRC format)
           const wordSyncedItem = candidates.find((item: any) => 
             item.syncedLyrics && /<\d{2}:\d{2}\.\d{2,3}>/.test(item.syncedLyrics)
           );

           if (wordSyncedItem) {
             const parsed = parseLrc(wordSyncedItem.syncedLyrics);
             if (parsed.isWordSynced) {
               // Found a word-synced version!
               bestResult = { ...parsed, plain: wordSyncedItem.plainLyrics };
               rawData = { synced: wordSyncedItem.syncedLyrics, plain: wordSyncedItem.plainLyrics };
             }
           }
        }
      }
    } catch (e) {
      console.warn('LRCLIB Search failed', e);
    }
  }

  // If search didn't yield a word-synced result (or wasn't performed), try the standard /get endpoint
  if (!bestResult.isWordSynced) {
    try {
      const url = new URL('https://lrclib.net/api/get');
      url.searchParams.append('artist_name', track.artist);
      url.searchParams.append('track_name', track.title);
      url.searchParams.append('album_name', track.album || '');
      url.searchParams.append('duration', track.duration.toString());

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        // Only override if we don't have a valid result yet
        if (data.syncedLyrics) {
          const parsed = parseLrc(data.syncedLyrics);
           // If we somehow found word synced here, great. If not, we take line synced.
           // Note: if our search step failed to find word sync, this probably returns line sync.
           // But we should take it as it's the "best match" found by the API.
           if (!bestResult.synced || parsed.isWordSynced) {
             bestResult = { ...parsed, plain: data.plainLyrics };
             rawData = { synced: data.syncedLyrics, plain: data.plainLyrics };
           }
        } else if (data.plainLyrics && !bestResult.synced) {
          bestResult = { lines: [], synced: false, plain: data.plainLyrics, error: false };
          rawData = { plain: data.plainLyrics };
        }
      }
    } catch (e) {
      console.warn('LRCLIB fetch failed', e);
    }
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
  // If we have content, but no word-sync, and the user wants it, and has a key...
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

  // Fallback: If we failed to find better lyrics, but we had valid cached ones, return them!
  if (track.lyrics && !track.lyrics.error) {
    return track.lyrics;
  }

  return { lines: [], synced: false, error: true };
};
