import { Injectable } from '@angular/core';
import { GameState } from '../models/game-state.model';
import { GameEngineService } from './game-engine.service';
import { PokemonCard } from '../models/pokemon-card.model';

@Injectable({
  providedIn: 'root'
})
export class AiService {

  constructor(private engine: GameEngineService) {}

  async executeComputerTurn(state: GameState): Promise<GameState> {
    if (state.currentTurnPlayerId !== state.player2.id || state.status !== 'ACTIVE') {
      return state;
    }

    let next = state;

    try {
      next = this.engine.setPhase(next, 'DRAW');
      await this.delay(500);

      next = this.engine.drawCardPhase(next, state.player2.id);
      await this.delay(500);
      if (next.status !== 'ACTIVE') return next;

      next = this.engine.setPhase(next, 'MAIN');
      await this.delay(500);

      const cardToSummon = this.chooseBestCardToSummon(next.player2);
      if (cardToSummon?.instanceId && !next.player2.hasSummonedThisTurn && next.player2.field.length < 5) {
        next = this.engine.summonCard(next, state.player2.id, cardToSummon.instanceId);
        await this.delay(700);
        if (next.status !== 'ACTIVE') return next;
      }

      next = this.tryUseComputerAbility(next);
      await this.delay(500);

      if (next.status !== 'ACTIVE') return next;

      next = this.engine.setPhase(next, 'BATTLE');
      await this.delay(500);

      const attackers = [...next.player2.field].filter(card => !card.hasAttacked && !card.isFrozen);

      for (const attacker of attackers) {
        const currentAttacker = next.player2.field.find(c => c.instanceId === attacker.instanceId);
        if (!currentAttacker?.instanceId || currentAttacker.hasAttacked || currentAttacker.isFrozen) continue;

        if (next.player1.field.length > 0) {
          const target = this.chooseAttackTarget(next.player1, currentAttacker);
          if (target?.instanceId) {
            next = this.engine.attackCard(next, state.player2.id, currentAttacker.instanceId, target.instanceId);
          }
        } else {
          next = this.engine.attackPlayer(next, state.player2.id, currentAttacker.instanceId);
        }

        await this.delay(700);

        if (next.status !== 'ACTIVE') break;
      }

      if (next.status === 'ACTIVE') {
        next = this.engine.setPhase(next, 'END');
        await this.delay(400);
        next = this.engine.endTurn(next);
      }

      return next;
    } catch (error) {
      console.error('Error ejecutando IA:', error);
      return this.engine.forceEndTurn(next);
    }
  }

  chooseBestCardToSummon(player: any): PokemonCard | null {
    if (player.hand.length === 0) return null;
    let bestCard = player.hand[0];
    let bestScore = -1;
    player.hand.forEach((card: PokemonCard) => {
      const score = card.attack + card.defense + card.hp;
      if (score > bestScore) {
        bestCard = card;
        bestScore = score;
      }
    });
    return bestCard;
  }

  chooseAttackTarget(player: any, attacker: PokemonCard): PokemonCard | null {
    if (player.field.length === 0) return null;
    let target: PokemonCard | null = null;
    let canKillTarget = player.field.find((c: PokemonCard) => c.hp <= attacker.attack && !c.isDefending);
    if (canKillTarget) {
       target = canKillTarget;
    } else {
       target = player.field.reduce((prev: PokemonCard, curr: PokemonCard) => (prev.attack > curr.attack ? prev : curr));
    }
    return target;
  }

  tryUseComputerAbility(state: GameState): GameState {
    let next = state;
    for (let i = 0; i < next.player2.field.length; i++) {
      const card = next.player2.field[i];
      if (!card.hasUsedAbility && !card.hasAttacked && !card.isDefending && card.instanceId && next.status === 'ACTIVE') {
        const type = card.types[0]?.toLowerCase() || 'normal';
        const requiresTarget = ['fire', 'grass', 'poison', 'ice'].includes(type);
        
        if (requiresTarget && next.player1.field.length > 0) {
           let target = next.player1.field[0];
           if (type === 'fire' || type === 'poison') {
              target = next.player1.field.reduce((prev, curr) => (prev.hp < curr.hp ? prev : curr));
           } else {
              target = next.player1.field.reduce((prev, curr) => (prev.attack > curr.attack ? prev : curr));
           }

           if (target && target.instanceId) {
             try {
               next = this.engine.activateAbility(next, state.player2.id, card.instanceId, target.instanceId);
             } catch(e) {}
           }
        } else if (!requiresTarget) {
           if (type === 'water' && card.hp >= (card.maxHp || card.hp)) continue;
           try {
             next = this.engine.activateAbility(next, state.player2.id, card.instanceId);
           } catch(e) {}
        }
      }
    }
    return next;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
