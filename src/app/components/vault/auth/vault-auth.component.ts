import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VaultService } from '../../../services/vault';
import { EntropyMeter } from '../../entropy-meter/entropy-meter';
import { MaterialModule } from '../../../modules/material/material';

@Component({
  selector: 'app-vault-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, EntropyMeter],
  templateUrl: './vault-auth.component.html',
  styleUrls: ['./vault-auth.component.scss'],
})
export class VaultAuthComponent {
  vaultService = inject(VaultService);

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

  hasVault() {
    return this.vaultService.hasVault();
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
