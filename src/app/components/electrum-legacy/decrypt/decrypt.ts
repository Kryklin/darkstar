import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MaterialModule } from '../../../modules/material/material';
import { CryptService } from '../../../services/crypt';
import { CommonModule } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import ElectrumLegacy from '../../../../assets/electrum-legacy.json';

@Component({
  selector: 'app-electrum-legacy-decrypt',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TextFieldModule, MaterialModule, CommonModule],
  templateUrl: './decrypt.html',
  styleUrl: './decrypt.scss',
})
export class ElectrumLegacyDecrypt {
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  thirdFormGroup: FormGroup;
  showResult = false;
  decryptedMnemonic = '';
  error = '';

  private fb = inject(FormBuilder);
  private cryptService = inject(CryptService);
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);

  protocolTitle = ElectrumLegacy.title;
  protocolSummary = ElectrumLegacy.summary;
  protocolLink = ElectrumLegacy.link;

  constructor() {
    this.firstFormGroup = this.fb.group({
      encryptedData: ['', Validators.required],
    });
    this.secondFormGroup = this.fb.group({
      reverseKey: ['', Validators.required],
    });
    this.thirdFormGroup = this.fb.group({
      password: ['', Validators.required],
    });
  }

  async copyFromClipboard(field: string) {
    const text = await navigator.clipboard.readText();
    if (field === 'encryptedData') {
      this.firstFormGroup.controls['encryptedData'].setValue(text);
    } else if (field === 'reverseKey') {
      this.secondFormGroup.controls['reverseKey'].setValue(text);
    }
    this.snackBar.open('Pasted from clipboard', 'Close', { duration: 2000 });
  }

  onSubmit() {
    if (this.firstFormGroup.valid && this.secondFormGroup.valid && this.thirdFormGroup.valid) {
      this.snackBar.open('Decryption logic coming soon', 'Close', { duration: 3000 });
      // Mock logic
      // this.decryptedMnemonic = "mock words here";
      // this.showResult = true;
    }
  }

  reset() {
    this.showResult = false;
    this.error = '';
    this.decryptedMnemonic = '';
    this.firstFormGroup.reset();
    this.secondFormGroup.reset();
    this.thirdFormGroup.reset();
  }
}
