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
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
}

export interface PlayerState {
  currentTrackId: string | null;
  isPlaying: boolean;
  queue: string[];
  history: string[];
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
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
