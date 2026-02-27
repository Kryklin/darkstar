import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VaultService } from '../../../services/vault';
import { BiometricService } from '../../../services/biometric.service';
import { EntropyMeter } from '../../entropy-meter/entropy-meter';
import { MaterialModule } from '../../../modules/material/material';
import { MatDialog } from '@angular/material/dialog';
import { GenericDialog } from '../../dialogs/generic-dialog/generic-dialog';

@Component({
  selector: 'app-vault-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, EntropyMeter],
  templateUrl: './vault-auth.component.html',
  styleUrls: ['./vault-auth.component.scss'],
})
export class VaultAuthComponent implements OnInit {
  vaultService = inject(VaultService);
  biometricService = inject(BiometricService);
  dialog = inject(MatDialog);

  password = '';
  hidePassword = true;
  loading = false;
  passwordLoading = false;
  hardwareLoading = false;
  biometricsLoading = false;

  isElectron = !!window.electronAPI;
  isWindows = this.isElectron && window.electronAPI.getPlatform() === 'win32';
  
  // TOTP State
  requiresTotp = false;
  totpCode = '';

  get isHardwareKeyEnabled() {
    return !!localStorage.getItem('hardware_key_credential_id');
  }

  get isBiometricEnabled() {
    return !!localStorage.getItem('biometric_credential_id');
  }

  get authName() {
    return this.biometricService.getDeviceAuthName();
  }

  hasVault() {
    return this.vaultService.hasVault();
  }

  ngOnInit() {
    if (localStorage.getItem('vault_recovered_notice') === 'true') {
        localStorage.removeItem('vault_recovered_notice');
        this.dialog.open(GenericDialog, {
            data: {
                title: 'Vault Data Recovered',
                message: 'We apologize for the inconvenience—due to a secure origin update, your vault data may have appeared missing. We have successfully located and recovered your data. \n\nIf you still find data is missing, please use the "Restore from Backup" utility found in Settings.',
                buttons: [{ label: 'I Understand', value: true }]
            },
            width: '450px'
        });
    }
  }

  async submitHardwareKey() {
    this.loading = true;
    this.hardwareLoading = true;
    try {
        const result = await this.vaultService.unlockWithHardwareKey();
        if (result && result.requiresTotp) {
            this.requiresTotp = true;
        }
    } finally {
        this.loading = false;
        this.hardwareLoading = false;
    }
  }

  async submitBiometrics() {
    this.loading = true;
    this.biometricsLoading = true;
    try {
        const result = await this.vaultService.unlockWithBiometrics();
        if (result && result.requiresTotp) {
            this.requiresTotp = true;
        }
    } finally {
        this.loading = false;
        this.biometricsLoading = false;
    }
  }

  async submit() {
    if (!this.password) return;

    this.loading = true;
    this.passwordLoading = true;

    setTimeout(async () => {
      try {
        if (this.hasVault()) {
          const result = await this.vaultService.unlock(this.password);
          if (result && result.requiresTotp) {
              this.requiresTotp = true;
          }
        } else {
          await this.vaultService.createVault(this.password);
        }
      } finally {
        this.loading = false;
        this.passwordLoading = false;
      }
    }, 50);
  }

  async submitTotp() {
      if (!this.totpCode || this.totpCode.length < 6) return;
      
      this.loading = true;
      try {
          const success = await this.vaultService.verifyTotp(this.totpCode);
          if (!success) {
              // Error is set in VaultService
              this.totpCode = '';
          }
      } finally {
          this.loading = false;
      }
  }
}
