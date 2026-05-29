import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { GameEngineService } from '../../core/services/game-engine.service';
import { AiService } from '../../core/services/ai.service';
import { SqliteService } from '../../core/services/sqlite.service';
import { PokeapiService } from '../../core/services/pokeapi.service';
import { CardTransformerService } from '../../core/services/card-transformer.service';
import { DeckService } from '../../core/services/deck.service';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { HistoryService } from '../../core/services/history.service';
import { GameState } from '../../core/models/game-state.model';
import { Deck } from '../../core/models/deck.model';
import { PokemonCard } from '../../core/models/pokemon-card.model';
import { Battlefield } from '../../shared/components/battlefield/battlefield';
import { Hand } from '../../shared/components/hand/hand';
import { PlayerPanel } from '../../shared/components/player-panel/player-panel';
import { ActionLog } from '../../shared/components/action-log/action-log';
import { TurnIndicator } from '../../shared/components/turn-indicator/turn-indicator';

@Component({
  selector: 'app-solo-game',
  standalone: true,
  imports: [CommonModule, RouterLink, Battlefield, Hand, PlayerPanel, ActionLog, TurnIndicator],
  templateUrl: './solo-game.html',
  styleUrl: './solo-game.css'
})
export class SoloGame implements OnInit {
  gameState: GameState | null = null;
  errorMessage: string | null = null;
  selectedCardIndex: number | null = null;
  
  availableDecks: Deck[] = [];
  selectedDeck: Deck | null = null;
  
  loadingDecks = false;
  startingGame = false;
  generatingDeck = false;
  gameStarted = false;
  resultSaved = false;

  successMessage: string | null = null;

  constructor(
    private engine: GameEngineService,
    private ai: AiService,
    private sqlite: SqliteService,
    private router: Router,
    private pokeapi: PokeapiService,
    private transformer: CardTransformerService,
    private deckService: DeckService,
    private auth: AuthService,
    private supabase: SupabaseService,
    private historyService: HistoryService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadAvailableDecks();
  }

  async loadAvailableDecks(): Promise<void> {
    this.loadingDecks = true;
    this.errorMessage = '';

    try {
      this.availableDecks = await this.deckService.getAllAvailableDecks();

      if (this.availableDecks.length > 0) {
        const activeDeck = this.availableDecks.find(deck => deck.isActive);
        this.selectedDeck = activeDeck ?? this.availableDecks[0];
      } else {
        this.selectedDeck = null;
      }
    } catch (error) {
      console.error('Error cargando mazos:', error);
      this.errorMessage = 'No se pudieron cargar los mazos.';
      this.availableDecks = [];
      this.selectedDeck = null;
    } finally {
      this.loadingDecks = false;
    }
  }

  selectDeck(deck: Deck): void {
    this.selectedDeck = deck;
    this.successMessage = `Mazo seleccionado: ${deck.name}`;
    setTimeout(() => this.successMessage = null, 3000);
  }

