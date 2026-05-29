import { GameMode } from './game-mode.model';

export interface MatchResult {
  id: string;
  matchId: string;
  mode: GameMode;
  winnerId?: string;
  loserId?: string;
  winnerName: string;
  loserName: string;
  resultReason: string;
  turnsPlayed: number;
  totalDamagePlayer1: number;
  totalDamagePlayer2: number;
  cardsUsedPlayer1: number;
  cardsUsedPlayer2: number;
  createdAt: string;
}
