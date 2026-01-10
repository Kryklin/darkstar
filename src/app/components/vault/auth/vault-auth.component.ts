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

  hasVault() {
    return this.vaultService.hasVault();
  }

  async submit() {
    if (!this.password) return;

    this.loading = true;

    setTimeout(async () => {
      try {
        if (this.hasVault()) {
          await this.vaultService.unlock(this.password);
        } else {
          await this.vaultService.createVault(this.password);
        }
      } finally {
        this.loading = false;
      }
    }, 50);
  }
}
