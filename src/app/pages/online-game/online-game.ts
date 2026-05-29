import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GameEngineService } from '../../core/services/game-engine.service';
import { OnlineGameService } from '../../core/services/online-game.service';
import { AuthService } from '../../core/services/auth.service';
import { SqliteService } from '../../core/services/sqlite.service';
import { GameState } from '../../core/models/game-state.model';
import { Battlefield } from '../../shared/components/battlefield/battlefield';
import { Hand } from '../../shared/components/hand/hand';
import { PlayerPanel } from '../../shared/components/player-panel/player-panel';
import { ActionLog } from '../../shared/components/action-log/action-log';
import { TurnIndicator } from '../../shared/components/turn-indicator/turn-indicator';
import { PokemonCard } from '../../core/models/pokemon-card.model';

@Component({
  selector: 'app-online-game',
  standalone: true,
  imports: [CommonModule, Battlefield, Hand, PlayerPanel, ActionLog, TurnIndicator],
  templateUrl: './online-game.html',
  styleUrl: './online-game.css'
})
export class OnlineGame implements OnInit, OnDestroy {
  gameState: GameState | null = null;
  errorMessage: string | null = null;
  selectedAttackerCardId: string | null = null;
  
  roomId: string = '';
  room: any = null;
  currentUser: any = null;
  myPlayerId: 'p1' | 'p2' = 'p1';
  opponentPlayerId: 'p1' | 'p2' = 'p2';
  
