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
import ElectrumV2 from '../../../../assets/electrum-v2.json';
import { CryptService } from '../../../services/crypt';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-electrum-v2-encrypt',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TextFieldModule, MaterialModule],
  templateUrl: './encrypt.html',
  styleUrl: './encrypt.scss',
})
export class ElectrumV2Encrypt {
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  showResult = false;
  encryptedData = '';
  reverseKey = '';

  private _formBuilder = inject(FormBuilder);
  private cryptService = inject(CryptService);
  private clipboard = inject(Clipboard);

  private snackBar = inject(MatSnackBar);

  protocolTitle = ElectrumV2.title;
  protocolSummary = ElectrumV2.summary;
  protocolLink = ElectrumV2.link;

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
      return allowedCounts.includes(words.length)
        ? null
        : { allowedWordCounts: { required: allowedCounts, actual: words.length } };
    };
  }



  generateRandomWords() {
    const words = ElectrumV2.words;
    let randomWords = '';
    // Electrum V2 standard is typically 12 words
    for (let i = 0; i < 12; i++) {
        randomWords += words[Math.floor(Math.random() * words.length)] + ' ';
    }
    this.firstFormGroup.controls['firstCtrl'].setValue(randomWords.trim());
  }

  onSubmit() {
    if (this.secondFormGroup.valid && this.firstFormGroup.valid) {
       const mnemonic = this.firstFormGroup.controls['firstCtrl'].value;
       const password = this.secondFormGroup.controls['secondCtrl'].value;

       const { encryptedData, reverseKey } = this.cryptService.encrypt(mnemonic, password);

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
