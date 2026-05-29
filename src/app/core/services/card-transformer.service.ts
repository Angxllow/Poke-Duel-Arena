import { Injectable } from '@angular/core';
import { PokemonCard } from '../models/pokemon-card.model';

@Injectable({
  providedIn: 'root'
})
export class CardTransformerService {
  constructor() {}

  isValidDefaultPokemon(pokemon: any): boolean {
    if (!pokemon?.id || !pokemon?.name) return false;

    // Evitar formas especiales de IDs muy altos si aparecen.
    if (pokemon.id >= 10000) return false;

    // Evitar variantes muy específicas si no se quieren como cartas normales.
    const invalidNameParts = [
      '-mega',
      '-gmax',
      '-totem',
      '-starter',
      '-battle-bond',
      '-eternamax'
    ];

    return !invalidNameParts.some(part => pokemon.name.toLowerCase().includes(part));
  }

  private getStat(pokemon: any, statName: string): number {
    return pokemon.stats?.find((s: any) => s.stat?.name === statName)?.base_stat ?? 50;
  }

  transformToCard(rawPokemon: any): PokemonCard {
    const types = rawPokemon.types.map((t: any) => t.type.name);
    const mainType = types[0] || 'normal';

    const hpStat = this.getStat(rawPokemon, 'hp');
    const attackStat = this.getStat(rawPokemon, 'attack');
    const defenseStat = this.getStat(rawPokemon, 'defense');
    const spAttackStat = this.getStat(rawPokemon, 'special-attack');
    const spDefenseStat = this.getStat(rawPokemon, 'special-defense');
    const speedStat = this.getStat(rawPokemon, 'speed');

    const hp = Math.floor(hpStat * 1.5) + 50;
    const maxHp = hp;
    const attack = Math.floor((attackStat + spAttackStat) / 2);
    const defense = Math.floor((defenseStat + spDefenseStat) / 2);
    const statTotal = hpStat + attackStat + defenseStat + spAttackStat + spDefenseStat + speedStat;
    const level = Math.floor(statTotal / 6);

    let rarity: 'Común' | 'Rara' | 'Épica' | 'Legendaria' = 'Común';
    let energyCost = 1;

    if (statTotal >= 600) {
      rarity = 'Legendaria';
      energyCost = 4;
    } else if (statTotal >= 450) {
      rarity = 'Épica';
      energyCost = 3;
    } else if (statTotal >= 320) {
      rarity = 'Rara';
      energyCost = 2;
    }

    const abilityInfo = this.generateAbility(mainType);
    
    // Create a temporary instance ID for the base card (it should be regenerated when added to a deck)
    const instanceId = crypto.randomUUID();

    const imageUrl = rawPokemon.sprites?.other?.['official-artwork']?.front_default 
      || rawPokemon.sprites?.other?.dream_world?.front_default 
      || rawPokemon.sprites?.front_default 
      || 'assets/pokemon-placeholder.png';

    return {
      id: rawPokemon.id,
      pokemonId: rawPokemon.id,
      instanceId: instanceId,
      name: rawPokemon.name.charAt(0).toUpperCase() + rawPokemon.name.slice(1),
      imageUrl: imageUrl,
      types: types,
      attack: attack,
      defense: defense,
      hp: hp,
      maxHp: maxHp,
      abilityName: abilityInfo.name,
      abilityDescription: abilityInfo.description,
      abilityType: mainType,
      rarity: rarity,
      level: level,
      energyCost: energyCost,
      description: `Pokémon tipo ${mainType} de nivel ${level}.`,
      hasAttacked: false,
      hasUsedAbility: false,
      isDefending: false,
      isFrozen: false
    };
  }

  private generateAbility(type: string): { name: string, description: string } {
    switch(type) {
      case 'fire': return { name: 'Llama Intensa', description: 'Causa 50 daño extra al atacar a un objetivo.' };
      case 'water': return { name: 'Corriente Vital', description: 'Recupera 100 HP a sí misma.' };
      case 'grass': return { name: 'Esporas Debilitantes', description: 'Reduce en 30 el ataque de un enemigo.' };
      case 'electric': return { name: 'Impacto Eléctrico', description: 'Causa 150 daño directo al jugador rival.' };
      case 'psychic': return { name: 'Premonición', description: 'Roba una carta adicional.' };
      case 'fighting': return { name: 'Golpe Crítico', description: 'Aumenta el ataque en 30.' };
      case 'rock':
      case 'ground': return { name: 'Muro Natural', description: 'Aumenta la defensa propia en 50.' };
      case 'ghost':
      case 'dark': return { name: 'Sombra Maldita', description: 'Reduce la defensa rival.' };
      case 'dragon': return { name: 'Furia Ancestral', description: 'Gran ataque con auto-daño.' };
      case 'ice': return { name: 'Congelación', description: 'Congela a una carta rival (no puede atacar).' };
      case 'poison': return { name: 'Veneno', description: 'Causa 50 daño a un objetivo.' };
      case 'flying': return { name: 'Evasión', description: 'Activa modo defensa instantáneo.' };
      case 'bug': return { name: 'Enjambre', description: 'Aumenta ataque +30 si hay 2 o más cartas aliadas.' };
      case 'steel': return { name: 'Armadura Metálica', description: 'Aumenta defensa +70.' };
      case 'fairy': return { name: 'Bendición', description: 'Cura 80 HP a todas las cartas aliadas en campo.' };
      case 'normal':
      default: return { name: 'Impulso Básico', description: 'Aumenta el ataque en 30.' };
    }
  }
}
