import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { DeckService } from '../../core/services/deck.service';
import { HistoryService } from '../../core/services/history.service';
import { UserProfile } from '../../core/models/user-profile.model';
import { MatchResult } from '../../core/models/match-result.model';
import { Deck } from '../../core/models/deck.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {
  user: UserProfile | null = null;
  userStats: any = { wins: 0, losses: 0, total_matches: 0 };
  recentMatches: MatchResult[] = [];
  decksCount = 0;
  activeDeck: Deck | null = null;

  loading = true;
  loggingOut = false;
  errorMessage = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private supabase: SupabaseService,
    private deckService: DeckService,
    private historyService: HistoryService
  ) {}

  async ngOnInit() {
    await this.loadProfilePage();
  }

  async loadProfilePage(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      this.user = await this.auth.getProfile();
      if (!this.user) {
        await this.router.navigate(['/login']);
        return;
      }

      await Promise.all([
        this.loadStats(),
        this.loadDecks(),
        this.loadRecentMatches()
      ]);
    } catch (error) {
      console.error('Error cargando perfil:', error);
      this.errorMessage = 'No se pudo cargar el perfil.';
    } finally {
      this.loading = false;
    }
  }

  private async loadStats() {
    if (!this.user) return;
    const { data } = await this.supabase.client
      .from('user_stats')
      .select('*')
      .eq('user_id', this.user.id)
      .maybeSingle();
      
    if (data) {
      this.userStats = data;
    }
  }

  private async loadDecks() {
    const decks = await this.deckService.getAllAvailableDecks();
    this.decksCount = decks.length;
    this.activeDeck = await this.deckService.getActiveDeckLocal();
  }

  private async loadRecentMatches() {
    const history = await this.historyService.getHistory();
    this.recentMatches = history.slice(0, 5); // Take top 5
  }

  get totalMatches(): number {
    return this.userStats?.total_matches || (this.userStats?.wins + this.userStats?.losses) || 0;
  }

  get winRate(): number {
    const total = this.totalMatches;
    if (total === 0) return 0;
    return Math.round((this.userStats.wins / total) * 100);
  }

  get playerRank(): string {
    const wins = this.userStats?.wins || 0;
    if (wins >= 21) return 'Leyenda';
    if (wins >= 11) return 'Maestro';
    if (wins >= 6) return 'Duelista';
    if (wins >= 3) return 'Entrenador';
    return 'Novato';
  }

  get progressToNextRank(): number {
    const wins = this.userStats?.wins || 0;
    if (wins >= 21) return 100;
    if (wins >= 11) return ((wins - 11) / 10) * 100; // Maestro -> Leyenda (10 wins)
    if (wins >= 6) return ((wins - 6) / 5) * 100; // Duelista -> Maestro (5 wins)
    if (wins >= 3) return ((wins - 3) / 3) * 100; // Entrenador -> Duelista (3 wins)
    return (wins / 3) * 100; // Novato -> Entrenador (3 wins)
  }

  async logout(): Promise<void> {
    if (this.loggingOut) return;

    this.loggingOut = true;
    this.errorMessage = '';

    try {
      await this.auth.logout();
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error cerrando sesión:', error);
      this.errorMessage = 'No se pudo cerrar sesión. Intenta de nuevo.';
    } finally {
      this.loggingOut = false;
    }
  }
}
