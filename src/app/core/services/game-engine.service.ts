import { Injectable } from '@angular/core';
import { GameState } from '../models/game-state.model';
import { PokemonCard } from '../models/pokemon-card.model';
import { GameAction } from '../models/game-action.model';

@Injectable({
  providedIn: 'root'
})
export class GameEngineService {

  private cloneState(state: GameState): GameState {
    return structuredClone(state);
  }

  private getPlayerPair(state: GameState, playerId: string): {
    player: import('../models/player-state.model').PlayerState;
    opponent: import('../models/player-state.model').PlayerState;
    playerKey: 'player1' | 'player2';
    opponentKey: 'player1' | 'player2';
  } {
    if (state.player1.id === playerId) {
      return { player: state.player1, opponent: state.player2, playerKey: 'player1', opponentKey: 'player2' };
    }
    if (state.player2.id === playerId) {
      return { player: state.player2, opponent: state.player1, playerKey: 'player2', opponentKey: 'player1' };
    }
    throw new Error('Jugador no encontrado en el estado de partida.');
  }

  setPhase(state: GameState, phase: 'DRAW' | 'MAIN' | 'BATTLE' | 'END'): GameState {
    const next = this.cloneState(state);
    next.phase = phase;
    next.updatedAt = new Date().toISOString();
    return next;
  }