  gameChannel: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private engine: GameEngineService,
    private onlineService: OnlineGameService,
    private auth: AuthService,
    private sqlite: SqliteService
  ) {}

  async ngOnInit() {
    this.roomId = this.route.snapshot.paramMap.get('roomCode') || '';
    if (!this.roomId) {
      this.router.navigate(['/online-lobby']);
      return;
    }

    this.currentUser = await this.auth.getProfile();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      this.room = await this.onlineService.getRoom(this.roomId);
      
      if (this.room.player1_id === this.currentUser.id) {
        this.myPlayerId = 'p1';
        this.opponentPlayerId = 'p2';
      } else if (this.room.player2_id === this.currentUser.id) {
        this.myPlayerId = 'p2';
        this.opponentPlayerId = 'p1';
      } else {
        throw new Error('No perteneces a esta sala.');
      }

      // If player 1, check if we need to initialize state
      if (this.myPlayerId === 'p1') {
        // Wait, actually both players need their decks.
        // For simplicity in this demo, if there is no state, we initialize it
        // We will just fetch our active deck.
        const decks = await this.sqlite.getTemporaryDecks() || [];
        const activeDeck = decks.find(d => d.isActive);
        if (!activeDeck) throw new Error('Necesitas un mazo activo.');

        // Initialize state if not exists
        // We should check if state exists first. In a full app we'd fetch it.
        // For now, assume player1 creates it.
        const initialState = this.engine.initializeGame(
          activeDeck.cards, 
          activeDeck.cards, 
          'ONLINE', 
          {
            player1Id: 'p1',
            player2Id: 'p2',
            player1Name: this.currentUser.username,
            player2Name: 'Oponente',
            player2IsComputer: false
          }
        );
        await this.onlineService.updateGameState(this.roomId, initialState);
        this.gameState = initialState;
      }

      // Listen to changes
      this.gameChannel = this.onlineService.listenToGameState(this.roomId, (payload) => {
        if (payload && payload.state) {
          this.gameState = payload.state;
          this.checkGameEnd();
        }
      });

    } catch(e: any) {
      this.errorMessage = e.message;
    }
  }

  ngOnDestroy() {
    if (this.gameChannel) {
      this.gameChannel.unsubscribe();
    }
  }

  get isMyTurn() {
    return this.gameState?.currentTurnPlayerId === this.myPlayerId;
  }

  get myPlayer() {
    return this.myPlayerId === 'p1' ? this.gameState?.player1 : this.gameState?.player2;
  }

  get opponentPlayer() {
    return this.opponentPlayerId === 'p1' ? this.gameState?.player1 : this.gameState?.player2;
  }

  // --- Actions ---

  drawCard() {
    if (!this.gameState || !this.isMyTurn || this.gameState.phase !== 'DRAW') return;
    this.gameState = this.engine.drawCardPhase(this.gameState, this.myPlayerId);
    this.syncState();
  }

  onHandCardSelect(card: PokemonCard) {
    if (!this.gameState || !this.isMyTurn || this.gameState.phase !== 'MAIN') return;
    if (card?.instanceId) {
      try {
        this.gameState = this.engine.summonCard(this.gameState, this.myPlayerId, card.instanceId);
        this.syncState();
      } catch(e) {}
    }
  }

  onPlayerCardClick(card: PokemonCard) {
    if (!this.gameState || !this.isMyTurn) return;
    
    if (!card || !card.instanceId) return;

    if (this.gameState.phase === 'MAIN') {
      try {
        this.gameState = this.engine.setDefending(this.gameState, this.myPlayerId, card.instanceId);
        this.syncState();
      } catch(e) {}
    } else if (this.gameState.phase === 'BATTLE') {
      if (!card.hasAttacked) {
        this.selectedAttackerCardId = card.instanceId ?? null;
      }
    }
  }

  onPlayerAbilityClick(card: PokemonCard) {
    if (!this.gameState || !this.isMyTurn || this.gameState.phase !== 'MAIN') return;
    if (card?.instanceId) {
      try {
        this.gameState = this.engine.activateAbility(this.gameState, this.myPlayerId, card.instanceId);
        this.syncState();
      } catch(e) {}
    }
  }

  onOpponentCardClick(defender: PokemonCard) {
    if (!this.gameState || !this.isMyTurn || this.gameState.phase !== 'BATTLE') return;
    if (!this.selectedAttackerCardId) return;

    if (this.selectedAttackerCardId && defender?.instanceId) {
      try {
        this.gameState = this.engine.attackCard(this.gameState, this.myPlayerId, this.selectedAttackerCardId, defender.instanceId);
        this.selectedAttackerCardId = null;
        this.syncState();
        this.checkGameEnd();
      } catch(e) {}
    }
  }

  onOpponentDirectAttack() {
    if (!this.gameState || !this.isMyTurn || this.gameState.phase !== 'BATTLE') return;
    if (!this.selectedAttackerCardId) return;
    
    const oppField = this.opponentPlayerId === 'p1' ? this.gameState.player1.field : this.gameState.player2.field;
    if (oppField.length > 0) return;

    if (this.selectedAttackerCardId) {
      try {
        this.gameState = this.engine.attackPlayer(this.gameState, this.myPlayerId, this.selectedAttackerCardId);
        this.selectedAttackerCardId = null;
        this.syncState();
        this.checkGameEnd();
      } catch(e) {}
    }
  }

  onNextPhase() {
    if (!this.gameState || !this.isMyTurn) return;
    
    this.selectedAttackerCardId = null;
    this.gameState = this.engine.endPhase(this.gameState, this.myPlayerId);
    this.syncState();
  }

  async syncState() {
    if (this.gameState) {
      try {
        await this.onlineService.updateGameState(this.roomId, this.gameState);
      } catch (e) {
        console.error('Error syncing state', e);
      }
    }
  }

  async checkGameEnd() {
    if (!this.gameState) return;
    if (this.gameState.status === 'FINISHED') {
      
      if (this.isMyTurn) { // Only the active player triggers the finish match process
        const result = {
          id: crypto.randomUUID(),
          matchId: this.gameState.id,
          mode: this.gameState.mode,
          winnerId: this.gameState.winnerId,
          loserId: this.gameState.winnerId === 'p1' ? 'p2' : 'p1',
          winnerName: this.gameState.winnerId === 'p1' ? this.gameState.player1.username : this.gameState.player2.username,
          loserName: this.gameState.winnerId === 'p1' ? this.gameState.player2.username : this.gameState.player1.username,
          resultReason: this.gameState.resultReason || 'Puntos de vida agotados.',
          turnsPlayed: this.gameState.turnNumber,
          totalDamagePlayer1: 0,
          totalDamagePlayer2: 0,
          cardsUsedPlayer1: 0,
          cardsUsedPlayer2: 0,
          createdAt: new Date().toISOString()
        };
        
        await this.onlineService.finishOnlineMatch(this.roomId, result);
        this.router.navigate(['/result', result.id]);
      } else {
        // Just navigate for the other player
        setTimeout(() => {
          this.router.navigate(['/history']);
        }, 3000);
      }
    }
  }
}
