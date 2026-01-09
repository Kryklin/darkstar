import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'home', loadComponent: () => import('./components/home/home').then((m) => m.Home) },
  {
    path: 'encrypt',
    loadComponent: () => import('./components/bip39/encrypt').then((m) => m.Encrypt),
  },
  {
    path: 'decrypt',
    loadComponent: () => import('./components/bip39/decrypt').then((m) => m.Decrypt),
  },
  // Electrum Legacy
  {
    path: 'electrum-legacy/encrypt',
    loadComponent: () => import('./components/electrum-legacy/encrypt').then((m) => m.ElectrumLegacyEncrypt),
  },
  {
    path: 'electrum-legacy/decrypt',
    loadComponent: () => import('./components/electrum-legacy/decrypt').then((m) => m.ElectrumLegacyDecrypt),
  },
  // Electrum V2
  {
    path: 'electrum-v2/encrypt',
    loadComponent: () => import('./components/electrum-v2/encrypt').then((m) => m.ElectrumV2Encrypt),
  },
  {
    path: 'electrum-v2/decrypt',
    loadComponent: () => import('./components/electrum-v2/decrypt').then((m) => m.ElectrumV2Decrypt),
  },
  // SLIP39
  {
    path: 'slip39/encrypt',
    loadComponent: () => import('./components/slip39/encrypt').then((m) => m.Slip39Encrypt),
  },
  {
    path: 'slip39/decrypt',
    loadComponent: () => import('./components/slip39/decrypt').then((m) => m.Slip39Decrypt),
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
