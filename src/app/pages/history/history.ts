import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HistoryService } from '../../core/services/history.service';
import { MatchResult } from '../../core/models/match-result.model';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './history.html',
  styleUrl: './history.css'
})
export class History implements OnInit {
  results: MatchResult[] = [];
  loading = false;
  errorMessage = '';
  
  constructor(
    private historyService: HistoryService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      await this.loadHistory();
    } else {
      // In SSR, we don't try to fetch history yet, to avoid hanging
      this.loading = false;
    }
  }

  async loadHistory(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      this.results = await this.historyService.getHistory();
    } catch (error) {
      console.error('Error cargando historial:', error);
      this.errorMessage = 'No se pudo cargar el historial.';
      this.results = [];
    } finally {
      this.loading = false;
    }
  }

  isVictory(match: MatchResult): boolean {
    if (!match || !match.winnerName) return false;
    const name = match.winnerName.toLowerCase();
    return name.includes('jugador') || name === 'tú';
  }
}
