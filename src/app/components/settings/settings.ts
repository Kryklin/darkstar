import { Component, inject, NgZone } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../modules/material/material';
import { Theme, ThemeDef } from '../../services/theme';
import { UpdateService } from '../../services/update';
import { MatDialog } from '@angular/material/dialog';
import { GenericDialog, DialogButton } from '../dialogs/generic-dialog/generic-dialog';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [MaterialModule, FormsModule],
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
    this.openDialog(result.success ? 'Success' : 'Error', result.message, [{ label: 'OK', value: true }]);
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
