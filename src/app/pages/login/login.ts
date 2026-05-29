import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  successMessage = '';

  constructor(private auth: AuthService, private router: Router) {}

  async onSubmit(): Promise<void> {
    this.email = this.email.trim().toLowerCase();
    
    if (!this.email || !this.password) {
      this.errorMessage = 'Ingresa un correo válido y una contraseña.';
      return;
    }

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(this.email)) {
      this.errorMessage = 'Ingresa un correo válido y una contraseña.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const result = await this.auth.login(this.email, this.password);

      if (!result?.session || !result?.user) {
        throw new Error('No se pudo iniciar sesión. Verifica tu correo.');
      }

      await this.router.navigate(['/menu']);
    } catch (error: any) {
      console.error('Error en login:', error);

      const message = String(
        error?.message ||
        error?.error_description ||
        error?.error ||
        ''
      ).toLowerCase();

      if (message.includes('email not confirmed')) {
        this.errorMessage = 'Debes confirmar tu correo antes de iniciar sesión.';
      } else if (
        message.includes('invalid login credentials') ||
        message.includes('invalid_grant') ||
        message.includes('invalid')
      ) {
        this.errorMessage = 'Correo o contraseña incorrectos.';
      } else if (
        message.includes('failed to fetch') ||
        message.includes('network')
      ) {
        this.errorMessage = 'No se pudo conectar con Supabase. Revisa tu conexión.';
      } else {
        this.errorMessage = error?.message || 'No se pudo iniciar sesión.';
      }
    } finally {
      this.isLoading = false;
    }
  }
}
