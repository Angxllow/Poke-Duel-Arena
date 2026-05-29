import { Injectable } from '@angular/core';
import { Deck } from '../models/deck.model';
import { PokemonCard } from '../models/pokemon-card.model';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { SqliteService } from './sqlite.service';

@Injectable({
  providedIn: 'root'
})
export class DeckService {
  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
    private sqlite: SqliteService
  ) {}

  async getAllAvailableDecks(): Promise<Deck[]> {
    const decks: Deck[] = [];

    try {
      const localDecks = await this.getLocalDecks();
      decks.push(...localDecks);
    } catch (error) {
      console.error('Error cargando mazos locales:', error);
    }

    try {
      const remoteDecks = await this.getRemoteDecks();
      decks.push(...remoteDecks);
    } catch (error) {
      console.error('Error cargando mazos remotos:', error);
    }

    return this.removeDuplicateDecks(decks);
  }

  removeDuplicateDecks(decks: Deck[]): Deck[] {
    const unique = new Map<string, Deck>();
    for (const d of decks) {
      unique.set(d.id, d);
    }
    return Array.from(unique.values());
  }

  async getLocalDecks(): Promise<Deck[]> {
    try {
      const raw = localStorage.getItem('pokeduel_decks');
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      console.error('Error parsing local decks', error);
      return [];
    }
  }

  async getRemoteDecks(): Promise<Deck[]> {
    const user = await this.auth.getCurrentUser();
    if (!user) return [];

    try {
      const { data: decksData, error: decksError } = await this.supabase.client
        .from('decks')
        .select('*')
        .eq('user_id', user.id);

      if (decksError || !decksData) return [];

      const decks: Deck[] = [];
      for (const d of decksData) {
        const { data: deckCardsData, error: deckCardsError } = await this.supabase.client
          .from('deck_cards')
          .select('*, cards(*)')
          .eq('deck_id', d.id);

        const cards: PokemonCard[] = [];
        if (!deckCardsError && deckCardsData) {
          for (const dc of deckCardsData) {
            if (dc.cards) {
              cards.push(this.createCardInstance(this.mapSupabaseCardToPokemonCard(dc.cards)));
            }
          }
        }

        decks.push({
          id: d.id,
          name: d.name,
          cards: cards,
          isActive: false,
          createdAt: d.created_at,
          updatedAt: d.updated_at
        });
      }
      return decks;
    } catch (error) {
      console.error('Error in getRemoteDecks', error);
      return [];
    }
  }

  private mapSupabaseCardToPokemonCard(dbCard: any): PokemonCard {
    return {
      id: dbCard.pokemon_id || dbCard.id,
      pokemonId: dbCard.pokemon_id,
      instanceId: crypto.randomUUID(),
      name: dbCard.name,
      imageUrl: dbCard.image_url,
      types: dbCard.types || [],
      attack: dbCard.attack,
      defense: dbCard.defense,
      hp: dbCard.hp,
      maxHp: dbCard.max_hp || dbCard.hp,
      abilityName: dbCard.ability_name,
      abilityDescription: dbCard.ability_description,
      abilityType: dbCard.ability_type || (dbCard.types && dbCard.types.length > 0 ? dbCard.types[0] : 'normal'),
      rarity: dbCard.rarity || 'Común',
      level: dbCard.level || 1,
      energyCost: dbCard.energy_cost || 1,
      description: dbCard.description || '',
      rawData: dbCard.raw_data
    };
  }

  async getActiveDeckLocal(): Promise<Deck | null> {
    try {
      const raw = localStorage.getItem('pokeduel_active_deck');
      if (raw) {
        return JSON.parse(raw);
      }
      const decks = await this.getLocalDecks();
      return decks.find(deck => deck.isActive) ?? null;
    } catch(e) {
      return null;
    }
  }

  async saveActiveDeckLocal(deck: Deck): Promise<void> {
    deck.isActive = true;

    const decks = await this.getLocalDecks();
    const updatedDecks = decks.map(d => ({
      ...d,
      isActive: d.id === deck.id
    }));

    if (!updatedDecks.some(d => d.id === deck.id)) {
      updatedDecks.push(deck);
    }

    localStorage.setItem('pokeduel_decks', JSON.stringify(updatedDecks));
    localStorage.setItem('pokeduel_active_deck', JSON.stringify(deck));
  }

  async saveTemporaryDeck(deck: Deck): Promise<void> {
    const decks = await this.getLocalDecks();
    const existingIndex = decks.findIndex(d => d.id === deck.id);

    if (existingIndex >= 0) {
      decks[existingIndex] = deck;
    } else {
      decks.push(deck);
    }

    localStorage.setItem('pokeduel_decks', JSON.stringify(decks));
  }

  async saveDeck(deck: Deck): Promise<{ localOnly: boolean } | void> {
    await this.saveTemporaryDeck(deck);
    
    if (!this.auth.isAuthenticated) {
      return { localOnly: true };
    }
    
    const user = await this.auth.getCurrentUser();
    if (user) {
      try {
        const { error: deckError } = await this.supabase.client
          .from('decks')
          .upsert({
            id: deck.id,
            user_id: user.id,
            name: deck.name,
            is_active: deck.isActive || false,
            updated_at: new Date().toISOString()
          });

        if (!deckError) {
          if (deck.isActive) {
            await this.supabase.client
              .from('decks')
              .update({ is_active: false })
              .eq('user_id', user.id)
              .neq('id', deck.id);
          }

          // Clear old cards first
          await this.supabase.client.from('deck_cards').delete().eq('deck_id', deck.id);
          
          // Upsert cards first
          for (const c of deck.cards) {
            await this.supabase.client.from('cards').upsert({
              id: c.pokemonId,
              pokemon_id: c.pokemonId,
              name: c.name,
              image_url: c.imageUrl,
              types: c.types,
              attack: c.attack,
              defense: c.defense,
              hp: c.maxHp,
              max_hp: c.maxHp,
              ability_name: c.abilityName,
              ability_description: c.abilityDescription,
              ability_type: c.abilityType,
              rarity: c.rarity,
              level: c.level,
              energy_cost: c.energyCost,
              description: c.description,
              raw_data: c.rawData || null
            });
          }

          const deckCardRows = this.groupDeckCards(deck.cards).map(item => ({
            deck_id: deck.id,
            card_id: item.card_id,
            quantity: item.quantity
          }));

          if (deckCardRows.length > 0) {
            const { error: insertError } = await this.supabase.client.from('deck_cards').insert(deckCardRows);
            if (insertError) throw insertError;
          }
        }
        return { localOnly: false };
      } catch (err) {
        console.error('Failed to save deck remotely', err);
        return { localOnly: true };
      }
    }
    return { localOnly: true };
  }

  async getAvailableCards(): Promise<PokemonCard[]> {
    return await this.sqlite.getCachedCards();
  }

  private groupDeckCards(cards: PokemonCard[]): Array<{ card_id: number; quantity: number }> {
    const grouped = new Map<number, number>();

    for (const card of cards) {
      const cardId = card.pokemonId || card.id;
      if (!cardId) continue;
      const current = grouped.get(cardId) ?? 0;
      grouped.set(cardId, Math.min(current + 1, 4));
    }

    return Array.from(grouped.entries()).map(([card_id, quantity]) => ({
      card_id,
      quantity
    }));
  }

  createQuickDeck(cards: PokemonCard[], size = 20): Deck {
    const validCards = cards.filter(card => card?.pokemonId && card?.name);

    if (validCards.length < 1) {
      throw new Error('No hay cartas disponibles.');
    }

    const selected: PokemonCard[] = [];
    const copyCount = new Map<number, number>();
    let safety = 0;

    while (selected.length < size && safety < 1000) {
      safety++;
      const base = validCards[Math.floor(Math.random() * validCards.length)];
      const cardId = base.pokemonId || base.id;
      const currentCopies = copyCount.get(cardId) ?? 0;

      if (currentCopies >= 4) continue;

      selected.push(this.createCardInstance(base));
      copyCount.set(cardId, currentCopies + 1);
    }

    if (selected.length < size) {
      throw new Error('No hay suficientes cartas para generar un mazo válido.');
    }

    return {
      id: crypto.randomUUID(),
      name: `Mazo Rápido ${new Date().toLocaleTimeString()}`,
      cards: selected,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  createCardInstance(card: PokemonCard): PokemonCard {
    return {
      ...card,
      instanceId: crypto.randomUUID(),
      hp: card.maxHp || card.hp,
      hasAttacked: false,
      isDefending: false,
      hasUsedAbility: false,
      isFrozen: false
    };
  }

  async generateComputerDeck(): Promise<Deck> {
    let cards = await this.getAvailableCards();
    if (!cards || cards.length < 20) {
      cards = this.getDemoCards();
    }
    return this.createQuickDeck(cards, 20);
  }

  getDemoCards(): PokemonCard[] {
    const demoPokemon = [
      { id: 25, name: 'Pikachu', types: ['electric'] },
      { id: 6, name: 'Charizard', types: ['fire', 'flying'] },
      { id: 1, name: 'Bulbasaur', types: ['grass', 'poison'] },
      { id: 7, name: 'Squirtle', types: ['water'] },
      { id: 150, name: 'Mewtwo', types: ['psychic'] },
      { id: 448, name: 'Lucario', types: ['fighting', 'steel'] },
      { id: 94, name: 'Gengar', types: ['ghost', 'poison'] },
      { id: 133, name: 'Eevee', types: ['normal'] },
      { id: 143, name: 'Snorlax', types: ['normal'] },
      { id: 149, name: 'Dragonite', types: ['dragon', 'flying'] },
      { id: 658, name: 'Greninja', types: ['water', 'dark'] },
      { id: 59, name: 'Arcanine', types: ['fire'] },
      { id: 131, name: 'Lapras', types: ['water', 'ice'] },
      { id: 68, name: 'Machamp', types: ['fighting'] },
      { id: 282, name: 'Gardevoir', types: ['psychic', 'fairy'] },
      { id: 95, name: 'Onix', types: ['rock', 'ground'] },
      { id: 134, name: 'Vaporeon', types: ['water'] },
      { id: 135, name: 'Jolteon', types: ['electric'] },
      { id: 136, name: 'Flareon', types: ['fire'] },
      { id: 3, name: 'Venusaur', types: ['grass', 'poison'] },
      { id: 9, name: 'Blastoise', types: ['water'] },
      { id: 65, name: 'Alakazam', types: ['psychic'] },
      { id: 130, name: 'Gyarados', types: ['water', 'flying'] },
      { id: 248, name: 'Tyranitar', types: ['rock', 'dark'] },
      { id: 445, name: 'Garchomp', types: ['dragon', 'ground'] },
      { id: 373, name: 'Salamence', types: ['dragon', 'flying'] },
      { id: 376, name: 'Metagross', types: ['steel', 'psychic'] },
      { id: 197, name: 'Umbreon', types: ['dark'] },
      { id: 196, name: 'Espeon', types: ['psychic'] },
      { id: 38, name: 'Ninetales', types: ['fire'] }
    ];
    
    return demoPokemon.map((p) => this.createCardInstance({
      id: p.id,
      pokemonId: p.id,
      instanceId: '', // Will be overridden
      name: p.name,
      imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`,
      types: p.types,
      attack: 50 + Math.floor(Math.random() * 50),
      defense: 40 + Math.floor(Math.random() * 40),
      hp: 100 + Math.floor(Math.random() * 50),
      maxHp: 150,
      abilityName: 'Ataque Básico',
      abilityDescription: 'Inflige daño moderado.',
      abilityType: p.types[0] || 'normal',
      rarity: 'Común',
      level: 10,
      energyCost: 1,
      description: `Un ${p.name} salvaje.`
    }));
  }
}
