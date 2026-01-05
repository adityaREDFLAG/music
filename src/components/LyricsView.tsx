import { Lyrics, LyricLine, Track, LyricWord } from '../types';
import { dbService } from '../db';

//smth..
export const parseLrc = (lrc: string): LyricLine[] => {
  const lines: LyricLine[] = [];
  const lineRegex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/;

  lrc.split('\n').forEach(lineStr => {
    const trimmed = lineStr.trim();
    if (!trimmed) return;

    const match = trimmed.match(lineRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3], 10);
      const msDivisor = match[3].length === 3 ? 1000 : 100;
      const startTime = minutes * 60 + seconds + milliseconds / msDivisor;

      let rawText = match[4].trim();

      // Check for enhanced lyrics timestamps: <mm:ss.xx>
      // Example: "I <00:12.50> love <00:13.00> you"
      // Note: The first word's time usually matches the line time, but enhanced lyrics might explicit it or omit it.
      // Common format: [time] word <time> word <time> ...

      // We will look for <mm:ss.xx> patterns.
      const wordTimestampRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>/g;
      const hasWordTimestamps = wordTimestampRegex.test(rawText);

      if (hasWordTimestamps) {
        const words: LyricWord[] = [];
        // Split by timestamp to get words and times
        // Strategy: iterate through the string and extract time-word pairs.

        // This is tricky because the format can vary.
        // Format A: [start] Word <time> Word <time> Word...
        // Format B: [start] <start> Word <time> Word...

        // Let's preserve the original text for the line, but strip timestamps
        const cleanText = rawText.replace(wordTimestampRegex, '').replace(/\s+/g, ' ').trim();

        // Now extract words with their times.
        // We start with the line start time.
        let currentTime = startTime;
        let lastIndex = 0;

        // Reset regex
        wordTimestampRegex.lastIndex = 0;
        let wordMatch;

        // This simple splitting might fail if words are complex.
        // Let's use a split approach.
        const parts = rawText.split(wordTimestampRegex);
        // If rawText is "Word1 <00:01.00> Word2", split gives ["Word1 ", "00", "01", "00", " Word2"] if using capturing groups
        // Capturing groups are (mm), (ss), (ms).

        // A better way: match all occurrences of <time> or text segments.
        // But let's look at how most A-LRC are structured.
        // Usually: Word <time> Word <time>
        // The first word starts at `startTime`.
        // The timestamp <T> indicates the start of the *next* word usually, or end of previous?
        // Actually, A-LRC spec says <time> is the start time of the word following it? Or preceding?
        // Actually, in Karaoke LRC: "Word <time> Word" -> "Word" is sung until <time>.
        // BUT in some formats (like Spotify/Musixmatch), it is "Word <time> Word" where <time> is start of 2nd word?

        // Let's assume standard Enhanced LRC:
        // [mm:ss.xx] <mm:ss.xx> Word <mm:ss.xx> Word
        // Or
        // [mm:ss.xx] Word <mm:ss.xx> Word

        // Let's treat it as:
        // Any text BEFORE the first <timestamp> belongs to `startTime`.
        // Text AFTER <timestamp> belongs to that timestamp.

        // We can split by `<` which starts a tag.

        const segments = rawText.split('<');
        // Example: "Word1 <00:12.50> Word2" -> ["Word1 ", "00:12.50> Word2"]
        // Example: "<00:12.00> Word1 <00:12.50> Word2" -> ["", "00:12.00> Word1 ", "00:12.50> Word2"]

        segments.forEach((seg, index) => {
            if (index === 0) {
                // Text before any <time> tag
                const w = seg.trim();
                if (w) {
                    words.push({ time: startTime, text: w });
                }
            } else {
                // Starts with timestamp like "00:12.50> Word..."
                const closeIndex = seg.indexOf('>');
                if (closeIndex !== -1) {
                    const timeStr = seg.substring(0, closeIndex); // "00:12.50"
                    const content = seg.substring(closeIndex + 1).trim(); // " Word..."

                    const tm = timeStr.match(/^(\d{2}):(\d{2})\.(\d{2,3})$/);
                    if (tm) {
                        const m = parseInt(tm[1], 10);
                        const s = parseInt(tm[2], 10);
                        const msVal = parseInt(tm[3], 10);
                        const div = tm[3].length === 3 ? 1000 : 100;
                        const t = m * 60 + s + msVal / div;

                        if (content) {
                            words.push({ time: t, text: content });
                        }
                    } else {
                         // Fallback if bad timestamp, append to previous word or ignore?
                         // Just append as text to previous word if exists
                         if (words.length > 0 && content) {
                             words[words.length - 1].text += " " + content;
                         }
                    }
                }
            }
        });

        // If we found words, use them
        if (words.length > 0) {
            lines.push({ time: startTime, text: cleanText, words });
        } else {
             lines.push({ time: startTime, text: cleanText });
        }

      } else {
        // Standard line
        if (rawText) {
          lines.push({ time: startTime, text: rawText });
        }
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
        Return ONLY the raw JSON string. No markdown code blocks.`;
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
        Return ONLY the raw JSON string. No markdown code blocks.`;
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
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1, // Low temp for deterministic format
                    responseMimeType: "application/json" // Force JSON output
                }
            })
        });

        if (!response.ok) {
            console.warn("Gemini API error:", response.statusText);
            return null;
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) return null;

        // --- ROBUST JSON PARSING ---
        let parsed: any = null;
        try {
            // 1. Try parsing directly
            parsed = JSON.parse(text);
        } catch (e) {
            // 2. Fallback: Clean markdown wrappers if direct parse fails
            // This handles ```json ... ``` and just ``` ... ```
            const cleanText = text
                .replace(/^```json\s*/, '')
                .replace(/^```\s*/, '')
                .replace(/\s*```$/, '')
                .trim();
            
            try {
                parsed = JSON.parse(cleanText);
            } catch (innerE) {
                console.warn("Failed to parse Gemini JSON:", innerE);
                return null;
            }
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
      if (wordSyncEnabled && track.lyrics.isWordSynced) {
          return track.lyrics;
      }
      // If we don't need word sync, or don't have a key, line sync is fine
      if (!wordSyncEnabled || !geminiApiKey) {
          // Check if we have synced lyrics at all
          if (track.lyrics.synced) return track.lyrics;
      }
  }

  let lrcData: { synced?: string, plain?: string } | null = null;
  let standardResult: Lyrics = { lines: [], synced: false, error: true };

  // 2. Try to fetch reliable lyrics from Lrclib (First Priority)
  const lrcUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
  try {
      const lrcRes = await fetch(lrcUrl);
      if (lrcRes.ok) {
          const data = await lrcRes.json();
          if (data.syncedLyrics) {
              lrcData = { synced: data.syncedLyrics, plain: data.plainLyrics };

              // Parse using enhanced parser
              const parsedLines = parseLrc(data.syncedLyrics);
              const hasWordSync = parsedLines.some(l => l.words && l.words.length > 0);

              standardResult = {
                  lines: parsedLines,
                  synced: true,
                  isWordSynced: hasWordSync,
                  plain: data.plainLyrics,
                  error: false
              };
          } else if (data.plainLyrics) {
              lrcData = { plain: data.plainLyrics };
              standardResult = {
                  lines: [],
                  synced: false,
                  plain: data.plainLyrics,
                  error: false
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
                      plain: data.lyrics,
                      error: false
                  };
              }
          }
      } catch (e) {
          console.warn("Popcat fetch failed", e);
      }
  }

  // 4. Upgrade with Gemini if enabled
  // ONLY if standard result is NOT word synced already
  if (wordSyncEnabled && geminiApiKey && !standardResult.isWordSynced) {
      const geminiLyrics = await getGeminiLyrics(track, geminiApiKey, lrcData || undefined);
      if (geminiLyrics) {
          const updatedTrack = { ...track, lyrics: geminiLyrics };
          await dbService.saveTrack(updatedTrack);
          return geminiLyrics;
      }
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
