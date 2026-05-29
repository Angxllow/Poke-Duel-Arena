import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-turn-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './turn-indicator.html',
  styleUrl: './turn-indicator.css'
})
export class TurnIndicator {
  @Input() currentPhase: string = '';
  @Input() isPlayerTurn: boolean = false;
  @Input() turnNumber: number = 1;
  
  @Output() nextPhase = new EventEmitter<void>();

  onNextPhase() {
    this.nextPhase.emit();
  }
}
