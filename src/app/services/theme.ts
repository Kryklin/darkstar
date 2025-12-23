import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
/**
 * Manages the application's visual theme (light/dark mode) and associated assets.
 * Persists user preference to local storage.
 */
export class Theme {
  isDarkTheme = signal<boolean>(false);
  logoSrc = signal<string>('assets/img/logo-black.png');

  constructor() {
    const storedTheme = localStorage.getItem('isDarkTheme');
    if (storedTheme) {
      this.isDarkTheme.set(JSON.parse(storedTheme));
    }
    this.updateBodyClass();
    this.updateLogo();
    this.updateFavicon();
  }

  setDarkTheme(isDark: boolean) {
    this.isDarkTheme.set(isDark);
    localStorage.setItem('isDarkTheme', JSON.stringify(isDark));
    this.updateBodyClass();
    this.updateLogo();
    this.updateFavicon();
  }

  private updateBodyClass() {
    if (this.isDarkTheme()) {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }

  private updateLogo() {
    this.logoSrc.set(this.isDarkTheme() ? 'assets/img/logo-white.png' : 'assets/img/logo-black.png');
  }

  private updateFavicon() {
    const favicon = document.getElementById('favicon') as HTMLLinkElement;
    if (favicon) {
      favicon.href = this.isDarkTheme() ? 'assets/img/logo-white.png' : 'assets/img/logo-black.png';
    }
  }
}
