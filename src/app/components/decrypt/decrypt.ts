import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { CryptService } from '../../services/crypt';
import { MaterialModule } from '../../modules/material/material';

@Component({
  selector: 'app-decrypt',
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule,
  ],
  templateUrl: './decrypt.html',
  styleUrl: './decrypt.scss'
})
export class Decrypt {
  encryptedData = signal('');
  reverseKey = signal('');
  password = signal('');
  hidePassword = signal(true);
  decryptedMnemonic = signal('');

  constructor(private cryptService: CryptService) {}

  togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  decrypt(): void {
    try {
      const decrypted = this.cryptService.decrypt(
        this.encryptedData(),
        this.reverseKey(),
        this.password()
      );
      this.decryptedMnemonic.set(decrypted);
    } catch (e) {
      console.error('Decryption failed', e);
      this.decryptedMnemonic.set('Error: Decryption failed. Please check your inputs and try again.');
    }
  }

  copyToClipboard(): void {
    if (this.decryptedMnemonic()) {
      navigator.clipboard.writeText(this.decryptedMnemonic());
    }
  }
}
