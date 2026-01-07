
import { Track, Playlist } from './types';

const DB_NAME = 'vibe_music_db';
const DB_VERSION = 3; // Incremented for 'artists' store

export interface ArtistMetadata {
  name: string;
  imageUrl?: string;
  bio?: string;
  fetchedAt: number;
}

export class MusicDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('playlists')) {
          db.createObjectStore('playlists', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('artists')) {
          db.createObjectStore('artists', { keyPath: 'name' });
        }
      };
    });
  }

  async saveTrack(track: Track, audioBlob?: Blob): Promise<void> {
    if (!this.db) return;
    const storeNames = audioBlob ? ['tracks', 'blobs'] : ['tracks'];
    const tx = this.db.transaction(storeNames, 'readwrite');
    tx.objectStore('tracks').put(track);
    if (audioBlob) {
        tx.objectStore('blobs').put({ id: track.id, blob: audioBlob });
    }
    return new Promise((res) => (tx.oncomplete = () => res()));
  }

  async getTrack(id: string): Promise<Track | undefined> {
    if (!this.db) return;
    return new Promise((res) => {
      const req = this.db!.transaction('tracks').objectStore('tracks').get(id);
      req.onsuccess = () => res(req.result);
    });
  }

  async getAudioBlob(id: string): Promise<Blob | undefined> {
    if (!this.db) return;
    return new Promise((res) => {
      const req = this.db!.transaction('blobs').objectStore('blobs').get(id);
      req.onsuccess = () => res(req.result?.blob);
    });
  }

  async getAllTracks(): Promise<Track[]> {
    if (!this.db) return [];
    return new Promise((res) => {
      const req = this.db!.transaction('tracks').objectStore('tracks').getAll();
      req.onsuccess = () => res(req.result);
    });
  }

  async savePlaylist(playlist: Playlist): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction('playlists', 'readwrite');
    tx.objectStore('playlists').put(playlist);
    return new Promise((res) => (tx.oncomplete = () => res()));
  }

  async getPlaylist(id: string): Promise<Playlist | undefined> {
    if (!this.db) return;
    return new Promise((res) => {
      const req = this.db!.transaction('playlists').objectStore('playlists').get(id);
      req.onsuccess = () => res(req.result);
    });
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    if (!this.db) return [];
    return new Promise((res) => {
      const req = this.db!.transaction('playlists').objectStore('playlists').getAll();
      req.onsuccess = () => res(req.result);
    });
  }

  async deletePlaylist(id: string): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction('playlists', 'readwrite');
    tx.objectStore('playlists').delete(id);
    return new Promise((res) => (tx.oncomplete = () => res()));
  }

  async deleteTrack(id: string): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(['tracks', 'blobs'], 'readwrite');
    tx.objectStore('tracks').delete(id);
    tx.objectStore('blobs').delete(id);
    return new Promise((res) => (tx.oncomplete = () => res()));
  }

  async incrementPlayCount(id: string): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');

    return new Promise((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const track = getReq.result as Track;
            if (track) {
                track.playCount = (track.playCount || 0) + 1;
                track.lastPlayed = Date.now();
                store.put(track);
            }
            resolve();
        };
        getReq.onerror = () => reject(getReq.error);
    });
  }

  async toggleFavorite(id: string): Promise<Track | undefined> {
    if (!this.db) return;
    const tx = this.db.transaction('tracks', 'readwrite');
    const store = tx.objectStore('tracks');

    return new Promise((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const track = getReq.result as Track;
            if (track) {
                track.isFavorite = !track.isFavorite;
                store.put(track);
                resolve(track);
            } else {
                resolve(undefined);
            }
        };
        getReq.onerror = () => reject(getReq.error);
    });
  }

  async setSetting(key: string, value: any): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put(value, key);
  }

  async getSetting<T>(key: string): Promise<T | undefined> {
    if (!this.db) return;
    return new Promise((res) => {
      const req = this.db!.transaction('settings').objectStore('settings').get(key);
      req.onsuccess = () => res(req.result);
    });
  }

  // --- Artist Metadata ---
  async getArtist(name: string): Promise<ArtistMetadata | undefined> {
      if (!this.db) return;
      return new Promise((res) => {
          const req = this.db!.transaction('artists').objectStore('artists').get(name);
          req.onsuccess = () => res(req.result);
      });
  }

  async saveArtist(artist: ArtistMetadata): Promise<void> {
      if (!this.db) return;
      const tx = this.db.transaction('artists', 'readwrite');
      tx.objectStore('artists').put(artist);
      return new Promise((res) => (tx.oncomplete = () => res()));
  }

  async findTrackByUrl(url: string): Promise<Track | undefined> {
    const tracks = await this.getAllTracks();
    return tracks.find(t => t.source === 'youtube' && t.externalUrl === url);
  }

  async addYouTubeTrack(ytTrack: { title: string, channel: string, duration: number, thumbnail: string, url: string }): Promise<Track> {
    const existing = await this.findTrackByUrl(ytTrack.url);
    if (existing) return existing;

    const newTrack: Track = {
        id: crypto.randomUUID(),
        title: ytTrack.title,
        artist: ytTrack.channel,
        album: 'YouTube',
        duration: ytTrack.duration,
        addedAt: Date.now(),
        source: 'youtube',
        externalUrl: ytTrack.url,
        coverArt: ytTrack.thumbnail,
        playCount: 0
    };

    await this.saveTrack(newTrack);
    return newTrack;
  }
}

export const dbService = new MusicDB();
