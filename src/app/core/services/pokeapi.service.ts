import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PokemonCard } from '../models/pokemon-card.model';
import { CardTransformerService } from './card-transformer.service';
import { SqliteService } from './sqlite.service';

export interface PokeListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: { name: string; url: string }[];
}

export interface PokemonCardsPage {
  count: number;
  next: string | null;
  previous: string | null;
  cards: PokemonCard[];
}

@Injectable({
  providedIn: 'root'
})
export class PokeapiService {
  private baseUrl = environment.pokeApiBaseUrl;

  constructor(
    private http: HttpClient, 
    private cardTransformer: CardTransformerService,
    private sqlite: SqliteService
  ) {}

  getPokemonList(limit: number = 20, offset: number = 0): Observable<PokeListResponse> {
    return this.http.get<PokeListResponse>(`${this.baseUrl}/pokemon?limit=${limit}&offset=${offset}`);
  }

  getPokemonDetails(url: string): Observable<any> {
    return this.http.get<any>(url);
  }

  async loadPokemonCardsPage(limit = 30, offset = 0): Promise<PokemonCardsPage> {
    try {
      const listResponse = await firstValueFrom(
        this.http.get<PokeListResponse>(`${this.baseUrl}/pokemon?limit=${limit}&offset=${offset}`)
      );

      const cachedCards = await this.sqlite.getCachedCards();
      const resultsToFetch = [];
      const finalCards: PokemonCard[] = [];

      for (const item of listResponse.results) {
        // Extract ID from URL (e.g. https://pokeapi.co/api/v2/pokemon/1/)
        const idMatch = item.url.match(/\/pokemon\/(\d+)\//);
        const pokemonId = idMatch ? parseInt(idMatch[1], 10) : null;

        let foundInCache = false;
        if (pokemonId) {
          const cached = cachedCards.find((c: PokemonCard) => c.pokemonId === pokemonId);
          if (cached) {
            finalCards.push(cached);
            foundInCache = true;
          }
        }

        if (!foundInCache) {
          resultsToFetch.push(item);
        }
      }

      const detailResults = await Promise.allSettled(
        resultsToFetch.map(item =>
          firstValueFrom(this.http.get<any>(item.url))
        )
      );

      const fetchedCards = detailResults
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => {
          if (this.cardTransformer.isValidDefaultPokemon(result.value)) {
             return this.cardTransformer.transformToCard(result.value);
          }
          return null;
        })
        .filter((card): card is PokemonCard => !!card);
        
      for (const card of fetchedCards) {
        finalCards.push(card);
        try { await this.sqlite.cacheCard(card); } catch (e) {}
      }

      return {
        count: listResponse.count,
        next: listResponse.next,
        previous: listResponse.previous,
        cards: this.removeDuplicateCards(finalCards)
      };

    } catch (error) {
      console.error('Error fetching pokemon batch', error);
      throw error;
    }
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

  async getPokemonCardByExactName(name: string): Promise<PokemonCard | null> {
    const normalized = name.trim().toLowerCase();

    if (!normalized || normalized.length < 3) {
      return null;
    }

    if (!/^[a-z0-9-]+$/.test(normalized)) {
      return null;
    }

    try {
      const pokemon = await firstValueFrom(
        this.http.get<any>(`${this.baseUrl}/pokemon/${normalized}`)
      );
      if (this.cardTransformer.isValidDefaultPokemon(pokemon)) {
        return this.cardTransformer.transformToCard(pokemon);
      }
      return null;
    } catch (error: any) {
      if (error?.status === 404) {
        console.warn(`Pokémon no encontrado por nombre exacto: ${normalized}`);
        return null;
      }
      console.error('Error buscando Pokémon por nombre exacto:', error);
      return null;
    }
  }
}