  async generateQuickDeck(): Promise<void> {
    this.generatingDeck = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const deck = await this.createQuickDeckAndReturn();

      this.selectedDeck = deck;
      await this.loadAvailableDecks();

      this.selectedDeck = this.availableDecks.find(d => d.id === deck.id) ?? deck;
      this.successMessage = 'Mazo rápido generado correctamente.';
      setTimeout(() => this.successMessage = null, 3000);
    } catch (error) {
      console.error('Error generando mazo rápido:', error);
      this.errorMessage = 'No se pudo generar el mazo rápido.';
    } finally {
      this.generatingDeck = false;
    }
  }

  async createQuickDeckAndReturn(): Promise<Deck> {
    let cards = await this.deckService.getAvailableCards();

    if (!cards || cards.length < 20) {
      try {
        const result = await this.pokeapi.loadPokemonCardsPage(30, 0);
        cards = result.cards;
      } catch (error) {
        console.error('Error cargando PokeAPI para mazo rápido:', error);
        cards = [];
      }
    }

    if (!cards || cards.length < 20) {
      cards = this.deckService.getDemoCards();
    }

    if (!cards || cards.length < 20) {
      throw new Error('No hay suficientes cartas para generar un mazo.');
    }

    const deck = this.deckService.createQuickDeck(cards, 40);
    await this.deckService.saveActiveDeckLocal(deck);

    return deck;
  }

  async startGame(): Promise<void> {
    this.startingGame = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.resultSaved = false;

    try {
      let deckToUse = this.selectedDeck;

      if (!deckToUse) {
        deckToUse = await this.deckService.getActiveDeckLocal();
      }

      if (!deckToUse || !deckToUse.cards || deckToUse.cards.length < 20) {
        deckToUse = await this.createQuickDeckAndReturn();
        await this.loadAvailableDecks();
        this.selectedDeck = deckToUse;
      }

      if (!deckToUse || deckToUse.cards.length < 20) {
        throw new Error('Selecciona o genera un mazo válido de al menos 20 cartas.');
      }

      const computerDeck = await this.deckService.generateComputerDeck();

      this.gameState = this.engine.initializeGame(
        deckToUse.cards,
        computerDeck.cards,
        'SOLO',
        {
          player1Name: 'Jugador',
          player2Name: 'Computadora',
          player2IsComputer: true
        }
      );

      this.gameStarted = true;
      this.successMessage = 'Partida iniciada correctamente.';
      setTimeout(() => this.successMessage = null, 3000);
    } catch (error) {
      console.error('Error iniciando partida:', error);
      this.errorMessage = error instanceof Error ? error.message : 'No se pudo iniciar la partida.';
    } finally {
      this.startingGame = false;
    }
  }

  selectedHandCard: PokemonCard | null = null;
  selectedAttackerCard: PokemonCard | null = null;
  selectedTargetCard: PokemonCard | null = null;
  selectedAbilityCard: PokemonCard | null = null;
  selectedAbilityTarget: PokemonCard | null = null;
  selectedDefenseCard: PokemonCard | null = null;

  computerThinking = false;

  get isPlayerTurn(): boolean {
    return !!this.gameState && 
           this.gameState.status === 'ACTIVE' && 
           this.gameState.currentTurnPlayerId === this.gameState.player1.id && 
           !this.computerThinking;
  }

  get isComputerTurn(): boolean {
    return !!this.gameState && 
           this.gameState.status === 'ACTIVE' && 
           this.gameState.currentTurnPlayerId === this.gameState.player2.id;
  }

  opponentHasCards(): boolean {
    return !!this.gameState && this.gameState.player2.field.length > 0;
  }

  clearSelection(): void {
    this.selectedHandCard = null;
    this.selectedAttackerCard = null;
    this.selectedTargetCard = null;
    this.selectedAbilityCard = null;
    this.selectedAbilityTarget = null;
    this.selectedDefenseCard = null;
    this.errorMessage = null;
  }

  selectHandCard(card: PokemonCard): void {
    if (!this.isPlayerTurn || this.gameState?.phase !== 'MAIN') return;
    this.clearSelection();
    this.selectedHandCard = card;
  }

  selectPlayerFieldCard(card: PokemonCard): void {
    if (!this.isPlayerTurn) return;
    
    if (this.gameState?.phase === 'MAIN') {
      this.clearSelection();
      this.selectedDefenseCard = card;
      this.selectedAbilityCard = card; // Allow it to be used for ability
    } else if (this.gameState?.phase === 'BATTLE') {
      if (this.selectedAttackerCard?.instanceId === card.instanceId) {
        this.selectedAttackerCard = null;
      } else {
        this.selectedAttackerCard = card;
      }
    }
  }

  selectOpponentFieldCard(card: PokemonCard): void {
    if (!this.isPlayerTurn) return;

    if (!card?.instanceId) {
      return;
    }

    if (this.selectedAbilityCard) {
      this.selectedAbilityTarget = card;
      this.successMessage = `Objetivo de habilidad seleccionado: ${card.name}`;
      setTimeout(() => this.successMessage = null, 3000);
      return;
    }

    if (this.gameState?.phase === 'BATTLE' && this.selectedAttackerCard) {
      this.selectedTargetCard = card;
      this.successMessage = `Objetivo seleccionado: ${card.name}`;
      setTimeout(() => this.successMessage = null, 3000);
    }
  }

  // Event handlers from the original layout
  onHandCardSelect(card: PokemonCard) {
    if (!this.gameState) return;
    this.selectHandCard(card);
  }

  onPlayerCardClick(card: PokemonCard) {
    if (!this.gameState) return;
    this.selectPlayerFieldCard(card);
  }

  onOpponentCardClick(card: PokemonCard) {
    if (!this.gameState) return;
    this.selectOpponentFieldCard(card);
  }

  onPlayerAbilityClick(card: PokemonCard) {
    if (!this.gameState) return;
    this.startAbilityMode(card);
  }

  onOpponentDirectAttack() {
    if (!this.gameState || !this.isPlayerTurn || this.gameState.phase !== 'BATTLE') return;
    if (this.selectedAttackerCard && this.opponentHasCards() === false) {
      this.attackDirectly();
    }
  }

  private getOwnFieldCard(instanceId: string | null): PokemonCard | null {
    if (!this.gameState || !instanceId) return null;
    return this.gameState.player1.field.find(card => card.instanceId === instanceId) ?? null;
  }

  private getOpponentFieldCard(instanceId: string | null): PokemonCard | null {
    if (!this.gameState || !instanceId) return null;
    return this.gameState.player2.field.find(card => card.instanceId === instanceId) ?? null;
  }

  private abilityNeedsTarget(card: PokemonCard): boolean {
    const type = (card.abilityType || card.types[0] || 'normal').toLowerCase();
    return ['fire', 'grass', 'poison', 'ice'].includes(type);
  }

  startAbilityMode(card?: PokemonCard): void {
    if (!this.isPlayerTurn) {
      this.errorMessage = 'Es turno de la computadora. Espera.';
      return;
    }

    const selected = card ?? this.selectedAttackerCard ?? this.selectedDefenseCard;

    if (!selected) {
      this.errorMessage = 'Selecciona una carta de tu campo para usar habilidad.';
      return;
    }

    this.selectedAbilityCard = selected;
    this.errorMessage = null;
    
    if (this.abilityNeedsTarget(selected)) {
      this.successMessage = `Habilidad lista: ${selected.abilityName}. Selecciona un objetivo rival.`;
    } else {
      this.successMessage = `Habilidad lista: ${selected.abilityName}. Clickea "Usar habilidad" de nuevo.`;
    }
    setTimeout(() => this.successMessage = null, 3000);
  }

  private async afterStateChange(): Promise<void> {
    await this.checkGameEnd();
    this.saveState();

    if (this.gameState?.status === 'ACTIVE' && this.isComputerTurn) {
      await this.runComputerTurnIfNeeded();
    }
  }

  // --- Actions ---

  async drawCard() {
    if (!this.gameState || !this.isPlayerTurn || this.gameState.phase !== 'DRAW') return;
    this.gameState = this.engine.drawCardPhase(this.gameState, this.gameState.player1.id);
    await this.afterStateChange();
  }

  async summonSelectedCard(): Promise<void> {
    if (!this.gameState || !this.selectedHandCard || !this.selectedHandCard.instanceId) {
      this.errorMessage = 'Selecciona una carta de tu mano para invocar.';
      return;
    }
    if (!this.isPlayerTurn) {
      this.errorMessage = 'Es turno de la computadora. Espera.';
      return;
    }

    try {
      this.gameState = this.engine.summonCard(this.gameState, this.gameState.player1.id, this.selectedHandCard.instanceId);
      this.clearSelection();
      await this.afterStateChange();
    } catch (error: any) {
      this.errorMessage = error.message;
    }
  }

  async defendWithSelectedCard(): Promise<void> {
    if (!this.gameState || !this.selectedDefenseCard || !this.selectedDefenseCard.instanceId) {
      this.errorMessage = 'Selecciona una carta de tu campo para defender.';
      return;
    }
    if (!this.isPlayerTurn) {
      this.errorMessage = 'Es turno de la computadora. Espera.';
      return;
    }

    try {
      this.gameState = this.engine.setDefending(this.gameState, this.gameState.player1.id, this.selectedDefenseCard.instanceId);
      this.clearSelection();
      await this.afterStateChange();
    } catch (error: any) {
      this.errorMessage = error.message;
    }
  }

  async activateSelectedAbility(): Promise<void> {
    if (!this.isPlayerTurn) {
      this.errorMessage = 'Es turno de la computadora. Espera.';
      return;
    }

    if (!this.gameState || !this.selectedAbilityCard || !this.selectedAbilityCard.instanceId) {
      this.errorMessage = 'Selecciona una carta de tu campo para usar su habilidad.';
      return;
    }

    const abilityCard = this.getOwnFieldCard(this.selectedAbilityCard.instanceId);

    if (!abilityCard) {
      this.errorMessage = 'La carta seleccionada ya no está en tu campo.';
      return;
    }

    const needsTarget = this.abilityNeedsTarget(abilityCard);

    if (needsTarget && !this.selectedAbilityTarget) {
      this.errorMessage = 'Selecciona un objetivo rival para esta habilidad.';
      return;
    }

    try {
      this.gameState = this.engine.activateAbility(
        this.gameState, 
        this.gameState.player1.id, 
        this.selectedAbilityCard.instanceId, 
        this.selectedAbilityTarget?.instanceId
      );
      this.clearSelection();
      await this.afterStateChange();
    } catch (error: any) {
      this.errorMessage = error.message;
    }
  }

  async attackSelectedTarget(): Promise<void> {
    if (!this.gameState || !this.selectedAttackerCard || !this.selectedTargetCard || !this.selectedAttackerCard.instanceId || !this.selectedTargetCard.instanceId) {
      this.errorMessage = 'Selecciona una carta atacante y un objetivo rival.';
      return;
    }
    if (!this.isPlayerTurn) {
      this.errorMessage = 'Es turno de la computadora. Espera.';
      return;
    }

    try {
      this.gameState = this.engine.attackCard(
        this.gameState, 
        this.gameState.player1.id, 
        this.selectedAttackerCard.instanceId, 
        this.selectedTargetCard.instanceId
      );
      this.clearSelection();
      await this.afterStateChange();
    } catch (error: any) {
      this.errorMessage = error.message;
    }
  }

  async attackDirectly(): Promise<void> {
    if (!this.gameState || !this.selectedAttackerCard || !this.selectedAttackerCard.instanceId) {
      this.errorMessage = 'Selecciona una carta atacante.';
      return;
    }
    if (!this.isPlayerTurn) {
      this.errorMessage = 'Es turno de la computadora. Espera.';
      return;
    }

    try {
      this.gameState = this.engine.attackPlayer(this.gameState, this.gameState.player1.id, this.selectedAttackerCard.instanceId);
      this.clearSelection();
      await this.afterStateChange();
    } catch (error: any) {
      this.errorMessage = error.message;
    }
  }

  async onNextPhase() {
    await this.endCurrentPhase();
  }

  async endCurrentPhase() {
    if (!this.gameState || !this.isPlayerTurn) {
      this.errorMessage = 'Es turno de la computadora. Espera.';
      return;
    }
    
    this.clearSelection();
    this.gameState = this.engine.endPhase(this.gameState, this.gameState.player1.id);
    await this.afterStateChange();
  }

  async endPlayerTurn() {
    if (!this.gameState || !this.isPlayerTurn) {
      this.errorMessage = 'Es turno de la computadora. Espera.';
      return;
    }

    this.clearSelection();

    try {
      if (this.gameState.phase !== 'END') {
        this.gameState = this.engine.setPhase(this.gameState, 'END');
      }
      this.gameState = this.engine.endTurn(this.gameState);
      await this.afterStateChange();
    } catch (error: any) {
      this.errorMessage = error.message || 'No se pudo terminar el turno.';
    }
  }

  private async runComputerTurnIfNeeded(): Promise<void> {
    if (!this.gameState || this.gameState.status !== 'ACTIVE') return;
    if (!this.isComputerTurn) return;
    if (this.computerThinking) return;

    this.computerThinking = true;
    this.clearSelection();

    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      this.gameState = await this.ai.executeComputerTurn(this.gameState);
      this.checkGameEnd();
      this.saveState();
    } catch (error) {
      console.error('Error en turno de computadora:', error);
      this.errorMessage = 'La computadora no pudo completar su turno.';
      if (this.gameState && this.isComputerTurn) {
        this.gameState = this.engine.forceEndTurn(this.gameState);
      }
    } finally {
      this.computerThinking = false;
    }
  }

  checkGameEnd(): Promise<void> {
    if (!this.gameState) return Promise.resolve();

    if (this.gameState.player1.lifePoints <= 0) {
      this.gameState.player1.lifePoints = 0;
      this.gameState.status = 'FINISHED';
      this.gameState.winnerId = this.gameState.player2.id;
      this.gameState.loserId = this.gameState.player1.id;
      this.gameState.endedAt = new Date().toISOString();
    }

    if (this.gameState.player2.lifePoints <= 0) {
      this.gameState.player2.lifePoints = 0;
      this.gameState.status = 'FINISHED';
      this.gameState.winnerId = this.gameState.player1.id;
      this.gameState.loserId = this.gameState.player2.id;
      this.gameState.endedAt = new Date().toISOString();
    }

    if (this.gameState.status === 'FINISHED' && !this.resultSaved) {
      this.resultSaved = true;
      return this.saveMatchResult();
    }
    return Promise.resolve();
  }

  private async saveMatchResult(): Promise<void> {
    if (!this.gameState || !this.gameState.winnerId || !this.gameState.loserId) {
      return;
    }

    const winner =
      this.gameState.winnerId === this.gameState.player1.id
        ? this.gameState.player1
        : this.gameState.player2;

    const loser =
      this.gameState.loserId === this.gameState.player1.id
        ? this.gameState.player1
        : this.gameState.player2;

    const result = {
      id: crypto.randomUUID(),
      matchId: this.gameState.id,
      mode: 'SOLO' as const,
      winnerId: winner.id,
      loserId: loser.id,
      winnerName: winner.username,
      loserName: loser.username,
      resultReason: 'PLAYER_LIFE_ZERO',
      turnsPlayed: this.gameState.turnNumber ?? 0,
      createdAt: new Date().toISOString(),
      finalPlayerLife: Math.max(0, this.gameState.player1.lifePoints),
      finalOpponentLife: Math.max(0, this.gameState.player2.lifePoints),
      synced: false,
      finalState: this.gameState
    };

    try {
      await this.historyService.saveMatchResult(result);
      this.successMessage = `Partida terminada. Ganador: ${winner.username}.`;
    } catch (error) {
      console.error('Error guardando resultado:', error);
      this.errorMessage = 'La partida terminó, pero no se pudo guardar el resultado.';
    }
  }

  getWinnerName(): string {
    if (!this.gameState?.winnerId) return '';

    if (this.gameState.winnerId === this.gameState.player1.id) {
      return this.gameState.player1.username;
    }

    if (this.gameState.winnerId === this.gameState.player2.id) {
      return this.gameState.player2.username;
    }

    return '';
  }

  startNewGame(): void {
    this.gameState = null;
    this.gameStarted = false;
    this.resultSaved = false;
    this.clearSelection();
  }

  saveState() {
    if (this.gameState) {
      this.sqlite.saveSoloMatch(this.gameState);
    }
  }
}
