import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MaterialModule } from '../../modules/material/material';
import { CryptService } from '../../services/crypt';
import { CommonModule } from '@angular/common';

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
  form: FormGroup;
  showResult = false;
  decryptedMnemonic: string = '';
  error: string = '';

  constructor(private fb: FormBuilder, private cryptService: CryptService) {
    this.form = this.fb.group({
      encryptedData: ['', Validators.required],
      reverseKey: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.form.valid) {
      const { encryptedData, reverseKey, password } = this.form.value;
      try {
        this.decryptedMnemonic = this.cryptService.decrypt(encryptedData, reverseKey, password);
        this.error = '';
        this.showResult = true;
      } catch (e: any) {
        this.error = `Decryption failed: ${e.message}`;
        this.decryptedMnemonic = '';
        this.showResult = true;
      }
    }
  }

  reset() {
    this.form.reset();
    this.showResult = false;
    this.decryptedMnemonic = '';
    this.error = '';
  }
}
