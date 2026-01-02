import { Lyrics, LyricLine } from '../types';

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

      if (text) { // Filter out empty lines if desired, or keep them for spacing
        lines.push({ time: totalSeconds, text });
      }
    }
  });

  return lines;
};

export const fetchLyrics = async (title: string, artist: string): Promise<Lyrics> => {
  try {
    // 1. Try lrclib.net for synced lyrics
    const lrcUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    const lrcRes = await fetch(lrcUrl);

    if (lrcRes.ok) {
        const data = await lrcRes.json();
        if (data.syncedLyrics) {
            const lines = parseLrc(data.syncedLyrics);
            if (lines.length > 0) {
                return { lines, synced: true, plain: data.plainLyrics };
            }
        }
        if (data.plainLyrics) {
            return { lines: [], synced: false, plain: data.plainLyrics };
        }
    }

    // 2. Fallback to api.popcat.xyz (Plain text usually)
    const backupUrl = `https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(title + " " + artist)}`;
    const backupRes = await fetch(backupUrl);
    if (backupRes.ok) {
        const data = await backupRes.json();
        if (data.lyrics) {
             // popcat usually returns just text in "lyrics" field
             return { lines: [], synced: false, plain: data.lyrics };
        }
    }

    return { lines: [], synced: false, error: true };
  } catch (e) {
    console.error("Lyrics fetch failed:", e);
    return { lines: [], synced: false, error: true };
  }
};
