import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: 'home', loadComponent: () => import('./components/home/home').then(m => m.Home) },
    { path: 'encrypt', loadComponent: () => import('./components/encrypt/encrypt').then(m => m.Encrypt) },
    { path: 'decrypt', loadComponent: () => import('./components/decrypt/decrypt').then(m => m.Decrypt) },
    { path: '', redirectTo: 'home', pathMatch: 'full' },
];
