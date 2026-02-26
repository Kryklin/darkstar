import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BackupService {
  enabled = signal<boolean>(localStorage.getItem('backup_enabled') === 'true');
  intervalDays = signal<number>(parseInt(localStorage.getItem('backup_interval_days') || '7', 10));
  lastBackupDate = signal<Date | null>(
    localStorage.getItem('backup_last_date') ? new Date(localStorage.getItem('backup_last_date')!) : null
  );
  backupPath = signal<string>(localStorage.getItem('backup_path') || '');

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Persist settings whenever they change
    effect(() => {
        localStorage.setItem('backup_enabled', String(this.enabled()));
        localStorage.setItem('backup_interval_days', String(this.intervalDays()));
        localStorage.setItem('backup_path', this.backupPath());
        if (this.lastBackupDate()) {
            localStorage.setItem('backup_last_date', this.lastBackupDate()!.toISOString());
        } else {
            localStorage.removeItem('backup_last_date');
        }
        
        // Restart the timer when settings change
        this.checkAndStartBackupJob();
    });
  }

  checkAndStartBackupJob() {
      if (this.timer) {
          clearInterval(this.timer);
      }
      
      if (!this.enabled() || !window.electronAPI) return;

      // Run immediately on boot if missed
      this.performBackupIfDue();

      // Check every hour
      this.timer = setInterval(() => {
          this.performBackupIfDue();
      }, 60 * 60 * 1000); 
  }

  async performBackupIfDue() {
      if (!this.enabled()) return;
      
      const last = this.lastBackupDate();
      const interval = this.intervalDays() * 24 * 60 * 60 * 1000;
      
      if (!last || (Date.now() - last.getTime()) >= interval) {
          await this.triggerBackup();
      }
  }

  async triggerBackup(): Promise<boolean> {
      if (!window.electronAPI) return false;
      
      // Grab the encrypted vault blob directly
      const vaultData = localStorage.getItem('secure_vault_v2');
      if (!vaultData) return false;

      let dir = this.backupPath();
      if (!dir) {
          // If no custom directory set, we rely on the main process default
          dir = await window.electronAPI.getDefaultBackupPath();
      }

      const filename = `darkstar_vault_${new Date().toISOString().replace(/[:.]/g, '-')}.backup`;
      
      try {
          // Send to electron to write
          const success = await window.electronAPI.saveBackup(dir, filename, vaultData);
          if (success) {
              this.lastBackupDate.set(new Date());
              return true;
          }
      } catch (e) {
          console.error("Backup failed", e);
      }
      return false;
  }

  async chooseBackupDirectory(): Promise<string | null> {
      if (!window.electronAPI) return null;
      const path = await window.electronAPI.showDirectoryPicker();
      if (path) {
          this.backupPath.set(path);
      }
      return path;
  }
}
