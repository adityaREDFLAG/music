// src/utils/soundcloud.ts

const CLIENT_ID = 'bOhNcaq9F32sB3eS8zWLywAyh4OdDXbC'; // Retrieved dynamically
const BASE_URL = 'https://api-v2.soundcloud.com';

export interface SoundCloudTrack {
    id: number;
    title: string;
    duration: number; // in ms
    artwork_url: string | null;
    user: {
        username: string;
        avatar_url: string | null;
    };
    permalink_url: string;
    streamable: boolean;
    policy: string; // 'ALLOW' or 'BLOCK' sometimes
    monetization_model: string;
}

export interface SearchResponse {
    collection: SoundCloudTrack[];
    next_href: string | null;
}

export const searchSoundCloud = async (query: string): Promise<SoundCloudTrack[]> => {
    try {
        // Try direct first
        const directUrl = `${BASE_URL}/search/tracks?q=${encodeURIComponent(query)}&client_id=${CLIENT_ID}&limit=20&access=playable`;
        try {
            const res = await fetch(directUrl);
            if (res.ok) {
                 const data: SearchResponse = await res.json();
                 return data.collection.filter(t => t.streamable && t.policy !== 'BLOCK');
            }
        } catch (err) {
            console.warn("Direct SC search failed (CORS?), trying proxy...");
        }

        // Fallback to proxy (CORS workaround for browser)
        // Using allorigins.win as it's a stable JSON proxy
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy error ${res.status}`);

        const proxyData = await res.json();
        const data: SearchResponse = JSON.parse(proxyData.contents);

        return data.collection.filter(t =>
            t.streamable &&
            t.policy !== 'BLOCK'
        );
    } catch (e) {
        console.error('SoundCloud search error:', e);
        return [];
    }
};

export const formatArtworkUrl = (url: string | null, size: 'large' | 't500x500' = 't500x500') => {
    if (!url) return null;
    return url.replace('large', size);
};
