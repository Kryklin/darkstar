import { Component, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VaultService } from '../../services/vault';
import { Theme, ThemeDef } from '../../services/theme';
import { UpdateService } from '../../services/update';
import { MaterialModule } from '../../modules/material/material';
import { MatDialog } from '@angular/material/dialog';
import { GenericDialog, DialogButton } from '../dialogs/generic-dialog/generic-dialog';
import { DuressService } from '../../services/duress.service';
import { TotpSetup } from './totp-setup/totp-setup';
import { BackupConfig } from './backup-config/backup-config';


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
  duressService = inject(DuressService);

  dialog = inject(MatDialog);
  ngZone = inject(NgZone);

  isElectron = !!window.electronAPI;
  isWindows = this.isElectron && window.electronAPI.getPlatform() === 'win32';
  duressPassword = '';
  
  isRegisteringBiometrics = false;
  isRegisteringHardwareKey = false;
  
  // Computed or simple getter for biometric state
  get isBiometricEnabled(): boolean {
      return !!localStorage.getItem('biometric_credential_id');
  }

  get isHardwareKeyEnabled(): boolean {
      return !!localStorage.getItem('hardware_key_credential_id');
  }

  async toggleBiometrics() {
      if (this.isBiometricEnabled) {
          // Disable
          localStorage.removeItem('biometric_credential_id');
          localStorage.removeItem('biometric_enc_pass');
          this.openDialog('Success', 'Biometric unlock has been disabled.', [{ label: 'OK', value: true }]);
      } else {
          // Enable
          this.isRegisteringBiometrics = true;
          try {
              const key = this.vaultService.getMasterKey();
              const result = await this.vaultService.registerBiometricsForSession(key);
              if (result) {
                  this.openDialog('Success', 'Windows Hello / Biometrics enabled for this device.', [{ label: 'OK', value: true }]);
              } else {
                 this.openDialog('Error', 'Failed to register biometrics. Please ensure your device supports Windows Hello or TouchID and it is set up.', [{ label: 'OK', value: true }]); 
              }
          } catch {
              this.openDialog('Error', 'Vault is locked or internal error.', [{ label: 'OK', value: true }]);
          } finally {
              this.isRegisteringBiometrics = false;
          }
      }
  }

  async toggleHardwareKey() {
      if (this.isHardwareKeyEnabled) {
          localStorage.removeItem('hardware_key_credential_id');
          this.openDialog('Success', 'Hardware Key (YubiKey) has been unlinked.', [{ label: 'OK', value: true }]);
      } else {
          this.isRegisteringHardwareKey = true;
          try {
              const key = this.vaultService.getMasterKey();
              const success = await this.vaultService.registerHardwareKey(key);
               if (success) {
                  this.openDialog('Success', 'Hardware Key (YubiKey) registered successfully.', [{ label: 'OK', value: true }]);
              } else {
                 this.openDialog('Error', 'Failed to register Hardware Key. Ensure it is plugged in.', [{ label: 'OK', value: true }]); 
              }
          } catch {
               this.openDialog('Error', 'Vault is locked or internal error.', [{ label: 'OK', value: true }]);
          } finally {
               this.isRegisteringHardwareKey = false;
          }
      }
  }

  setDuress() {
    if (!this.duressPassword) return;
    
    // Warn user
    const ref = this.dialog.open(GenericDialog, {
      data: {
        title: 'Configure Duress Mode',
        message: 'WARNING: If you use this password to unlock your vault, ALL DATA WILL BE PERMANENTLY DELETED. Are you sure you want to set this panic password?',
        buttons: [
          { label: 'Cancel', value: false },
          { label: 'Enable Panic Mode', value: true, color: 'warn' },
        ],
      },
      width: '400px',
    });

    ref.afterClosed().subscribe((result: boolean) => {
      if (result) {
        this.duressService.setDuressPassword(this.duressPassword);
        this.duressPassword = ''; // Clear input
        this.openDialog('Success', 'Duress Password has been set.', [{ label: 'OK', value: true }]);
      }
    });
  }

  clearDuress() {
    this.duressService.clearDuressPassword();
    this.openDialog('Success', 'Duress Password has been removed.', [{ label: 'OK', value: true }]);
  }

  get isTotpEnabled(): boolean {
      return !!this.vaultService.totpSecret();
  }

  openBackupConfig() {
      this.dialog.open(BackupConfig, {
          width: '500px'
      });
  }

  toggleTotp() {
      if (this.isTotpEnabled) {
          // Disable
          this.vaultService.disableTotp();
          this.openDialog('Success', 'Two-Factor Authentication (TOTP) has been disabled.', [{ label: 'OK', value: true }]);
      } else {
          // Enable Dialog
          const ref = this.dialog.open(TotpSetup, {
              width: '400px',
              disableClose: true
          });

          ref.afterClosed().subscribe((secret: string | null) => {
              if (secret) {
                  this.vaultService.enableTotp(secret);
                  this.openDialog('Success', 'Two-Factor Authentication enabled.', [{ label: 'OK', value: true }]);
              }
          });
      }
  }

  compareThemes(t1: ThemeDef, t2: ThemeDef): boolean {
    return t1 && t2 ? t1.className === t2.className : t1 === t2;
  }

  async createShortcut(target: 'desktop' | 'start-menu') {
    if (!this.isElectron) return;
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
      if (result && this.isElectron) {
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
