import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MaterialModule } from '../../modules/material/material';
import { CryptService } from '../../services/crypt';
import { CommonModule } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-decrypt',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TextFieldModule,
    MaterialModule,
    CommonModule
  ],
  templateUrl: './decrypt.html',
  styleUrl: './decrypt.scss'
})
export class Decrypt {
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

  constructor() {
    this.firstFormGroup = this.fb.group({
      encryptedData: ['', Validators.required],
    });
    this.secondFormGroup = this.fb.group({
      reverseKey: ['', Validators.required],
    });
    this.thirdFormGroup = this.fb.group({
      password: ['', Validators.required]
    });
  }

  async copyFromClipboard(field: string) {
    const text = await navigator.clipboard.readText();
    if (field === 'encryptedData') {
      this.firstFormGroup.controls['encryptedData'].setValue(text);
    } else if (field === 'reverseKey') {
      this.secondFormGroup.controls['reverseKey'].setValue(text);
    }
    this.snackBar.open('Pasted from clipboard!', 'Close', {
      duration: 2000,
    });
  }

  onSubmit() {
    if (this.firstFormGroup.valid && this.secondFormGroup.valid && this.thirdFormGroup.valid) {
      const { encryptedData } = this.firstFormGroup.value;
      const { reverseKey } = this.secondFormGroup.value;
      const { password } = this.thirdFormGroup.value;
      try {
        this.decryptedMnemonic = this.cryptService.decrypt(encryptedData, reverseKey, password);
        this.error = '';
        this.showResult = true;
      } catch (e: unknown) {
        let errorMessage = 'An error occurred';
        if (e instanceof Error) {
          errorMessage = e.message;
        }
        this.error = `Decryption failed: ${errorMessage}`;
        this.decryptedMnemonic = '';
        this.showResult = true;
      }
    }
  }

  reset() {
    this.firstFormGroup.reset();
    this.secondFormGroup.reset();
    this.thirdFormGroup.reset();
    this.showResult = false;
    this.decryptedMnemonic = '';
    this.error = '';
  }
}
