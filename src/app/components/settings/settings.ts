import { Component, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VaultService } from '../../services/vault';
import { Theme, ThemeDef } from '../../services/theme';
import { UpdateService } from '../../services/update';
import { MaterialModule } from '../../modules/material/material';
import { MatDialog } from '@angular/material/dialog';
import { GenericDialog, DialogButton } from '../dialogs/generic-dialog/generic-dialog';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class Settings {
  theme = inject(Theme);
  updateService = inject(UpdateService);
  vaultService = inject(VaultService);
  dialog = inject(MatDialog);
  ngZone = inject(NgZone);

  compareThemes(t1: ThemeDef, t2: ThemeDef): boolean {
    return t1 && t2 ? t1.className === t2.className : t1 === t2;
  }

  async createShortcut(target: 'desktop' | 'start-menu') {
    const result = await window.electronAPI.createShortcut(target);
    this.openDialog(result.success ? 'Success' : 'Error', result.message, [{ label: 'OK', value: true }]);
  }

  resetVault() {
    const ref = this.dialog.open(GenericDialog, {
      data: {
        title: 'Reset Secure Vault',
        message: 'Are you sure you want to delete your Secure Vault? ALL ENCRYPTED NOTES WILL BE LOST FOREVER. This action cannot be undone.',
        buttons: [
          { label: 'Cancel', value: false },
          { label: 'Delete Vault', value: true, color: 'warn' },
        ],
      },
      width: '400px',
    });

    ref.afterClosed().subscribe((result: boolean | undefined) => {
      if (result) {
        this.vaultService.deleteVault();
        this.openDialog('Success', 'Secure Vault has been reset.', [{ label: 'OK', value: true }]);
      }
    });
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

    ref.afterClosed().subscribe(async (result: boolean | undefined) => {
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
