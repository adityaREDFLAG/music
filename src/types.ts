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
  bpm?: number;
  key?: string; // e.g. "8A", "Cm"
  energy?: number; // 0.0 - 1.0
  playCount?: number;
  lastPlayed?: number;
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
  automixEnabled: boolean;
  automixMode: 'classic' | 'smart' | 'shuffle'; // classic = normal crossfade, smart = beat match/key, shuffle = random compatible
  normalizationEnabled: boolean;
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

export interface LyricWord {
  time: number;
  text: string;
}

export interface LyricLine {
  time: number; // in seconds
  text: string;
  words?: LyricWord[];
}

export interface Lyrics {
  lines: LyricLine[];
  plain?: string;
  synced: boolean;
  isWordSynced?: boolean;
  error?: boolean;
}
