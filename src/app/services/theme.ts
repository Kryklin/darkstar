import { Injectable, signal } from '@angular/core';

export interface ThemeDef {
  name: string;
  primary: string;
  className: string;
}

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
  selectedTheme = signal<ThemeDef>({ name: 'Crimson Void', primary: '#D50000', className: 'theme-crimson-void' });

  availableThemes: ThemeDef[] = [
    { name: 'Crimson Void', primary: '#D50000', className: 'theme-crimson-void' },
    { name: 'Solar Flare', primary: '#E65100', className: 'theme-solar-flare' },
    { name: 'Amber Glow', primary: '#FF6F00', className: 'theme-amber-glow' },
    { name: 'Forest Whisper', primary: '#2E7D32', className: 'theme-forest-whisper' },
    { name: 'Teal Torrent', primary: '#009688', className: 'theme-teal-torrent' },
    { name: 'Neon Cyberpunk', primary: '#00E5FF', className: 'theme-neon-cyberpunk' },
    { name: 'Oceanic Depth', primary: '#1A237E', className: 'theme-oceanic-depth' },
    { name: 'Indigo Night', primary: '#304FFE', className: 'theme-indigo-night' },
    { name: 'Royal Amethyst', primary: '#4A148C', className: 'theme-royal-amethyst' },
    { name: 'Magenta Madness', primary: '#D500F9', className: 'theme-magenta-madness' },
    { name: 'Sakura Breeze', primary: '#C2185B', className: 'theme-sakura-breeze' },
    { name: 'Golden Sands', primary: '#5D4037', className: 'theme-golden-sands' },
    { name: 'Midnight Slate', primary: '#263238', className: 'theme-midnight-slate' },
  ];

  constructor() {
    const storedDark = localStorage.getItem('isDarkTheme');
    if (storedDark) {
      this.isDarkTheme.set(JSON.parse(storedDark));
    }

    const storedThemeName = localStorage.getItem('selectedTheme');
    if (storedThemeName) {
      const theme = this.availableThemes.find((t) => t.className === storedThemeName);
      if (theme) {
        this.selectedTheme.set(theme);
      }
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

  setTheme(theme: ThemeDef) {
    this.selectedTheme.set(theme);
    localStorage.setItem('selectedTheme', theme.className);
    this.updateBodyClass();
  }

  private updateBodyClass() {
    // Remove all theme classes
    this.availableThemes.forEach((t) => document.body.classList.remove(t.className));
    
    // Add selected theme class
    document.body.classList.add(this.selectedTheme().className);

    // Add light/dark class
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
