import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokemonCard as CardModel } from '../../../core/models/pokemon-card.model';
import { PokemonCard } from '../pokemon-card/pokemon-card';

@Component({
  selector: 'app-hand',
  standalone: true,
  imports: [CommonModule, PokemonCard],
  templateUrl: './hand.html',
  styleUrl: './hand.css'
})
export class Hand {
  @Input() cards: CardModel[] = [];
  @Input() isOpponent: boolean = false;
  @Input() isActiveTurn: boolean = false;
  @Input() selectedCardId?: string;
  @Output() cardSelect = new EventEmitter<CardModel>();

  onCardClick(card: CardModel) {
    if (!this.isOpponent && this.isActiveTurn) {
      this.cardSelect.emit(card);
    }
  }
}
