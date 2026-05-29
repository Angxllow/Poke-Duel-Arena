import { PlayerState } from './player-state.model';
import { GameAction } from './game-action.model';

export interface GameState {
  id: string;
  mode: 'SOLO' | 'ONLINE';
  status: 'WAITING' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
  phase: 'DRAW' | 'MAIN' | 'BATTLE' | 'END';
  currentTurnPlayerId: string;
  turnNumber: number;
  player1: PlayerState;
  player2: PlayerState;
  actionLog: GameAction[];
  winnerId?: string;
  loserId?: string;
  resultReason?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}
