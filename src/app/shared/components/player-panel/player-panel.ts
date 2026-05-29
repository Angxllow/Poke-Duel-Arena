import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-panel.html',
  styleUrl: './player-panel.css'
})
export class PlayerPanel {
  @Input() username: string = '';
  @Input() lifePoints: number = 500;
  @Input() maxLifePoints: number = 500;
  @Input() deckCount: number = 0;
  @Input() discardCount: number = 0;
  @Input() isOpponent: boolean = false;
  @Input() isActiveTurn: boolean = false;

  getLifePercent(): number {
    const maxLife = this.maxLifePoints || 500;
    const currentLife = Math.max(0, this.lifePoints);
    return Math.max(0, Math.min(100, (currentLife / maxLife) * 100));
  }

  getLifeBarClass(): string {
    const percent = this.getLifePercent();
    if (percent > 60) return 'life-high';
    if (percent > 30) return 'life-medium';
    return 'life-low';
  }

  getDisplayedLife(): number {
    return Math.max(0, this.lifePoints);
  }
}
