
import { Track, Playlist } from './types';

const DB_NAME = 'vibe_music_db';
const DB_VERSION = 1;

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
      };
    });
  }

  async saveTrack(track: Track, audioBlob: Blob): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(['tracks', 'blobs'], 'readwrite');
    tx.objectStore('tracks').put(track);
    tx.objectStore('blobs').put({ id: track.id, blob: audioBlob });
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
  }

  async deleteTrack(id: string): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(['tracks', 'blobs'], 'readwrite');
    tx.objectStore('tracks').delete(id);
    tx.objectStore('blobs').delete(id);
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
}

export const dbService = new MusicDB();
