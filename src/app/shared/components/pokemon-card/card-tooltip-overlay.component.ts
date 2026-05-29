import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokemonCard } from '../../../core/models/pokemon-card.model';
import { TOOLTIP_DATA } from './card-tooltip.service';

@Component({
  selector: 'app-card-tooltip-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card-tooltip-overlay">
      <div class="tooltip-header">
        <span class="tooltip-name">{{ card.name }}</span>
        <span class="tooltip-hp">{{ card.hp }} HP</span>
      </div>
      <div class="tooltip-types">
        <span *ngFor="let type of card.types" class="type-badge" [attr.data-type]="type.toLowerCase()">{{ type | uppercase }}</span>
      </div>
      <div class="tooltip-stats">
        <span>⚔️ {{ card.attack }}</span>
        <span>🛡️ {{ card.defense }}</span>
      </div>
      <div class="tooltip-ability" *ngIf="card.abilityName">
        <div class="ability-title">⚡ {{ card.abilityName }}</div>
        <div class="ability-desc">{{ card.abilityDescription }}</div>
      </div>
    </div>
  `,
  styleUrls: ['./card-tooltip-overlay.component.css']
})
export class CardTooltipOverlayComponent {
  constructor(@Inject(TOOLTIP_DATA) public card: PokemonCard) {}
}
