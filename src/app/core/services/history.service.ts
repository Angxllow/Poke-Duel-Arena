import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { MatchResult } from '../models/match-result.model';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private readonly LOCAL_RESULTS_KEY = 'pokeduel_match_results';

  constructor(
    private authService: AuthService,
    private supabase: SupabaseService
  ) {}

  async saveMatchResult(result: MatchResult): Promise<void> {
    await this.saveMatchResultLocal(result);

    try {
      await this.saveMatchResultRemote(result);
    } catch (error) {
      console.warn('No se pudo sincronizar resultado con Supabase. Se conservó localmente.', error);
    }
  }

  private async saveMatchResultLocal(result: MatchResult): Promise<void> {
    const current = this.getLocalResultsSync();

    const exists = current.some(item => item.id === result.id || item.matchId === result.matchId);

    const updated = exists
      ? current.map(item => item.id === result.id || item.matchId === result.matchId ? result : item)
      : [result, ...current];

    localStorage.setItem(this.LOCAL_RESULTS_KEY, JSON.stringify(updated));
  }

  private async saveMatchResultRemote(result: MatchResult): Promise<void> {
    const user = await this.authService.getCurrentUser();

    if (!user) {
      return;
    }

    let winnerId: string | null = null;
    let loserId: string | null = null;

    const humanWon =
      result.winnerId === 'player' ||
      result.winnerName.toLowerCase().includes('jugador') ||
      result.winnerName.toLowerCase().includes(user.email?.split('@')[0]?.toLowerCase() || '');

    const humanLost =
      result.loserId === 'player' ||
      result.loserName.toLowerCase().includes('jugador') ||
      result.loserName.toLowerCase().includes(user.email?.split('@')[0]?.toLowerCase() || '');

    if (humanWon) {
      winnerId = user.id;
      loserId = null;
    } else if (humanLost) {
      winnerId = null;
      loserId = user.id;
    } else {
      return;
    }

    const { error } = await this.supabase.client
      .from('match_results')
      .insert({
        match_id: null,
        winner_id: winnerId,
        loser_id: loserId,
        mode: result.mode,
        result_reason: result.resultReason,
        turns_played: result.turnsPlayed,
        total_damage_player1: 0,
        total_damage_player2: 0,
        cards_used_player1: 0,
        cards_used_player2: 0
      });

    if (error) {
      throw error;
    }

    result.synced = true;
    await this.saveMatchResultLocal(result);
  }

  getLocalResultsSync(): MatchResult[] {
    try {
      const raw = localStorage.getItem(this.LOCAL_RESULTS_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed;
    } catch (error) {
      console.error('Error leyendo historial local:', error);
      return [];
    }
  }

  async getLocalResults(): Promise<MatchResult[]> {
    return this.getLocalResultsSync();
  }

  async getHistory(): Promise<MatchResult[]> {
    let localResults = this.getLocalResultsSync();
    let remoteResults: MatchResult[] = [];
    
    try {
      const user = await this.authService.getCurrentUser();
      if (user) {
        remoteResults = await this.supabase.getMatchHistory(user.id);
      }
    } catch (error) {
      console.warn('No se pudo obtener historial remoto', error);
    }

    // Merge and deduplicate by matchId or id
    const merged = [...remoteResults];
    
    for (const local of localResults) {
      const exists = merged.find(r => r.id === local.id || (r.matchId && r.matchId === local.matchId));
      if (!exists) {
        merged.push(local);
      }
    }

    // Sort descending by date
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
