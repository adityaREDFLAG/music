import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLyrics } from '../src/utils/lyrics';

// Mock fetch
global.fetch = vi.fn();

describe('fetchLyrics', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch synced lyrics from lrclib.net', async () => {
    const mockSyncedLyrics = `
[00:10.00] Line 1
[00:20.50] Line 2
`;
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ syncedLyrics: mockSyncedLyrics, plainLyrics: 'Line 1\nLine 2' }),
    });

    const result = await fetchLyrics('Title', 'Artist');
    expect(result.synced).toBe(true);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].time).toBe(10);
    expect(result.lines[0].text).toBe('Line 1');
    expect(result.lines[1].time).toBe(20.5);
    expect(result.lines[1].text).toBe('Line 2');
  });

  it('should fallback to plain lyrics from lrclib.net if synced not available', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ syncedLyrics: null, plainLyrics: 'Line 1\nLine 2' }),
    });

    const result = await fetchLyrics('Title', 'Artist');
    expect(result.synced).toBe(false);
    expect(result.plain).toBe('Line 1\nLine 2');
    expect(result.lines).toHaveLength(0);
  });

  it('should fallback to popcat api if lrclib fails', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: false }) // lrclib fails
      .mockResolvedValueOnce({ // popcat succeeds
        ok: true,
        json: async () => ({ lyrics: 'Popcat Lyrics' }),
      });

    const result = await fetchLyrics('Title', 'Artist');
    expect(result.synced).toBe(false);
    expect(result.plain).toBe('Popcat Lyrics');
  });

  it('should return error if both fail', async () => {
     (global.fetch as any)
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: false });

    const result = await fetchLyrics('Title', 'Artist');
    expect(result.error).toBe(true);
  });
});
