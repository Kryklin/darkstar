import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'home', loadComponent: () => import('./components/home/home').then((m) => m.Home) },
  {
    path: 'encrypt',
    loadComponent: () => import('./components/bip39/encrypt/encrypt').then((m) => m.Encrypt),
  },
  {
    path: 'decrypt',
    loadComponent: () => import('./components/bip39/decrypt/decrypt').then((m) => m.Decrypt),
  },
  {
    path: 'update-check',
    loadComponent: () => import('./components/update-checker/update-checker').then((m) => m.UpdateChecker),
  },
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'about',
    loadComponent: () => import('./components/about/about').then((m) => m.About),
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
];
