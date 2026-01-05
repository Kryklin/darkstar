import { Component, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../modules/material/material';
import { Theme, ThemeDef } from '../../services/theme';
import { UpdateService } from '../../services/update';
import { MatDialog } from '@angular/material/dialog';
import { GenericDialog, DialogButton } from '../dialogs/generic-dialog/generic-dialog';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class Settings {
  theme = inject(Theme);
  updateService = inject(UpdateService);
  dialog = inject(MatDialog);
  ngZone = inject(NgZone);

  compareThemes(t1: ThemeDef, t2: ThemeDef): boolean {
    return t1 && t2 ? t1.className === t2.className : t1 === t2;
  }

  async createShortcut(target: 'desktop' | 'start-menu') {
    const result = await window.electronAPI.createShortcut(target);
    this.openDialog(
      result.success ? 'Success' : 'Error',
      result.message,
      [{ label: 'OK', value: true }]
    );
  }

  async checkForUpdates() {
    if (this.updateService.versionLocked()) {
      this.openDialog('Update Check Skipped', 'Version locking is enabled. Please disable it to check for updates.', [{ label: 'OK', value: true }]);
      return;
    }
    this.openDialog('Checking for Updates', 'Please wait...', []);

    window.electronAPI.onUpdateStatus((status) => {
      this.ngZone.run(() => {
        let title = 'Update Status';
        let message = '';
        const buttons: DialogButton[] = [{ label: 'OK', value: true }];

        switch (status.status) {
          case 'checking':
            this.dialog.closeAll();
            return;
          case 'available':
            message = 'An update is available and will be downloaded in the background.';
            break;
          case 'not-available':
            this.dialog.closeAll();
            title = 'No Updates';
            message = 'You are on the latest version.';
            break;
          case 'downloaded': {
            this.dialog.closeAll();
            title = 'Update Ready';
            message = 'Update downloaded. Restart now to install?';
            const restartButtons = [
              { label: 'Later', value: false },
              { label: 'Restart', value: true, color: 'warn' },
            ];

            const ref = this.dialog.open(GenericDialog, {
              data: { title, message, buttons: restartButtons },
              width: '400px',
            });

            ref.afterClosed().subscribe((result) => {
              if (result) window.electronAPI.restartAndInstall();
            });
            return;
          }
          case 'error':
            this.dialog.closeAll();
            title = 'Update Error';
            message = status.error || 'Unknown error occurred.';
            break;
        }

        if (message) {
          this.openDialog(title, message, buttons);
        }
      });
    });

    window.electronAPI.checkForUpdates();
  }

  resetApp() {
    const ref = this.dialog.open(GenericDialog, {
      data: {
        title: 'Reset Application',
        message: 'Are you sure you want to reset the application? This will clear all data and restart the app.',
        buttons: [
          { label: 'Cancel', value: false },
          { label: 'Reset', value: true, color: 'warn' },
        ],
      },
      width: '400px',
    });

    ref.afterClosed().subscribe(async (result) => {
      if (result) {
        await window.electronAPI.resetApp();
      }
    });
  }

  private openDialog(title: string, message: string, buttons: DialogButton[]) {
    this.dialog.open(GenericDialog, {
      data: { title, message, buttons },
      width: '400px',
    });
  }
}
