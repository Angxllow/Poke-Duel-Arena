export interface GameAction {
  id: string;
  type: 'DRAW' | 'SUMMON' | 'ATTACK_CARD' | 'ATTACK_PLAYER' | 'ABILITY' | 'DEFEND' | 'DISCARD' | 'END_TURN' | 'SURRENDER' | 'SYSTEM' | 'GAME_END';
  playerId: string;
  payload: any;
  message: string;
  createdAt: string;
}
