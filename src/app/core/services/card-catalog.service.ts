import { Injectable } from '@angular/core';
import { PokemonCard } from '../models/pokemon-card.model';
import { PokeapiService } from './pokeapi.service';
import { SqliteService } from './sqlite.service';
import { DeckService } from './deck.service';

@Injectable({
  providedIn: 'root'
})
export class CardCatalogService {
  private cards: PokemonCard[] = [];
  
  readonly limit = 30;
  offset = 0;
  
  totalCount = 0;
  hasMoreCards = true;

  constructor(
    private pokeApiService: PokeapiService,
    private sqliteService: SqliteService,
    private deckService: DeckService
  ) {}

  async getCards(): Promise<PokemonCard[]> {
    return this.cards;
  }

  async loadInitialCards(force = false): Promise<PokemonCard[]> {
    if (!force && this.cards.length > 0) {
      return this.cards;
    }

    this.offset = 0;
    this.cards = [];
    this.hasMoreCards = true;

    try {
      const page = await this.pokeApiService.loadPokemonCardsPage(this.limit, this.offset);
      this.totalCount = page.count;
      this.hasMoreCards = !!page.next;
      this.cards = this.removeDuplicateCards(page.cards);
      return this.cards;
    } catch (error) {
      console.error('Error in CardCatalogService.loadInitialCards:', error);
      // Fallback to local cache if possible, else demo cards
      const cached = await this.sqliteService.getCachedCards().catch(() => []);
      if (cached.length > 0) {
         this.cards = this.removeDuplicateCards(cached);
      } else {
         this.cards = this.deckService.getDemoCards();
      }
      return this.cards;
    }
  }

  async loadMoreCards(): Promise<PokemonCard[]> {
    if (!this.hasMoreCards) return this.cards;

    try {
      this.offset += this.limit;
      const page = await this.pokeApiService.loadPokemonCardsPage(this.limit, this.offset);
      this.totalCount = page.count;
      this.hasMoreCards = !!page.next;
      
      this.cards = this.removeDuplicateCards([
        ...this.cards,
        ...page.cards
      ]);
      return this.cards;
    } catch (error) {
      console.error('Error in CardCatalogService.loadMoreCards:', error);
      this.offset = Math.max(0, this.offset - this.limit);
      return this.cards;
    }
  }

  async ensureMinimumCards(minimum = 40): Promise<PokemonCard[]> {
    if (this.cards.length >= minimum) {
      return this.cards;
    }

    try {
      if (!this.cards.length) {
        await this.loadInitialCards();
      }

      while (this.cards.length < minimum && this.hasMoreCards) {
        await this.loadMoreCards();
      }

      if (this.cards.length < minimum) {
        const demoCards = this.deckService.getDemoCards();
        this.cards = this.removeDuplicateCards([...this.cards, ...demoCards]);
      }

      return this.cards;
    } catch (error) {
      console.error('Error asegurando cartas mínimas:', error);
      const demoCards = this.deckService.getDemoCards();
      this.cards = this.removeDuplicateCards([...this.cards, ...demoCards]);
      return this.cards;
    }
  }

  async findPokemonByExactName(name: string): Promise<PokemonCard | null> {
    const normalized = name.trim().toLowerCase();
    
    const existing = this.cards.find(card => card.name.toLowerCase() === normalized);
    if (existing) return existing;

    try {
      const card = await this.pokeApiService.getPokemonCardByExactName(normalized);
      if (card) {
        this.cards = this.removeDuplicateCards([...this.cards, card]);
        try { await this.sqliteService.cacheCard(card); } catch (e) {}
        return card;
      }
      return null;
    } catch {
      return null;
    }
  }

  clearCardCache(): void {
    try {
      localStorage.removeItem('pokeduel_cards');
      localStorage.removeItem('pokeduel_cached_cards');
    } catch (e) {}
  }

  private removeDuplicateCards(cards: PokemonCard[]): PokemonCard[] {
    const map = new Map<number, PokemonCard>();
    for (const card of cards) {
      if (card?.pokemonId) {
        map.set(card.pokemonId, card);
      }
    }
    return Array.from(map.values());
  }
}
