import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MaterialModule } from '../../../modules/material/material';
import { CryptService } from '../../../services/crypt';
import { CommonModule } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import Slip39 from '../../../../assets/slip39.json';

import { SteganographyService } from '../../../services/steganography.service';

@Component({
  selector: 'app-slip39-decrypt',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TextFieldModule, MaterialModule, CommonModule],
  templateUrl: './decrypt.html',
  styleUrl: './decrypt.scss',
})
export class Slip39Decrypt {
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  thirdFormGroup: FormGroup;
  showResult = false;
  decryptedMnemonic = '';
  error = '';

  inputType: 'text' | 'file' = 'text';
  fileName = '';
  isFileProcessing = false;

  private fb = inject(FormBuilder);
  private cryptService = inject(CryptService);
  private steganographyService = inject(SteganographyService);
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);

  protocolTitle = Slip39.title;
  protocolSummary = Slip39.summary;
  protocolLink = Slip39.link;

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

  // File Upload Handler
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    const file = input.files[0];

    if (file) {
      this.fileName = file.name;
      this.isFileProcessing = true;

      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const content = e.target?.result as string;

          if (!content) return;

          // Detect Mode
          const mode = this.steganographyService.detectMode(file.name, content);

          if (mode) {
            const extractedData = this.steganographyService.extract(content, mode);
            if (extractedData) {
              this.firstFormGroup.controls['encryptedData'].setValue(extractedData);
              this.snackBar.open(`Extracted payload from ${mode.toUpperCase()} file`, 'OK', { duration: 3000 });
            } else {
              this.snackBar.open('Could not find hidden payload in file', 'Error', { duration: 3000 });
            }
          } else {
            this.firstFormGroup.controls['encryptedData'].setValue(content.trim());
            this.snackBar.open('Loaded file content', 'OK', { duration: 3000 });
          }
        } catch (error) {
          console.error(error);
          this.snackBar.open('Error reading file', 'Close', { duration: 3000 });
        } finally {
          this.isFileProcessing = false;
        }
      };

      reader.readAsText(file);
    }
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

  async onSubmit() {
    if (this.firstFormGroup.valid && this.secondFormGroup.valid && this.thirdFormGroup.valid) {
      const encryptedData = this.firstFormGroup.controls['encryptedData'].value;
      const reverseKey = this.secondFormGroup.controls['reverseKey'].value;
      const password = this.thirdFormGroup.controls['password'].value;

      try {
        const result = await this.cryptService.decrypt(encryptedData, reverseKey, password);
        this.decryptedMnemonic = result.decrypted;

        if (result.isLegacy) {
          this.snackBar.open('Notice: Legacy encryption detected. Please re-encrypt your data for enhanced security.', 'OK', {
            duration: 10000,
            panelClass: ['legacy-warning-snackbar'],
            verticalPosition: 'top',
            horizontalPosition: 'center',
          });
        }

        this.showResult = true;
        this.error = '';
      } catch (e) {
        this.error = 'Decryption failed. Please check your inputs and password.';
        console.error(e);
        this.showResult = true;
      }
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
