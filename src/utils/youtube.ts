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

        return data.map((item: any) => ({
            id: item.videoId,
            title: item.title,
            channel: item.author,
            duration: item.lengthSeconds,
            thumbnail: item.videoThumbnails?.find((t: any) => t.quality === 'medium' || t.quality === 'hqdefault')?.url || item.videoThumbnails?.[0]?.url,
            url: `https://www.youtube.com/watch?v=${item.videoId}`
        }));
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