  initializeGame(
    player1Deck: PokemonCard[], 
    player2Deck: PokemonCard[], 
    mode: 'SOLO' | 'ONLINE', 
    options?: {
      player1Id?: string;
      player2Id?: string;
      player1Name?: string;
      player2Name?: string;
      player2IsComputer?: boolean;
    }
  ): GameState {
    if (!player1Deck || player1Deck.length < 20) {
      throw new Error('El mazo del jugador no tiene suficientes cartas (mínimo 20).');
    }
    if (!player2Deck || player2Deck.length < 20) {
      throw new Error('El mazo del oponente no tiene suficientes cartas (mínimo 20).');
    }

    const p1DeckShuffled = this.shuffleDeck([...player1Deck]);
    const p2DeckShuffled = this.shuffleDeck([...player2Deck]);

    p1DeckShuffled.forEach(c => { if (!c.instanceId) c.instanceId = crypto.randomUUID(); });
    p2DeckShuffled.forEach(c => { if (!c.instanceId) c.instanceId = crypto.randomUUID(); });

    const p1Id = options?.player1Id || (mode === 'SOLO' ? 'player' : 'p1');
    const p2Id = options?.player2Id || (mode === 'SOLO' ? 'computer' : 'p2');
    const p1Name = options?.player1Name || 'Jugador';
    const p2Name = options?.player2Name || (mode === 'SOLO' ? 'Computadora' : 'Oponente');
    const p2IsComputer = options?.player2IsComputer !== undefined ? options.player2IsComputer : (mode === 'SOLO');

    const state: GameState = {
      id: crypto.randomUUID(),
      mode,
      status: 'ACTIVE',
      phase: 'DRAW',
      currentTurnPlayerId: p1Id,
      turnNumber: 1,
      player1: {
        id: p1Id,
        username: p1Name,
        lifePoints: 500,
        maxLifePoints: 500,
        deck: p1DeckShuffled,
        hand: [],
        field: [],
        discardPile: [],
        hasSummonedThisTurn: false,
        isComputer: false
      },
      player2: {
        id: p2Id,
        username: p2Name,
        lifePoints: 500,
        maxLifePoints: 500,
        deck: p2DeckShuffled,
        hand: [],
        field: [],
        discardPile: [],
        hasSummonedThisTurn: false,
        isComputer: p2IsComputer
      },
      actionLog: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Initial draw (5 cards each)
    for(let i = 0; i < 5; i++) {
      this.drawCardInternal(state, p1Id);
      this.drawCardInternal(state, p2Id);
    }

    this.addActionLog(state, {
      id: crypto.randomUUID(),
      type: 'SYSTEM',
      playerId: 'SYSTEM',
      payload: {},
      message: `Partida iniciada. ¡Turno de ${p1Name}!`,
      createdAt: new Date().toISOString()
    });

    return state;
  }

  shuffleDeck(deck: PokemonCard[]): PokemonCard[] {
    const newDeck = [...deck];
    for (let i = newDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
  }

  private drawCardInternal(state: GameState, playerId: string) {
    const { player } = this.getPlayerPair(state, playerId);
    if (player.deck.length > 0) {
      const card = player.deck.pop();
      if (card) player.hand.push(card);
    }
  }

  drawCardPhase(state: GameState, playerId: string): GameState {
    const next = this.cloneState(state);
    if (next.status !== 'ACTIVE') throw new Error('La partida ya terminó.');
    if (next.phase !== 'DRAW') return next;
    if (next.currentTurnPlayerId !== playerId) return next;

    const { player, opponent } = this.getPlayerPair(next, playerId);
    
    if (player.deck.length === 0) {
      // Deck out = lose
      next.status = 'FINISHED';
      next.winnerId = opponent.id;
      next.resultReason = `${player.username} se ha quedado sin cartas en el mazo.`;
      return next;
    }

    this.drawCardInternal(next, playerId);
    
    this.addActionLog(next, {
      id: crypto.randomUUID(),
      type: 'DRAW',
      playerId,
      payload: {},
      message: `${player.username} ha robado una carta.`,
      createdAt: new Date().toISOString()
    });

    next.phase = 'MAIN';
    return next;
  }

  summonCard(state: GameState, playerId: string, cardInstanceId: string): GameState {
    const next = this.cloneState(state);
    if (next.status !== 'ACTIVE') throw new Error('La partida ya terminó.');
    if (next.currentTurnPlayerId !== playerId) throw new Error('No es tu turno.');
    if (next.phase !== 'MAIN') throw new Error('Solo puedes invocar cartas en tu fase MAIN.');
    
    const { player } = this.getPlayerPair(next, playerId);
    if (player.hasSummonedThisTurn) throw new Error('Ya has invocado una carta en este turno.');
    if (player.field.length >= 5) throw new Error('No hay espacio en tu campo de batalla.');

    const cardIndexInHand = player.hand.findIndex(c => c.instanceId === cardInstanceId);
    if (cardIndexInHand === -1) throw new Error('Carta no encontrada en la mano.');

    const card = player.hand[cardIndexInHand];
    player.hand.splice(cardIndexInHand, 1);
    
    const fieldCard = { ...card, hasAttacked: false, isDefending: false, hp: card.maxHp || card.hp, hasUsedAbility: false, isFrozen: false };
    player.field.push(fieldCard);
    player.hasSummonedThisTurn = true;

    this.addActionLog(next, {
      id: crypto.randomUUID(),
      type: 'SUMMON',
      playerId,
      payload: { cardId: fieldCard.id, instanceId: fieldCard.instanceId },
      message: `${player.username} ha invocado a ${fieldCard.name}.`,
      createdAt: new Date().toISOString()
    });

    return next;
  }

  setDefending(state: GameState, playerId: string, cardInstanceId: string): GameState {
    const next = this.cloneState(state);
    if (next.status !== 'ACTIVE') throw new Error('La partida ya terminó.');
    if (next.phase !== 'MAIN' || next.currentTurnPlayerId !== playerId) throw new Error('No puedes defender ahora.');
    
    const { player } = this.getPlayerPair(next, playerId);
    const card = player.field.find(c => c.instanceId === cardInstanceId);
    if (!card) throw new Error('Carta no encontrada en el campo.');

    card.isDefending = true;

    this.addActionLog(next, {
      id: crypto.randomUUID(),
      type: 'DEFEND',
      playerId,
      payload: { cardId: card.id, instanceId: card.instanceId },
      message: `${player.username} ha puesto a ${card.name} en modo defensa.`,
      createdAt: new Date().toISOString()
    });

    return next;
  }

  attackCard(state: GameState, playerId: string, attackerInstanceId: string, defenderInstanceId: string): GameState {
    const next = this.cloneState(state);
    if (next.status !== 'ACTIVE') throw new Error('La partida ya terminó.');
    if (next.currentTurnPlayerId !== playerId) throw new Error('No es tu turno.');
    if (next.phase !== 'BATTLE') throw new Error('Solo puedes atacar en la fase BATTLE.');

    const { player: attackerPlayer, opponent: defenderPlayer } = this.getPlayerPair(next, playerId);

    const attacker = attackerPlayer.field.find(c => c.instanceId === attackerInstanceId);
    if (!attacker) throw new Error('Carta atacante no encontrada.');
    if (attacker.hasAttacked) throw new Error('Esta carta ya atacó en este turno.');
    if (attacker.isFrozen) throw new Error('Esta carta está congelada y no puede atacar.');

    const defenderIndex = defenderPlayer.field.findIndex(c => c.instanceId === defenderInstanceId);
    if (defenderIndex === -1) throw new Error('Carta objetivo no encontrada.');
    const defender = defenderPlayer.field[defenderIndex];

    let damage = attacker.attack;
    if (defender.isDefending) {
      damage = Math.max(0, attacker.attack - defender.defense);
    }

    defender.hp -= damage;
    attacker.hasAttacked = true;

    this.addActionLog(next, {
      id: crypto.randomUUID(),
      type: 'ATTACK_CARD',
      playerId,
      payload: { attackerId: attacker.id, defenderId: defender.id, damage },
      message: `${attacker.name} ha atacado a ${defender.name} causando ${damage} de daño.`,
      createdAt: new Date().toISOString()
    });

    if (defender.hp <= 0) {
      defenderPlayer.field.splice(defenderIndex, 1);
      defenderPlayer.discardPile.push(defender);
      this.addActionLog(next, {
        id: crypto.randomUUID(),
        type: 'SYSTEM',
        playerId: 'SYSTEM',
        payload: { cardId: defender.id },
        message: `${defender.name} ha sido destruido.`,
        createdAt: new Date().toISOString()
      });
    }

    return this.checkAndApplyGameEnd(next);
  }

  attackPlayer(state: GameState, playerId: string, attackerInstanceId: string): GameState {
    const next = this.cloneState(state);
    if (next.status !== 'ACTIVE') throw new Error('La partida ya terminó.');
    if (next.currentTurnPlayerId !== playerId) throw new Error('No es tu turno.');
    if (next.phase !== 'BATTLE') throw new Error('Solo puedes atacar en la fase BATTLE.');

    const { player: attackerPlayer, opponent: defenderPlayer } = this.getPlayerPair(next, playerId);

    if (defenderPlayer.field.length > 0) {
      throw new Error('No puedes atacar directamente si el rival tiene cartas en el campo.');
    }

    const attacker = attackerPlayer.field.find(c => c.instanceId === attackerInstanceId);
    if (!attacker) throw new Error('Carta atacante no encontrada.');
    if (attacker.hasAttacked) throw new Error('Esta carta ya atacó en este turno.');
    if (attacker.isFrozen) throw new Error('Esta carta está congelada y no puede atacar.');

    const damage = attacker.attack;
    defenderPlayer.lifePoints = Math.max(0, defenderPlayer.lifePoints - damage);
    attacker.hasAttacked = true;

    this.addActionLog(next, {
      id: crypto.randomUUID(),
      type: 'ATTACK_PLAYER',
      playerId,
      payload: { attackerId: attacker.id, damage },
      message: `${attacker.name} ha atacado directamente a ${defenderPlayer.username} causando ${damage} de daño.`,
      createdAt: new Date().toISOString()
    });

    return this.checkAndApplyGameEnd(next);
  }

  activateAbility(state: GameState, playerId: string, cardInstanceId: string, targetInstanceId?: string): GameState {
    const next = this.cloneState(state);
    if (next.status !== 'ACTIVE') throw new Error('La partida ya terminó.');
    if (next.currentTurnPlayerId !== playerId) throw new Error('No es tu turno.');
    if (next.phase !== 'MAIN' && next.phase !== 'BATTLE') {
      throw new Error('Solo puedes usar habilidades en MAIN o BATTLE.');
    }
    
    const { player, opponent } = this.getPlayerPair(next, playerId);
    const card = player.field.find(c => c.instanceId === cardInstanceId);
    
    if (!card) throw new Error('La carta no está en tu campo.');
    if (card.hasUsedAbility) throw new Error('Esta carta ya usó su habilidad este turno.');

    const type = card.types[0]?.toLowerCase() || 'normal';
    let effectMessage = '';

    if (type === 'fire') {
      if (!targetInstanceId) throw new Error('Selecciona un objetivo rival para esta habilidad.');
      const targetIndex = opponent.field.findIndex(c => c.instanceId === targetInstanceId);
      if (targetIndex === -1) throw new Error('Objetivo rival no encontrado.');
      const target = opponent.field[targetIndex];
      
      target.hp -= 50;
      effectMessage = `causó 50 de daño extra a ${target.name}`;
      if (target.hp <= 0) {
        opponent.field.splice(targetIndex, 1);
        opponent.discardPile.push(target);
        effectMessage += ' (destruido)';
      }
    } else if (type === 'water') {
      card.hp = Math.min(card.maxHp, card.hp + 100);
      effectMessage = 'se curó 100 HP a sí misma';
    } else if (type === 'grass') {
      if (!targetInstanceId) throw new Error('Selecciona un objetivo rival para esta habilidad.');
      const target = opponent.field.find(c => c.instanceId === targetInstanceId);
      if (!target) throw new Error('Objetivo rival no encontrado.');
      
      target.attack = Math.max(10, target.attack - 30);
      effectMessage = `redujo en 30 el ataque de ${target.name}`;
    } else if (type === 'electric') {
      opponent.lifePoints = Math.max(0, opponent.lifePoints - 150);
      effectMessage = 'hizo 150 de daño directo al jugador rival';
    } else if (type === 'psychic') {
      this.drawCardInternal(next, playerId);
      effectMessage = 'robó una carta extra';
    } else if (type === 'rock' || type === 'ground') {
      card.defense += 50;
      effectMessage = 'aumentó su defensa en 50';
    } else if (type === 'poison') {
      if (!targetInstanceId) throw new Error('Selecciona un objetivo rival para esta habilidad.');
      const targetIndex = opponent.field.findIndex(c => c.instanceId === targetInstanceId);
      if (targetIndex === -1) throw new Error('Objetivo rival no encontrado.');
      const target = opponent.field[targetIndex];
      
      target.hp -= 50;
      effectMessage = `envenenó a ${target.name} (50 de daño)`;
      if (target.hp <= 0) {
        opponent.field.splice(targetIndex, 1);
        opponent.discardPile.push(target);
        effectMessage += ' (destruido)';
      }
    } else if (type === 'ice') {
      if (!targetInstanceId) throw new Error('Selecciona un objetivo rival para esta habilidad.');
      const target = opponent.field.find(c => c.instanceId === targetInstanceId);
      if (!target) throw new Error('Objetivo rival no encontrado.');
      
      target.isFrozen = true;
      effectMessage = `congeló a ${target.name}`;
    } else if (type === 'flying') {
      card.isDefending = true;
      effectMessage = 'se puso en modo defensa instantáneo';
    } else if (type === 'bug') {
      if (player.field.length >= 2) {
        card.attack += 30;
        effectMessage = 'aumentó su ataque en 30 por el enjambre';
      } else {
         throw new Error('Necesitas 2 o más cartas en el campo aliadas para usar Enjambre.');
      }
    } else if (type === 'steel') {
      card.defense += 70;
      effectMessage = 'aumentó su defensa en 70';
    } else if (type === 'fairy') {
      player.field.forEach(c => c.hp = Math.min(c.maxHp, c.hp + 80));
      effectMessage = 'curó 80 HP a todas las cartas aliadas en campo';
    } else {
      card.attack += 30;
      effectMessage = 'aumentó su ataque en 30';
    }

    card.hasUsedAbility = true;

    this.addActionLog(next, {
      id: crypto.randomUUID(),
      type: 'SYSTEM',
      playerId,
      payload: { cardId: card.id },
      message: `${player.username} usó la habilidad de ${card.name} y ${effectMessage}.`,
      createdAt: new Date().toISOString()
    });

    return this.checkAndApplyGameEnd(next);
  }

  endPhase(state: GameState, playerId: string): GameState {
    const next = this.cloneState(state);
    if (next.status !== 'ACTIVE') throw new Error('La partida ya terminó.');
    if (next.currentTurnPlayerId !== playerId) {
      throw new Error('No es tu turno.');
    }

    if (next.phase === 'DRAW') {
      next.phase = 'MAIN';
    } else if (next.phase === 'MAIN') {
      next.phase = 'BATTLE';
    } else if (next.phase === 'BATTLE') {
      next.phase = 'END';
    } else if (next.phase === 'END') {
      return this.endTurn(next);
    }

    next.updatedAt = new Date().toISOString();
    return next;
  }

  endTurn(state: GameState): GameState {
    const next = this.cloneState(state);
    if (next.status !== 'ACTIVE') throw new Error('La partida ya terminó.');
    const { player: currentPlayer, opponent: nextPlayer } = this.getPlayerPair(next, next.currentTurnPlayerId);
    
    // Clean up temporary states
    currentPlayer.hasSummonedThisTurn = false;
    currentPlayer.field.forEach(c => {
      c.hasAttacked = false;
      c.hasUsedAbility = false;
      c.isFrozen = false; // thaw
    });

    next.currentTurnPlayerId = nextPlayer.id;
    next.turnNumber++;
    next.phase = 'DRAW';
    
    this.addActionLog(next, {
      id: crypto.randomUUID(),
      type: 'END_TURN',
      playerId: currentPlayer.id,
      payload: {},
      message: `Fin del turno. ¡Turno de ${nextPlayer.username}!`,
      createdAt: new Date().toISOString()
    });

    return next;
  }
  
  forceEndTurn(state: GameState): GameState {
      return this.endTurn(state);
  }

  checkAndApplyGameEnd(state: GameState): GameState {
    if (state.player1.lifePoints <= 0) {
      state.player1.lifePoints = 0;
      state.status = 'FINISHED';
      state.winnerId = state.player2.id;
      state.loserId = state.player1.id;
      state.endedAt = new Date().toISOString();

      this.addActionLog(state, {
        id: crypto.randomUUID(),
        type: 'GAME_END',
        playerId: state.player2.id,
        payload: {
          winnerId: state.player2.id,
          loserId: state.player1.id,
          reason: 'PLAYER_LIFE_ZERO'
        },
        message: `${state.player2.username} ganó la partida. ${state.player1.username} llegó a 0 LP.`,
        createdAt: new Date().toISOString()
      });
    } else if (state.player2.lifePoints <= 0) {
      state.player2.lifePoints = 0;
      state.status = 'FINISHED';
      state.winnerId = state.player1.id;
      state.loserId = state.player2.id;
      state.endedAt = new Date().toISOString();

      this.addActionLog(state, {
        id: crypto.randomUUID(),
        type: 'GAME_END',
        playerId: state.player1.id,
        payload: {
          winnerId: state.player1.id,
          loserId: state.player2.id,
          reason: 'PLAYER_LIFE_ZERO'
        },
        message: `${state.player1.username} ganó la partida. ${state.player2.username} llegó a 0 LP.`,
        createdAt: new Date().toISOString()
      });
    }

    return state;
  }

  addActionLog(state: GameState, action: GameAction) {
    state.actionLog.unshift(action);
    if (state.actionLog.length > 50) {
      state.actionLog.pop();
    }
    state.updatedAt = new Date().toISOString();
  }
}
