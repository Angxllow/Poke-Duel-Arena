import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar {
  loggingOut = false;

  constructor(public authService: AuthService, private router: Router) {}

  async logout(): Promise<void> {
    if (this.loggingOut) return;
    this.loggingOut = true;

    try {
      await this.authService.logout();
      await this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error cerrando sesión desde navbar:', error);
    } finally {
      this.loggingOut = false;
    }
  }
}
