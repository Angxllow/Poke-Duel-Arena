export interface PokemonCard {
  id: number;
  pokemonId: number;
  instanceId: string;
  name: string;
  imageUrl: string;
  types: string[];
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  abilityName: string;
  abilityDescription: string;
  abilityType: string;
  rarity: 'Común' | 'Rara' | 'Épica' | 'Legendaria';
  level: number;
  energyCost: number;
  description: string;
  rawData?: any;
  hasAttacked?: boolean;
  hasUsedAbility?: boolean;
  isDefending?: boolean;
  isFrozen?: boolean;
  temporaryAttackBoost?: number;
  temporaryDefenseBoost?: number;
}
