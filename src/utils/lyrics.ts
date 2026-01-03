import { Lyrics, LyricLine, Track } from '../types';
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

      if (text) { // Filter out empty lines if desired, or keep them for spacing
        lines.push({ time: totalSeconds, text });
      }
    }
  });

  return lines;
};

export const fetchLyrics = async (track: Track): Promise<Lyrics> => {
  // 0. Check if we already have lyrics stored in the track object
  if (track.lyrics && !track.lyrics.error) {
      return track.lyrics;
  }

  const { title, artist } = track;

  try {
    let result: Lyrics = { lines: [], synced: false, error: true };

    // 1. Try lrclib.net for synced lyrics
    const lrcUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    try {
        const lrcRes = await fetch(lrcUrl);
        if (lrcRes.ok) {
            const data = await lrcRes.json();
            if (data.syncedLyrics) {
                const lines = parseLrc(data.syncedLyrics);
                if (lines.length > 0) {
                    result = { lines, synced: true, plain: data.plainLyrics };
                }
            } else if (data.plainLyrics) {
                result = { lines: [], synced: false, plain: data.plainLyrics };
            }
        }
    } catch (e) {
        console.warn("Lrclib fetch failed", e);
    }

    // 2. Fallback to api.popcat.xyz if no result yet
    if (result.error) {
        const backupUrl = `https://api.popcat.xyz/v2/lyrics?song=${encodeURIComponent(title + " " + artist)}`;
        try {
            const backupRes = await fetch(backupUrl);
            if (backupRes.ok) {
                const data = await backupRes.json();
                if (data.lyrics) {
                    result = { lines: [], synced: false, plain: data.lyrics };
                }
            }
        } catch (e) {
            console.warn("Popcat fetch failed", e);
        }
    }

    // 3. Save to DB if we found something
    if (!result.error) {
        const updatedTrack = { ...track, lyrics: result };
        await dbService.saveTrack(updatedTrack);
        return result;
    }

    return result;
  } catch (e) {
    console.error("Lyrics fetch failed:", e);
    return { lines: [], synced: false, error: true };
  }
};
