import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameAction } from '../../../core/models/game-action.model';

@Component({
  selector: 'app-action-log',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-log.html',
  styleUrl: './action-log.css'
})
export class ActionLog {
  @Input() logs: GameAction[] = [];
}
