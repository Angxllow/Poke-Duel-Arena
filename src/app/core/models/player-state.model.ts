import { PokemonCard } from './pokemon-card.model';

export interface PlayerState {
  id: string;
  username: string;
  lifePoints: number;
  maxLifePoints?: number;
  deck: PokemonCard[];
  hand: PokemonCard[];
  field: PokemonCard[];
  discardPile: PokemonCard[];
  hasSummonedThisTurn: boolean;
  isComputer: boolean;
}
