import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SqliteService } from '../../core/services/sqlite.service';
import { MatchResult } from '../../core/models/match-result.model';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './result.html',
  styleUrl: './result.css'
})
export class Result implements OnInit {
  matchId: string = '';
  result: MatchResult | null = null;
  
  constructor(
    private route: ActivatedRoute,
    private sqlite: SqliteService
  ) {}

  async ngOnInit() {
    this.matchId = this.route.snapshot.paramMap.get('matchId') || '';
    if (this.matchId) {
      const history = await this.sqlite.getLocalHistory() || [];
      this.result = history.find(h => h.id === this.matchId) || null;
    }
  }
}
