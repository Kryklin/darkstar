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
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  thirdFormGroup: FormGroup;
  showResult = false;
  decryptedMnemonic: string = '';
  error: string = '';

  constructor(private fb: FormBuilder, private cryptService: CryptService) {
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

  onSubmit() {
    if (this.firstFormGroup.valid && this.secondFormGroup.valid && this.thirdFormGroup.valid) {
      const { encryptedData } = this.firstFormGroup.value;
      const { reverseKey } = this.secondFormGroup.value;
      const { password } = this.thirdFormGroup.value;
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
    this.firstFormGroup.reset();
    this.secondFormGroup.reset();
    this.thirdFormGroup.reset();
    this.showResult = false;
    this.decryptedMnemonic = '';
    this.error = '';
  }
}
