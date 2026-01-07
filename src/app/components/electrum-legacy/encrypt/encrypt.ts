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
import ElectrumLegacy from '../../../../assets/electrum-legacy.json';
import { CryptService } from '../../../services/crypt';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-electrum-legacy-encrypt',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TextFieldModule, MaterialModule],
  templateUrl: './encrypt.html',
  styleUrl: './encrypt.scss',
})
export class ElectrumLegacyEncrypt {
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  showResult = false;
  encryptedData = '';
  reverseKey = '';

  private _formBuilder = inject(FormBuilder);
  private cryptService = inject(CryptService);
  private clipboard = inject(Clipboard);

  private snackBar = inject(MatSnackBar);

  protocolTitle = ElectrumLegacy.title;
  protocolSummary = ElectrumLegacy.summary;
  protocolLink = ElectrumLegacy.link;

  constructor() {
    this.firstFormGroup = this._formBuilder.group({
      firstCtrl: ['', [Validators.required]],
    });
    this.secondFormGroup = this._formBuilder.group({
      secondCtrl: ['', Validators.required],
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
    const words = ElectrumLegacy.words;
    let randomWords = '';
    // Electrum Legacy standard is typically 12 words
    for (let i = 0; i < 12; i++) {
      randomWords += words[Math.floor(Math.random() * words.length)] + ' ';
    }
    this.firstFormGroup.controls['firstCtrl'].setValue(randomWords.trim());
  }

  async onSubmit() {
    if (this.secondFormGroup.valid && this.firstFormGroup.valid) {
      const mnemonic = this.firstFormGroup.controls['firstCtrl'].value;
      const password = this.secondFormGroup.controls['secondCtrl'].value;

      const { encryptedData, reverseKey } = await this.cryptService.encrypt(mnemonic, password);

      this.encryptedData = encryptedData;
      this.reverseKey = reverseKey;
      this.showResult = true;
    }
  }

  copyToClipboard(content: string) {
    this.clipboard.copy(content);
    this.snackBar.open('Copied to clipboard', 'Close', { duration: 2000 });
  }

  reset() {
    this.showResult = false;
    this.firstFormGroup.reset();
    this.secondFormGroup.reset();
  }
}
