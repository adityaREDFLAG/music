export type RepeatMode = 'OFF' | 'ALL' | 'ONE';
export const RepeatMode = {
  OFF: 'OFF' as RepeatMode,
  ALL: 'ALL' as RepeatMode,
  ONE: 'ONE' as RepeatMode
};

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverArt?: string;
  duration: number;
  addedAt: number;
  lyrics?: Lyrics;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverArt?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PlayerState {
  currentTrackId: string | null;
  isPlaying: boolean;
  queue: string[]; // This is the active queue (shuffled or not)
  originalQueue: string[]; // Use this to restore order when un-shuffling
  history: string[];
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  crossfadeEnabled: boolean;
  crossfadeDuration: number;
}

export interface LibraryState {
  tracks: Record<string, Track>;
  playlists: Record<string, Playlist>;
}

export interface Metadata {
  name: string;
  description: string;
  requestFramePermissions: any[];
}

export interface LyricLine {
  time: number; // in seconds
  text: string;
}

export interface Lyrics {
  lines: LyricLine[];
  plain?: string;
  synced: boolean;
  error?: boolean;
}
