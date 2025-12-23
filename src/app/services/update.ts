import { Injectable, signal, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class UpdateService {
  router = inject(Router);
  ngZone = inject(NgZone);
  
  isChecking = signal(false);
  updateStatus = signal<string>('idle');
  updateError = signal<string | null>(null);

  isElectron = !!(window as unknown as ElectronWindow).electronAPI;

  constructor() {
    if (this.isElectron) {
      this.setupListeners();
    }
  }

  private setupListeners() {
    const api = (window as unknown as ElectronWindow).electronAPI;

    api.onUpdateStatus((data: { status: string, error?: string }) => {
      this.ngZone.run(() => {
        this.updateStatus.set(data.status);
        if (data.error) {
          this.updateError.set(data.error);
        }
        
        if (data.status === 'checking') {
          this.isChecking.set(true);
        } else if (['available', 'not-available', 'error', 'downloaded'].includes(data.status)) {
           // We might want to keep isChecking true until user leaves
        }
      });
    });

    api.onInitiateUpdateCheck(() => {
      this.ngZone.run(() => {
        this.isChecking.set(true);
        this.updateStatus.set('checking');
        this.router.navigate(['/update-check']);
        this.checkForUpdates();
      });
    });
  }

  checkForUpdates() {
    if (this.isElectron) {
      this.updateStatus.set('checking');
      this.updateError.set(null);
      (window as unknown as ElectronWindow).electronAPI.checkForUpdates();
    }
  }

  quitAndInstall() {
    if (this.isElectron) {
      (window as unknown as ElectronWindow).electronAPI.restartAndInstall();
    }
  }

  resetState() {
    this.isChecking.set(false);
    this.updateStatus.set('idle');
    this.updateError.set(null);
  }
}

interface ElectronWindow extends Window {
  electronAPI: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
    onUpdateStatus: (callback: (data: { status: string, error?: string }) => void) => void;
    onInitiateUpdateCheck: (callback: () => void) => void;
    checkForUpdates: () => void;
    restartAndInstall: () => void;
  }
}
