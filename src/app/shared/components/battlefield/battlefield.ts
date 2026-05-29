import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PokemonCard as CardModel } from '../../../core/models/pokemon-card.model';
import { PokemonCard } from '../pokemon-card/pokemon-card';

@Component({
  selector: 'app-battlefield',
  standalone: true,
  imports: [CommonModule, PokemonCard],
  templateUrl: './battlefield.html',
  styleUrl: './battlefield.css'
})
export class Battlefield {
  @Input() playerField: CardModel[] = [];
  @Input() opponentField: CardModel[] = [];
  @Input() isPlayerTurn: boolean = false;
  @Input() phase: string = '';
  
  @Input() selectedDefenseCardId?: string;
  @Input() selectedAbilityCardId?: string;
  @Input() selectedAttackerId?: string;
  @Input() selectedTargetId?: string;
  @Input() selectedAbilityTargetId?: string;
  
  @Output() playerCardClick = new EventEmitter<CardModel>();
  @Output() opponentCardClick = new EventEmitter<CardModel>();
  @Output() opponentDirectAttack = new EventEmitter<void>();
  @Output() playerAbilityClick = new EventEmitter<CardModel>();

  onPlayerCardClick(card: CardModel) {
    this.playerCardClick.emit(card);
  }

  onPlayerAbilityClick(card: CardModel) {
    this.playerAbilityClick.emit(card);
  }

  onOpponentCardClick(card: CardModel) {
    this.opponentCardClick.emit(card);
  }

  onOpponentDirectAttack() {
    this.opponentDirectAttack.emit();
  }
}
