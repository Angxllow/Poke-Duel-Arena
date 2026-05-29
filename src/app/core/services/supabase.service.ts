import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { MatchResult } from '../models/match-result.model';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  get client(): SupabaseClient {
    return this.supabase;
  }

  async saveMatchResult(result: MatchResult, userId: string): Promise<void> {
    try {
      // 1. Insert Match Result (Trigger handles user_stats)
      await this.client.from('match_results').insert([{
        winner_id: result.winnerId === userId ? userId : null,
        loser_id: result.loserId === userId ? userId : null,
        mode: result.mode || 'SOLO',
        result_reason: result.resultReason,
        turns_played: result.turnsPlayed
      }]);
    } catch (error) {
      console.error('Failed to sync match to Supabase:', error);
    }
  }

  async getMatchHistory(userId: string): Promise<MatchResult[]> {
    try {
      const { data, error } = await this.client
        .from('match_results')
        .select('*')
        .or(`winner_id.eq.${userId},loser_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map(row => ({
        id: row.id,
        matchId: row.id,
        mode: row.mode as any,
        winnerId: row.winner_id,
        loserId: row.loser_id,
        winnerName: row.winner_id === userId ? 'Tú' : 'Oponente',
        loserName: row.loser_id === userId ? 'Tú' : 'Oponente',
        resultReason: row.result_reason,
        turnsPlayed: row.turns_played,
        totalDamagePlayer1: 0,
        totalDamagePlayer2: 0,
        cardsUsedPlayer1: 0,
        cardsUsedPlayer2: 0,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  }
}
