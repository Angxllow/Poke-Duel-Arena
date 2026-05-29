import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokemonCard as CardModel } from '../../../core/models/pokemon-card.model';

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

  onClick() {
    this.cardClick.emit(this.card);
  }
}
