import { describe, it, expect, vi } from 'vitest';
import { parseTrackMetadata } from '../src/utils/metadata';
import * as mm from 'music-metadata-browser';

// Mock music-metadata-browser
vi.mock('music-metadata-browser', () => ({
  parseBlob: vi.fn(),
}));

// Mock FileReader for base64 conversion
class MockFileReader {
  onloadend: any;
  onerror: any;
  result: any;

  readAsDataURL(blob: Blob) {
    // Simulate async reading
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,mockbase64data';
      if (this.onloadend) this.onloadend();
    }, 0);
  }
}

global.FileReader = MockFileReader as any;

describe('parseTrackMetadata', () => {
  it('should parse metadata correctly when available', async () => {
    const mockBlob = new Blob(['mock audio data'], { type: 'audio/mp3' });
    const mockMetadata = {
      common: {
        title: 'Test Title',
        artist: 'Test Artist',
        album: 'Test Album',
        picture: [
          {
            format: 'image/jpeg',
            data: new Uint8Array([1, 2, 3]),
          },
        ],
      },
      format: {
        duration: 120,
      },
    };

    (mm.parseBlob as any).mockResolvedValue(mockMetadata);

    const result = await parseTrackMetadata(mockBlob, 'Fallback Title');

    expect(result.title).toBe('Test Title');
    expect(result.artist).toBe('Test Artist');
    expect(result.album).toBe('Test Album');
    expect(result.duration).toBe(120);
    expect(result.coverArt).toBe('data:image/jpeg;base64,mockbase64data');
  });

  it('should use fallback title when metadata is missing', async () => {
    const mockBlob = new Blob(['mock audio data'], { type: 'audio/mp3' });
    const mockMetadata = {
      common: {},
      format: {},
    };

    (mm.parseBlob as any).mockResolvedValue(mockMetadata);

    const result = await parseTrackMetadata(mockBlob, 'Fallback Title');

    expect(result.title).toBe('Fallback Title');
    expect(result.artist).toBe('Unknown Artist');
    expect(result.album).toBe('Unknown Album');
    expect(result.duration).toBe(0);
    expect(result.coverArt).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    const mockBlob = new Blob(['mock audio data'], { type: 'audio/mp3' });
    (mm.parseBlob as any).mockRejectedValue(new Error('Parse error'));

    const result = await parseTrackMetadata(mockBlob, 'Fallback Title');

    expect(result.title).toBe('Fallback Title');
    expect(result.artist).toBe('Unknown Artist');
    expect(result.album).toBe('Unknown Album');
    expect(result.duration).toBe(0);
  });
});
