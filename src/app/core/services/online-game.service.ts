import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { GameState } from '../models/game-state.model';
import { MatchResult } from '../models/match-result.model';
import { GameAction } from '../models/game-action.model';

@Injectable({
  providedIn: 'root'
})
export class OnlineGameService {

  constructor(private supabase: SupabaseService, private auth: AuthService) {}

  private checkAuth() {
    if (!this.auth.isAuthenticated) {
      throw new Error('Debes iniciar sesión para usar multijugador.');
    }
  }

  async createRoom(userId: string): Promise<any> {
    this.checkAuth();
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data, error } = await this.supabase.client
      .from('online_rooms')
      .insert([{ room_code: roomCode, player1_id: userId, status: 'WAITING' }])
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async joinRoom(roomCode: string, userId: string): Promise<any> {
    this.checkAuth();
    // 1. Get room
    const { data: room, error: getError } = await this.supabase.client
      .from('online_rooms')
      .select('*')
      .eq('room_code', roomCode)
      .single();

    if (getError || !room) throw new Error('Sala no encontrada');
    if (room.status !== 'WAITING') throw new Error('La sala no está disponible');
    if (room.player1_id === userId) throw new Error('Ya estás en esta sala');

    // 2. Join room
    const { data, error } = await this.supabase.client
      .from('online_rooms')
      .update({ player2_id: userId, status: 'ACTIVE' })
      .eq('id', room.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getRoom(roomId: string): Promise<any> {
    this.checkAuth();
    const { data, error } = await this.supabase.client
      .from('online_rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (error) throw error;
    return data;
  }

  listenToRoom(roomId: string, callback: (payload: any) => void) {
    let fallbackInterval: any;
    
    const channel = this.supabase.client.channel(`room_${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_rooms', filter: `id=eq.${roomId}` }, payload => {
        callback(payload.new);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime falló en online_rooms, iniciando polling...');
          fallbackInterval = setInterval(async () => {
            const { data } = await this.supabase.client.from('online_rooms').select('*').eq('id', roomId).single();
            if (data) callback(data);
          }, 3000);
        }
      });
      
    return {
      unsubscribe: () => {
        if (fallbackInterval) clearInterval(fallbackInterval);
        this.supabase.client.removeChannel(channel);
      }
    };
  }

  listenToGameState(roomId: string, callback: (payload: any) => void) {
    let fallbackInterval: any;
    
    const channel = this.supabase.client.channel(`game_${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_game_states', filter: `room_id=eq.${roomId}` }, payload => {
        callback(payload.new);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime falló en online_game_states, iniciando polling...');
          fallbackInterval = setInterval(async () => {
            const { data } = await this.supabase.client.from('online_game_states').select('*').eq('room_id', roomId).single();
            if (data) callback(data);
          }, 3000);
        }
      });
      
    return {
      unsubscribe: () => {
        if (fallbackInterval) clearInterval(fallbackInterval);
        this.supabase.client.removeChannel(channel);
      }
    };
  }

  async updateGameState(roomId: string, gameState: GameState): Promise<void> {
    this.checkAuth();
    if (!roomId) return;
    const { error } = await this.supabase.client
      .from('online_game_states')
      .upsert({ room_id: roomId, state: gameState, updated_at: new Date().toISOString() }, { onConflict: 'room_id' });
      
    if (error) throw error;
  }

  async sendAction(roomId: string, action: GameAction, playerId: string): Promise<void> {
    this.checkAuth();
    if (!roomId || !playerId) return;
    const { error } = await this.supabase.client
      .from('match_actions')
      .insert([{ room_id: roomId, player_id: playerId, action_type: action.type, action_payload: action.payload }]);
      
    if (error) throw error;
  }

  async finishOnlineMatch(roomId: string, result: MatchResult): Promise<void> {
    this.checkAuth();
    if (!roomId) return;
    const { error } = await this.supabase.client
      .from('match_results')
      .insert([{ 
        winner_id: result.winnerId, 
        loser_id: result.loserId, 
        mode: result.mode || 'ONLINE', 
        result_reason: result.resultReason, 
        turns_played: result.turnsPlayed 
      }]);
      
    if (error) throw error;

    await this.supabase.client
      .from('online_rooms')
      .update({ status: 'FINISHED' })
      .eq('id', roomId);
      
    // Stats son manejadas automáticamente por el trigger de base de datos
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    this.checkAuth();
    await this.supabase.client
      .from('online_rooms')
      .update({ status: 'ABANDONED' })
      .eq('id', roomId);
  }
}
