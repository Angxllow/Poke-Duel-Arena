import { Component, Input, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameAction } from '../../../core/models/game-action.model';

@Component({
  selector: 'app-action-log',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-log.html',
  styleUrl: './action-log.css'
})
export class ActionLog implements AfterViewChecked {
  @Input() logs: GameAction[] = [];
  
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) {}
  }

  formatMessage(log: GameAction): string {
    let msg = log.message;
    // Highlight numbers (damage, heal)
    msg = msg.replace(/\b(\d+)\b/g, '<strong class="text-warning">$1</strong>');
    return msg;
  }
}
