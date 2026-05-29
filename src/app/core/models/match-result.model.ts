import { GameMode } from './game-mode.model';
import { GameState } from './game-state.model';

export interface MatchResult {
  id: string;
  matchId: string;
  mode: GameMode;
  winnerId?: string | null;
  loserId?: string | null;
  winnerName: string;
  loserName: string;
  resultReason: string;
  turnsPlayed: number;
  totalDamagePlayer1?: number;
  totalDamagePlayer2?: number;
  cardsUsedPlayer1?: number;
  cardsUsedPlayer2?: number;
  createdAt: string;
  finalPlayerLife?: number;
  finalOpponentLife?: number;
  synced?: boolean;
  finalState?: GameState;
}
