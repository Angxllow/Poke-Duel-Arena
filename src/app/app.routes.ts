import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', loadComponent: () => import('./pages/home/home').then(m => m.Home) },
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  { path: 'register', loadComponent: () => import('./pages/register/register').then(m => m.Register) },
  { path: 'menu', loadComponent: () => import('./pages/menu/menu').then(m => m.Menu), canActivate: [authGuard] },
  { path: 'collection', loadComponent: () => import('./pages/collection/collection').then(m => m.Collection) },
  { path: 'deck-builder', loadComponent: () => import('./pages/deck-builder/deck-builder').then(m => m.DeckBuilder) },
  { path: 'solo-game', loadComponent: () => import('./pages/solo-game/solo-game').then(m => m.SoloGame) },
  { path: 'online-lobby', loadComponent: () => import('./pages/online-lobby/online-lobby').then(m => m.OnlineLobby), canActivate: [authGuard] },
  { path: 'online-game/:roomCode', loadComponent: () => import('./pages/online-game/online-game').then(m => m.OnlineGame), canActivate: [authGuard] },
  { path: 'history', loadComponent: () => import('./pages/history/history').then(m => m.History), canActivate: [authGuard] },
  { path: 'result/:matchId', loadComponent: () => import('./pages/result/result').then(m => m.Result) },
  { path: 'rules', loadComponent: () => import('./pages/rules/rules').then(m => m.Rules) },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile').then(m => m.Profile), canActivate: [authGuard] },
  { path: '**', redirectTo: 'home' }
];
