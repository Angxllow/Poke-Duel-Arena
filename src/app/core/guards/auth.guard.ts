import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Esperar a que se inicialice si aún no lo ha hecho, aunque el APP_INITIALIZER
  // ya debería garantizar esto en la gran mayoría de casos.
  let attempts = 0;
  while (!authService.authInitialized && attempts < 50) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }

  if (authService.isAuthenticated) {
    return true;
  } else {
    return router.parseUrl('/login');
  }
};
