import { Component } from '@angular/core';
import { SharedDecryptComponent } from '../shared/decrypt/decrypt';

@Component({
  selector: 'app-secure-notes-decrypt',
  standalone: true,
  imports: [SharedDecryptComponent],
  template: `
    <app-shared-decrypt
      protocolTitle="Secure Notes Decryption"
      protocolSummary="Decrypt your secure notes."
    ></app-shared-decrypt>
  `,
})
export class SecureNotesDecrypt {}
