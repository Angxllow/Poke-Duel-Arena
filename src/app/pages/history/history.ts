import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HistoryService, LocalMatchResult } from '../../core/services/history.service';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './history.html',
  styleUrl: './history.css'
})
export class History implements OnInit {
  results: LocalMatchResult[] = [];
  loading = false;
  errorMessage = '';
  
  constructor(private historyService: HistoryService) {}

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  async loadHistory(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      this.results = await this.historyService.getLocalResults();

      this.results.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } catch (error) {
      console.error('Error cargando historial:', error);
      this.errorMessage = 'No se pudo cargar el historial.';
      this.results = [];
    } finally {
      this.loading = false;
    }
  }
}
