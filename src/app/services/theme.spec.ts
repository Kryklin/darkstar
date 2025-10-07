import { TestBed } from '@angular/core/testing';
import { Theme } from './theme';

describe('Theme', () => {
  let service: Theme;
  let store: { [key: string]: string } = {};
  let favicon: HTMLLinkElement;

  beforeEach(() => {
    // Mock localStorage
    store = {};
    spyOn(localStorage, 'getItem').and.callFake((key: string): string | null => {
      return store[key] || null;
    });
    spyOn(localStorage, 'setItem').and.callFake((key: string, value: string): void => {
      store[key] = value;
    });

    // Create a mock favicon element
    favicon = document.createElement('link');
    favicon.id = 'favicon';
    favicon.rel = 'icon';
    document.head.appendChild(favicon);

    TestBed.configureTestingModule({});
    // Create a new service for each test to ensure a clean state
    service = TestBed.inject(Theme);
  });

  afterEach(() => {
    // Clean up body classes
    document.body.classList.remove('dark-theme', 'light-theme');
    // Remove the mock favicon
    document.head.removeChild(favicon);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with light theme by default', () => {
    expect(service.isDarkTheme()).toBeFalse();
    expect(service.logoSrc()).toBe('assets/img/logo-black.png');
    expect(document.body.classList.contains('light-theme')).toBeTrue();
    expect(document.body.classList.contains('dark-theme')).toBeFalse();
    expect(favicon.href).toContain('assets/img/logo-black.png');
  });

  it('should initialize with dark theme if localStorage is set to true', () => {
    store['isDarkTheme'] = 'true';
    // Re-create service to test constructor logic
    const newService = new Theme();
    expect(newService.isDarkTheme()).toBeTrue();
    expect(newService.logoSrc()).toBe('assets/img/logo-white.png');
    expect(document.body.classList.contains('dark-theme')).toBeTrue();
    expect(document.body.classList.contains('light-theme')).toBeFalse();
    expect(favicon.href).toContain('assets/img/logo-white.png');
  });

  it('should set dark theme', () => {
    service.setDarkTheme(true);
    expect(service.isDarkTheme()).toBeTrue();
    expect(service.logoSrc()).toBe('assets/img/logo-white.png');
    expect(localStorage.setItem).toHaveBeenCalledWith('isDarkTheme', 'true');
    expect(document.body.classList.contains('dark-theme')).toBeTrue();
    expect(document.body.classList.contains('light-theme')).toBeFalse();
    expect(favicon.href).toContain('assets/img/logo-white.png');
  });

  it('should set light theme', () => {
    // Start with dark theme
    service.setDarkTheme(true);
    // Switch to light theme
    service.setDarkTheme(false);
    expect(service.isDarkTheme()).toBeFalse();
    expect(service.logoSrc()).toBe('assets/img/logo-black.png');
    expect(localStorage.setItem).toHaveBeenCalledWith('isDarkTheme', 'false');
    expect(document.body.classList.contains('light-theme')).toBeTrue();
    expect(document.body.classList.contains('dark-theme')).toBeFalse();
    expect(favicon.href).toContain('assets/img/logo-black.png');
  });
});
