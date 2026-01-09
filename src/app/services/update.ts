import { Injectable, signal, inject, NgZone } from '@angular/core';
import { Router } from '@angular/router';

import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Manages application updates, handling IPC communication with Electron
 * and maintaining reactive state for UI components.
 */
@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  router = inject(Router);
  ngZone = inject(NgZone);
  private snackBar = inject(MatSnackBar);

  isChecking = signal(false);
  updateStatus = signal<string>('idle');
  updateError = signal<string | null>(null);
  versionLocked = signal(false);

  isElectron = !!window.electronAPI;

  constructor() {
    if (this.isElectron) {
      this.setupListeners();
    }
    this.loadSettings();
  }

  private loadSettings() {
    const stored = localStorage.getItem('versionLocked');
    // Default to true if not set (first run), otherwise use stored value
    const locked = stored === null ? true : stored === 'true';
    this.versionLocked.set(locked);

    if (locked) {
      this.snackBar.open('Updater is version locked. Disable in Settings to update.', 'Dismiss', {
        duration: 5000,
        verticalPosition: 'top',
      });
    }
  }

  toggleVersionLock() {
    const newState = !this.versionLocked();
    this.versionLocked.set(newState);
    localStorage.setItem('versionLocked', String(newState));
  }

  private setupListeners() {
    const api = window.electronAPI;

    api.onUpdateStatus((data: { status: string; error?: string }) => {
      this.ngZone.run(() => {
        if (this.checkTimeout) clearTimeout(this.checkTimeout);

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
        // Respect the lock even for manual/external triggers if desired,
        // but often manual overrides are expected. For now, let's enforce it
        // or notify. Given the user request, let's block it.
        if (this.versionLocked()) {
          console.log('Update check skipped due to version lock.');
          return;
        }

        this.isChecking.set(true);
        this.updateStatus.set('checking');
        this.router.navigate(['/update-check']);
        this.checkForUpdates();
      });
    });
  }

  private checkTimeout: ReturnType<typeof setTimeout> | undefined;

  /**
   * Triggers an update check via Electron's auto-updater.
   */
  checkForUpdates() {
    if (this.versionLocked()) {
      console.log('Update check blocked: Version is locked.');
      return;
    }

    if (this.isElectron) {
      const currentStatus = this.updateStatus();
      if (['checking', 'downloading', 'downloaded', 'available'].includes(currentStatus)) {
        return;
      }

      this.updateStatus.set('checking');
      this.updateError.set(null);

      // Safety timeout: If Electron doesn't respond in 15 seconds, reset.
      if (this.checkTimeout) clearTimeout(this.checkTimeout);
      this.checkTimeout = setTimeout(() => {
        this.ngZone.run(() => {
          if (this.isChecking() || this.updateStatus() === 'checking') {
            console.warn('Update check timed out in renderer.');
            this.updateStatus.set('idle');
            this.isChecking.set(false);
            this.updateError.set('Update check timed out. Please try again later.');
          }
        });
      }, 15000);

      window.electronAPI.checkForUpdates();
    }
  }

  quitAndInstall() {
    if (this.isElectron) {
      window.electronAPI.restartAndInstall();
    }
  }

  resetState() {
    this.isChecking.set(false);
    this.updateStatus.set('idle');
    this.updateError.set(null);
  }
}
