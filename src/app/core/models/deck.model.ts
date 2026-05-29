import { PokemonCard } from './pokemon-card.model';

export interface Deck {
  id: string;
  userId?: string;
  name: string;
  cards: PokemonCard[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}
