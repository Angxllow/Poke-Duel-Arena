import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokemonCard as CardModel } from '../../../core/models/pokemon-card.model';
import { CardTooltipService } from './card-tooltip.service';

@Component({
  selector: 'app-pokemon-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pokemon-card.html',
  styleUrl: './pokemon-card.css'
})
export class PokemonCard {
  @Input() card!: CardModel;
  @Input() mode: 'collection' | 'battle' | 'deck' = 'collection';
  @Input() isFaceDown: boolean = false;
  @Output() cardClick = new EventEmitter<CardModel>();

  constructor(
    private tooltipService: CardTooltipService,
    private elementRef: ElementRef
  ) {}

  @HostListener('mouseenter')
  onMouseEnter() {
    if (this.mode === 'battle' || this.mode === 'deck') {
      this.tooltipService.show(this.card, this.elementRef);
    }
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.tooltipService.hide();
  }

  onClick() {
    this.cardClick.emit(this.card);
  }
}
