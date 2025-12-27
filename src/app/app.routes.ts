import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'home', loadComponent: () => import('./components/home/home').then((m) => m.Home) },
  {
    path: 'encrypt',
    loadComponent: () => import('./components/encrypt/encrypt').then((m) => m.Encrypt),
  },
  {
    path: 'decrypt',
    loadComponent: () => import('./components/decrypt/decrypt').then((m) => m.Decrypt),
  },
  {
    path: 'update-check',
    loadComponent: () => import('./components/update-checker/update-checker').then((m) => m.UpdateChecker),
  },
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/settings').then((m) => m.Settings),
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
];
