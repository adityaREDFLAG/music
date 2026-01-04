import { dbService, ArtistMetadata } from '../db';

const WIKI_API_URL = 'https://en.wikipedia.org/w/api.php';

export const fetchArtistImageFromWikipedia = async (artistName: string): Promise<string | null> => {
    try {
        const params = new URLSearchParams({
            action: 'query',
            format: 'json',
            prop: 'pageimages',
            titles: artistName,
            pithumbsize: '500',
            origin: '*'
        });

        const res = await fetch(`${WIKI_API_URL}?${params.toString()}`);
        if (!res.ok) return null;

        const data = await res.json();
        const pages = data.query?.pages;
        if (!pages) return null;

        const pageId = Object.keys(pages)[0];
        if (pageId === '-1') return null; // Not found

        const page = pages[pageId];
        return page.thumbnail?.source || null;

    } catch (e) {
        console.warn(`Failed to fetch artist image for ${artistName}`, e);
        return null;
    }
};

export const getOrFetchArtistImage = async (artistName: string): Promise<string | null> => {
    // 1. Check DB
    const cached = await dbService.getArtist(artistName);
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

    if (cached) {
        // If we have an image, return it
        if (cached.imageUrl) return cached.imageUrl;

        // If we tried fetching recently (and failed or got nothing), don't retry too soon
        if (Date.now() - cached.fetchedAt < ONE_WEEK) {
            return null;
        }
    }

    // 2. Fetch from API
    const imageUrl = await fetchArtistImageFromWikipedia(artistName);

    // 3. Save to DB (even if null, to cache the attempt)
    await dbService.saveArtist({
        name: artistName,
        imageUrl: imageUrl || undefined,
        fetchedAt: Date.now()
    });

    return imageUrl;
};
