import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MaterialModule } from '../../../modules/material/material';
import BIP39 from '../../../../assets/BIP39.json';
import { CryptService } from '../../../services/crypt';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-encrypt',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TextFieldModule, MaterialModule],
  templateUrl: './encrypt.html',
  styleUrl: './encrypt.scss',
})
/**
 * Handles the encryption workflow: accepting mnemonic input, password generation,
 * and displaying the final encrypted output + reverse key.
 */
export class Encrypt {
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  showResult = false;
  encryptedData = '';
  reverseKey = '';

  private _formBuilder = inject(FormBuilder);
  private cryptService = inject(CryptService);
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);

  protocolTitle = BIP39.title;
  protocolSummary = BIP39.summary;
  protocolLink = BIP39.link;

  constructor() {
    this.firstFormGroup = this._formBuilder.group({
      firstCtrl: ['', [Validators.required, this.allowedWordCountsValidator([12, 24])]],
    });
    this.secondFormGroup = this._formBuilder.group({
      secondCtrl: ['', Validators.required],
    });
  }

  async onSubmit() {
    if (this.firstFormGroup.valid && this.secondFormGroup.valid) {
      const mnemonic = this.firstFormGroup.controls['firstCtrl'].value;
      const password = this.secondFormGroup.controls['secondCtrl'].value;

      const { encryptedData, reverseKey } = await this.cryptService.encrypt(mnemonic, password);

      this.encryptedData = encryptedData;
      this.reverseKey = reverseKey;
      this.showResult = true;
    }
  }

  copyToClipboard(text: string) {
    this.clipboard.copy(text);
    this.snackBar.open('Copied to clipboard!', 'Close', {
      duration: 2000,
    });
  }

  allowedWordCountsValidator(allowedCounts: number[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;
      if (!value) {
        return null;
      }
      const words = value.trim().split(/[ ,]+/).filter(Boolean);
      return allowedCounts.includes(words.length) ? null : { allowedWordCounts: { required: allowedCounts, actual: words.length } };
    };
  }

  generateRandomWords() {
    const words = BIP39.words;
    const array = new Uint32Array(24);
    window.crypto.getRandomValues(array);

    let randomWords = '';
    for (let i = 0; i < 24; i++) {
      const index = array[i] % words.length;
      randomWords += words[index] + ' ';
    }
    this.firstFormGroup.controls['firstCtrl'].setValue(randomWords.trim());
  }

  reset() {
    this.firstFormGroup.reset();
    this.secondFormGroup.reset();
    this.showResult = false;
    this.encryptedData = '';
    this.reverseKey = '';
  }
}
