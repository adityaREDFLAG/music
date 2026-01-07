export interface YouTubeTrack {
  id: string;
  title: string;
  channel: string;
  duration: number; // in seconds
  thumbnail: string;
  url: string;
}

// List of Invidious instances with CORS enabled
// Ideally we would fetch this from api.invidious.io, but for simplicity/reliability we hardcode a known working one.
const INVIDIOUS_INSTANCES = [
    'https://inv.perditum.com',
    'https://invidious.nerdvpn.de', // fallback (check cors)
    'https://inv.nadeko.net' // fallback
];

let currentInstanceIndex = 0;

const BLACKLIST_KEYWORDS = ['review', 'reaction', 'podcast', 'tutorial', 'lesson', 'gameplay', 'walkthrough', 'unboxing'];

function isSong(track: YouTubeTrack): boolean {
    // Filter out Shorts (usually < 60s) and long mixes/podcasts (> 20 mins)
    if (track.duration < 60) return false;
    if (track.duration > 1200) return false;

    const lowerTitle = track.title.toLowerCase();

    // Check blacklist
    if (BLACKLIST_KEYWORDS.some(k => lowerTitle.includes(k))) return false;

    return true;
}

function calculateRelevance(track: YouTubeTrack): number {
    let score = 0;
    const lowerTitle = track.title.toLowerCase();
    const lowerChannel = track.channel.toLowerCase();

    // Official content boost
    if (lowerChannel.includes('topic')) score += 10;
    if (lowerChannel.includes('vevo')) score += 5;
    if (lowerTitle.includes('official audio')) score += 5;
    if (lowerTitle.includes('official video')) score += 3;
    if (lowerTitle.includes('lyric video') || lowerTitle.includes('lyrics')) score += 2;

    // Penalize potential non-music content that slipped through
    if (lowerTitle.includes('live') && !lowerTitle.includes('live at')) score -= 2;

    return score;
}

export async function searchYouTube(query: string): Promise<YouTubeTrack[]> {
  // Try up to 3 instances
  for (let i = 0; i < 3; i++) {
      const instance = INVIDIOUS_INSTANCES[(currentInstanceIndex + i) % INVIDIOUS_INSTANCES.length];
      try {
        const response = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
        if (!response.ok) throw new Error(`Search failed on ${instance}`);

        const data = await response.json();

        if (!Array.isArray(data)) return [];

        // Update successful index
        currentInstanceIndex = (currentInstanceIndex + i) % INVIDIOUS_INSTANCES.length;

        const tracks = data.map((item: any) => ({
            id: item.videoId,
            title: item.title,
            channel: item.author,
            duration: item.lengthSeconds,
            thumbnail: item.videoThumbnails?.find((t: any) => t.quality === 'medium' || t.quality === 'hqdefault')?.url || item.videoThumbnails?.[0]?.url,
            url: `https://www.youtube.com/watch?v=${item.videoId}`
        }));

        return tracks
            .filter(isSong)
            .sort((a: YouTubeTrack, b: YouTubeTrack) => calculateRelevance(b) - calculateRelevance(a));

      } catch (error) {
        console.warn(`YouTube search failed on ${instance}`, error);
        // Continue to next instance
      }
  }
  return [];
}

export function formatYouTubeArtwork(url: string): string {
    return url;
}

export function extractVideoId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^#&?]*).*/);
    return match ? match[1] : null;
}
