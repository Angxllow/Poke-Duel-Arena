import { Injectable } from '@angular/core';
import { PokemonCard } from '../models/pokemon-card.model';
import { GameState } from '../models/game-state.model';
import { MatchResult } from '../models/match-result.model';
import { Deck } from '../models/deck.model';

/**
 * SQLite Local Service
 * Decision Documentada:
 * Como el navegador no maneja SQLite nativo y configurar sql.js con archivos .wasm
 * puede causar problemas en diferentes entornos de construcción (Vite/Webpack),
 * se ha optado por implementar una capa de persistencia usando IndexedDB puro.
 * Esta capa mantiene una API de "tablas" (ObjectStores) compatible con los requerimientos
 * del proyecto (local_cards_cache, local_settings, solo_matches, local_match_history, temporary_decks).
 */
@Injectable({
  providedIn: 'root'
})
export class SqliteService {
  private dbName = 'PokeDuelArenaDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {}

  private ensureDb(): Promise<void> {
    if (this.db) return Promise.resolve();
    if (!this.initPromise) {
      this.initPromise = this.initDatabase().catch(err => {
        console.warn('Fallback to localStorage since IndexedDB failed', err);
        this.initPromise = null;
        throw err;
      });
    }
    return this.initPromise;
  }

  initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        console.error('Error abriendo IndexedDB (SQLite Fallback)', event);
        reject('Error al inicializar base de datos local.');
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db: IDBDatabase = event.target.result;

        // Table: local_cards_cache
        if (!db.objectStoreNames.contains('local_cards_cache')) {
          db.createObjectStore('local_cards_cache', { keyPath: 'id' });
        }
        // Table: local_settings
        if (!db.objectStoreNames.contains('local_settings')) {
          db.createObjectStore('local_settings', { keyPath: 'key' });
        }
        // Table: solo_matches
        if (!db.objectStoreNames.contains('solo_matches')) {
          db.createObjectStore('solo_matches', { keyPath: 'id' });
        }
        // Table: local_match_history
        if (!db.objectStoreNames.contains('local_match_history')) {
          db.createObjectStore('local_match_history', { keyPath: 'id' });
        }
        // Table: temporary_decks
        if (!db.objectStoreNames.contains('temporary_decks')) {
          db.createObjectStore('temporary_decks', { keyPath: 'id' });
        }
      };
    });
  }

  // local_cards_cache
  cacheCard(card: PokemonCard): Promise<void> {
    return this.put('local_cards_cache', { ...card, cached_at: new Date().toISOString() });
  }

  getCachedCards(): Promise<PokemonCard[]> {
    return this.getAll('local_cards_cache');
  }

  // local_settings
  saveSetting(key: string, value: string): Promise<void> {
    return this.put('local_settings', { key, value, updated_at: new Date().toISOString() });
  }

  getSetting(key: string): Promise<string | null> {
    return this.get('local_settings', key).then(res => res ? res.value : null);
  }

  // solo_matches
  saveSoloMatch(gameState: GameState): Promise<void> {
    return this.put('solo_matches', { 
      id: gameState.id, 
      state_json: JSON.stringify(gameState),
      created_at: gameState.createdAt
    });
  }

  // local_match_history
  saveLocalMatchResult(result: MatchResult): Promise<void> {
    return this.put('local_match_history', result);
  }

  getLocalHistory(): Promise<MatchResult[]> {
    return this.getAll('local_match_history');
  }

  // temporary_decks
  saveTemporaryDeck(deck: Deck): Promise<void> {
    return this.put('temporary_decks', deck);
  }

  getTemporaryDecks(): Promise<Deck[]> {
    return this.getAll('temporary_decks');
  }

  // Generic IndexedDB Helpers
  private async put(storeName: string, item: any): Promise<void> {
    try {
      await this.ensureDb();
      return new Promise((resolve, reject) => {
        if (!this.db) return reject('DB not initialized');
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(item);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (e) {
      // Fallback
      const key = `pokeduel_${storeName}`;
      let data: any[] = [];
      try { data = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){}
      const existing = data.findIndex((d: any) => d.id === item.id || d.key === item.key);
      if (existing >= 0) data[existing] = item;
      else data.push(item);
      localStorage.setItem(key, JSON.stringify(data));
      return Promise.resolve();
    }
  }

  private async get(storeName: string, key: any): Promise<any> {
    try {
      await this.ensureDb();
      return new Promise((resolve, reject) => {
        if (!this.db) return reject('DB not initialized');
        const transaction = this.db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      const localKey = `pokeduel_${storeName}`;
      let data: any[] = [];
      try { data = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch(e){}
      const item = data.find((d: any) => d.id === key || d.key === key);
      return Promise.resolve(item);
    }
  }

  private async getAll(storeName: string): Promise<any[]> {
    try {
      await this.ensureDb();
      return new Promise((resolve, reject) => {
        if (!this.db) return reject('DB not initialized');
        const transaction = this.db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      const localKey = `pokeduel_${storeName}`;
      let data: any[] = [];
      try { data = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch(e){}
      return Promise.resolve(data);
    }
  }
}
