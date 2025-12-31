import * as mm from 'music-metadata-browser';

export interface ParsedMetadata {
  title: string;
  artist: string;
  album: string;
  coverArt?: string; // Base64 data URI
  duration: number;
}

export async function parseTrackMetadata(blob: Blob, fallbackTitle: string): Promise<ParsedMetadata> {
  try {
    const metadata = await mm.parseBlob(blob);
    const { common, format } = metadata;

    let coverArt: string | undefined = undefined;
    if (common.picture && common.picture.length > 0) {
      const picture = common.picture[0];
      const blob = new Blob([picture.data], { type: picture.format });
      coverArt = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    return {
      title: common.title || fallbackTitle,
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      coverArt,
      duration: format.duration || 0
    };
  } catch (error) {
    console.error('Error parsing metadata:', error);
    return {
      title: fallbackTitle,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      duration: 0
    };
  }
}
