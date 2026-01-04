import { Lyrics, LyricLine, Track, LyricWord } from '../types';
import { dbService } from '../db';

/**
 * Parses LRC format: [mm:ss.xx] Lyrics
 */
const parseLrc = (lrc: string): LyricLine[] => {
  const lines: LyricLine[] = [];
  const regex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;

  lrc.split('\n').forEach(line => {
    const trimmed = line.trim();
    const match = trimmed.match(regex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3], 10);
      // Determine if milliseconds are 2 or 3 digits
      const msDivisor = match[3].length === 3 ? 1000 : 100;
      const totalSeconds = minutes * 60 + seconds + milliseconds / msDivisor;
      const text = match[4].trim();

      if (text) {
        lines.push({ time: totalSeconds, text });
      }
    }
  });

  return lines;
};

/**
 * Helper to get lyrics from Gemini.
 * It can generate from scratch OR enhance existing lyrics if provided.
 */
const getGeminiLyrics = async (
  track: Track,
  apiKey: string,
  context?: { synced?: string, plain?: string }
): Promise<Lyrics | null> => {
    const { title, artist } = track;

    let prompt = "";

    if (context?.synced) {
        // SCENARIO 1: Enhance existing LRC (Best Case)
        prompt = `I have the following line-synced lyrics for "${title}" by "${artist}".
        Please convert them into a JSON format with word-level synchronization.

        CRITICAL INSTRUCTIONS:
        1. Use the provided line timestamps as STRICT constraints. The first word of a line MUST start at the line's timestamp.
        2. Interpolate the timestamps for the remaining words in the line based on the natural rhythm of the song.
        3. Do NOT change the text content. Use the provided text exactly.

        Input LRC:
        ${context.synced}

        Output JSON structure:
        {
          "lines": [
            {
              "time": <line_start_time>,
              "text": "<line_text>",
              "words": [
                { "time": <word_time>, "text": "<word>" },
                ...
              ]
            }
          ]
        }
        Return ONLY the raw JSON string. No markdown.`;
    } else if (context?.plain) {
        // SCENARIO 2: Sync plain text (Good Case)
        prompt = `I have the lyrics for "${title}" by "${artist}".
        Please generate word-level synchronization timestamps for them.

        Lyrics:
        ${context.plain}

        Output JSON structure:
        {
          "lines": [
            {
              "time": <line_start_time>,
              "text": "<line_text>",
              "words": [
                { "time": <word_time>, "text": "<word>" },
                ...
              ]
            }
          ]
        }
        Return ONLY the raw JSON string. No markdown.`;
    } else {
        // SCENARIO 3: Generate from scratch (Fallback)
        prompt = `Generate word-for-word synced lyrics for the song "${title}" by "${artist}".
        Format the output strictly as a JSON object with this structure:
        {
          "lines": [
            {
              "time": <start_time_seconds>,
              "text": "<line_text>",
              "words": [
                { "time": <word_time_seconds>, "text": "<word>" },
                ...
              ]
            }
          ]
        }
        The "time" for the line should be the start time of the first word.
        Ensure strict JSON validity. Return ONLY the raw JSON string.`;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            console.warn("Gemini API error:", response.statusText);
            return null;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return null;

        // Robust JSON parsing
        let parsed: any = null;
        try {
            // 1. Try regex to find the JSON object (first { to last })
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                // 2. Fallback: try cleaning markdown code blocks explicitly
                const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                parsed = JSON.parse(cleanJson);
            }
        } catch (e) {
             console.warn("Failed to parse Gemini JSON:", e);
             return null;
        }

        if (parsed && parsed.lines && Array.isArray(parsed.lines)) {
             return {
                 lines: parsed.lines,
                 synced: true,
                 isWordSynced: true,
                 error: false
             };
        }
    } catch (e) {
        console.warn("Gemini parsing/fetch failed", e);
    }
    return null;
};

export const fetchLyrics = async (track: Track): Promise<Lyrics> => {
  const wordSyncEnabled = await dbService.getSetting<boolean>('wordSyncEnabled');
  const geminiApiKey = await dbService.getSetting<string>('geminiApiKey');
  const { title, artist } = track;

  // 1. Check if existing lyrics in track are already good enough
  if (track.lyrics && !track.lyrics.error) {
      // If we want word sync, and we have it, return it.
      if (wordSyncEnabled && track.lyrics.isWordSynced) {
          return track.lyrics;
      }
      // If we don't care about word sync, or don't have a key, return what we have.
      if (!wordSyncEnabled || !geminiApiKey) {
          return track.lyrics;
      }
      // Otherwise, we proceed to try and upgrade them.
  }

  let lrcData: { synced?: string, plain?: string } | null = null;
  let standardResult: Lyrics = { lines: [], synced: false, error: true };

  // 2. Try to fetch reliable lyrics from Lrclib (First Priority)
  const lrcUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
  try {
      const lrcRes = await fetch(lrcUrl);
      if (lrcRes.ok) {
          const data = await lrcRes.json();
          // Prefer synced lyrics if available
          if (data.syncedLyrics) {
              lrcData = { synced: data.syncedLyrics, plain: data.plainLyrics };
              standardResult = {
                  lines: parseLrc(data.syncedLyrics),
                  synced: true,
                  plain: data.plainLyrics
              };
          } else if (data.plainLyrics) {
              lrcData = { plain: data.plainLyrics };
              standardResult = {
                  lines: [],
                  synced: false,
                  plain: data.plainLyrics
              };
          }
      }
  } catch (e) {
      console.warn("Lrclib fetch failed", e);
  }

  // 3. Fallback to Popcat if Lrclib failed
  if (!lrcData) {
      const backupUrl = `https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(title + " " + artist)}`;
      try {
          const backupRes = await fetch(backupUrl);
          if (backupRes.ok) {
              const data = await backupRes.json();
              if (data.lyrics) {
                  lrcData = { plain: data.lyrics };
                  standardResult = {
                      lines: [],
                      synced: false,
                      plain: data.lyrics
                  };
              }
          }
      } catch (e) {
          console.warn("Popcat fetch failed", e);
      }
  }

  // 4. Upgrade with Gemini if enabled
  if (wordSyncEnabled && geminiApiKey) {
      // Pass whatever context we found (or undefined if nothing found)
      const geminiLyrics = await getGeminiLyrics(track, geminiApiKey, lrcData || undefined);
      if (geminiLyrics) {
          // Success! Save and return
          const updatedTrack = { ...track, lyrics: geminiLyrics };
          await dbService.saveTrack(updatedTrack);
          return geminiLyrics;
      }
      // If Gemini failed, we fall back to standardResult below
  }

  // 5. Return standard result (Lrclib/Popcat)
  if (!standardResult.error) {
      const updatedTrack = { ...track, lyrics: standardResult };
      await dbService.saveTrack(updatedTrack);
      return standardResult;
  }

  // 6. Last resort: return whatever we had originally if it wasn't an error
  if (track.lyrics && !track.lyrics.error) {
      return track.lyrics;
  }

  return { lines: [], synced: false, error: true };
};
