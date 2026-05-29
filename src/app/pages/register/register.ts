import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  isLoading = false;

  successMessage = '';

  constructor(private auth: AuthService, private router: Router) {}

  async onSubmit(): Promise<void> {
    this.email = this.email.trim().toLowerCase();
    this.username = this.username.trim();

    if (!this.username || !this.email || !this.password || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos.';
      return;
    }

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(this.email)) {
      this.errorMessage = 'Ingresa un correo válido.';
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const result = await this.auth.register(this.username, this.email, this.password);
      if (result.user && result.session === null) {
         this.successMessage = 'Registro exitoso. Revisa tu correo para confirmar tu cuenta.';
      } else {
         await this.router.navigate(['/menu']);
      }
    } catch (error: any) {
      console.error('Error en registro:', error);
      const message = String(
        error?.message ||
        error?.error_description ||
        error?.error ||
        ''
      ).toLowerCase();

      if (message.includes('already registered') || message.includes('user already exists')) {
        this.errorMessage = 'El correo ya está registrado.';
      } else {
        this.errorMessage = error?.message || 'Error al registrar usuario.';
      }
    } finally {
      this.isLoading = false;
    }
  }
}
