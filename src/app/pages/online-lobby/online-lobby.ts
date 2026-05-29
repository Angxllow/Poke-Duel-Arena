import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OnlineGameService } from '../../core/services/online-game.service';
import { UserProfile } from '../../core/models/user-profile.model';

@Component({
  selector: 'app-online-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './online-lobby.html',
  styleUrl: './online-lobby.css'
})
export class OnlineLobby implements OnInit {
  roomCodeToJoin = '';
  errorMessage = '';
  loading = false;
  
  user: UserProfile | null = null;
  currentRoom: any = null;
  roomChannel: any = null;

  constructor(
    private auth: AuthService,
    private onlineService: OnlineGameService,
    private router: Router
  ) {}

  async ngOnInit() {
    const currentUser = await this.auth.getCurrentUser();
    
    if (!currentUser) {
      this.errorMessage = 'Debes iniciar sesión para jugar en línea.';
      await this.router.navigate(['/login']);
      return;
    }
    
    this.user = await this.auth.getProfile();
    
    if (!this.user) {
       this.errorMessage = 'Tu perfil aún no está listo. Intenta de nuevo en unos segundos.';
    }
  }

  async createRoom() {
    if (!this.user) return;
    this.loading = true;
    this.errorMessage = '';
    
    try {
      this.currentRoom = await this.onlineService.createRoom(this.user.id);
      this.subscribeToRoom();
    } catch (e: any) {
      this.errorMessage = e.message || 'Error al crear la sala.';
    } finally {
      this.loading = false;
    }
  }

  async joinRoom() {
    if (!this.user || !this.roomCodeToJoin) return;
    this.loading = true;
    this.errorMessage = '';

    try {
      this.currentRoom = await this.onlineService.joinRoom(this.roomCodeToJoin.toUpperCase(), this.user.id);
      // If successful, navigate to game
      this.router.navigate(['/online-game', this.currentRoom.id]);
    } catch (e: any) {
      this.errorMessage = e.message || 'Error al unirse a la sala.';
    } finally {
      this.loading = false;
    }
  }

  subscribeToRoom() {
    if (!this.currentRoom) return;
    this.roomChannel = this.onlineService.listenToRoom(this.currentRoom.id, (payload) => {
      this.currentRoom = payload;
      if (this.currentRoom.status === 'ACTIVE') {
        this.roomChannel.unsubscribe();
        this.router.navigate(['/online-game', this.currentRoom.id]);
      }
    });
  }

  copyCode() {
    if (this.currentRoom) {
      navigator.clipboard.writeText(this.currentRoom.room_code);
      alert('Código copiado: ' + this.currentRoom.room_code);
    }
  }

  async cancelRoom() {
    if (this.currentRoom && this.user) {
      await this.onlineService.leaveRoom(this.currentRoom.id, this.user.id);
      if (this.roomChannel) this.roomChannel.unsubscribe();
      this.currentRoom = null;
    }
  }
}
