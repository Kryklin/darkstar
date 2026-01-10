import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MaterialModule } from '../../../modules/material/material';
import { CryptService } from '../../../services/crypt';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SteganographyService } from '../../../services/steganography.service';
import { StealthMode } from '../../../services/generators/types';
import { VirtualKeyboard } from '../../virtual-keyboard/virtual-keyboard';
import { EntropyMeter } from '../../entropy-meter/entropy-meter';
import { PaperWalletService } from '../../../services/paper-wallet.service';

@Component({
  selector: 'app-shared-encrypt',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TextFieldModule, MaterialModule, VirtualKeyboard, EntropyMeter],
  templateUrl: './encrypt.html',
  styleUrl: './encrypt.scss',
})
export class SharedEncryptComponent implements OnInit {
  @Input() protocolTitle = '';
  @Input() protocolSummary = '';
  @Input() protocolLink = '';
  @Input() mnemonicLabel = 'Insert your recovery phrase';
  @Input() mnemonicPlaceholder = 'e.g. word1 word2...';
  @Input() mnemonicValidator: ValidatorFn | null = null;
  @Input() randomWordsGenerator: (() => string) | null = null;

  // Events
  @Output() generateRandom = new EventEmitter<void>();

  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  showResult = false;
  encryptedData = '';
  reverseKey = '';

  // Steganography Options
  stealthMode: StealthMode | 'standard' = 'standard';
  stealthModes = [
    { value: 'standard', label: 'Standard (Text)' },
    { value: 'log', label: 'System Log (.log)' },
    { value: 'csv', label: 'Dataset (.csv)' },
    { value: 'json', label: 'Configuration (.json)' },
    { value: 'image', label: 'Image (PNG)' },
  ];
  stealthNoiseLevel = 0.5;
  selectedCoverImage: File | null = null;

  // Virtual Keyboard
  virtualKeyboardEnabled = false;

  private _formBuilder = inject(FormBuilder);
  private cryptService = inject(CryptService);
  private steganographyService = inject(SteganographyService);
  private paperWalletService = inject(PaperWalletService);
  private clipboard = inject(Clipboard);
  private snackBar = inject(MatSnackBar);

  constructor() {
    this.firstFormGroup = this._formBuilder.group({
      firstCtrl: ['', [Validators.required]],
    });
    this.secondFormGroup = this._formBuilder.group({
      secondCtrl: ['', Validators.required],
    });
  }

  ngOnInit() {
    if (this.mnemonicValidator) {
      this.firstFormGroup.controls['firstCtrl'].addValidators(this.mnemonicValidator);
      this.firstFormGroup.controls['firstCtrl'].updateValueAndValidity();
    }
  }

  // Called by parent to set the mnemonic value (e.g. from random generator)
  setMnemonic(mnemonic: string) {
    this.firstFormGroup.controls['firstCtrl'].setValue(mnemonic);
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

  onGenerateRandomWords() {
    this.generateRandom.emit();
  }

  onCoverImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedCoverImage = input.files[0];
    }
  }

  downloadFile() {
    if (this.stealthMode === 'standard') {
      this.downloadBlob(this.encryptedData, 'encrypted_data.txt', 'text/plain');
    } else if (this.stealthMode === 'image') {
      if (!this.selectedCoverImage) {
        this.snackBar.open('Please select a cover image first.', 'Close', { duration: 3000 });
        return;
      }
      this.steganographyService
        .hideInImage(this.encryptedData, this.selectedCoverImage)
        .then((blob) => {
          this.downloadBlobObj(blob, 'stego_image.png');
        })
        .catch((err) => {
          console.error(err);
          this.snackBar.open('Failed to create stego image.', 'Close', { duration: 3000 });
        });
    } else {
      const options = { noiseLevel: this.stealthNoiseLevel };
      const content = this.steganographyService.transmute(this.encryptedData, this.stealthMode as StealthMode, options);

      let filename = 'system_debug.log';
      let mime = 'text/plain';

      if (this.stealthMode === StealthMode.CSV) {
        filename = 'dataset.csv';
        mime = 'text/csv';
      } else if (this.stealthMode === StealthMode.JSON) {
        filename = 'config.json';
        mime = 'application/json';
      }

      this.downloadBlob(content, filename, mime);
    }
  }

  downloadPaperWallet() {
    this.paperWalletService.generate(this.encryptedData, this.reverseKey, {
      protocolTitle: this.protocolTitle,
      protocolSummary: this.protocolSummary,
    });
  }

  private downloadBlob(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private downloadBlobObj(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  reset() {
    this.firstFormGroup.reset();
    this.secondFormGroup.reset();
    this.showResult = false;
    this.encryptedData = '';
    this.reverseKey = '';
    this.stealthMode = 'standard';
    this.stealthNoiseLevel = 0.5;
    this.virtualKeyboardEnabled = false;
  }

  onVirtualKeyPress(key: string) {
    const currentVal = this.secondFormGroup.controls['secondCtrl'].value || '';
    this.secondFormGroup.controls['secondCtrl'].setValue(currentVal + key);
    this.secondFormGroup.controls['secondCtrl'].markAsDirty();
  }

  onVirtualBackspace() {
    const currentVal = this.secondFormGroup.controls['secondCtrl'].value || '';
    if (currentVal.length > 0) {
      this.secondFormGroup.controls['secondCtrl'].setValue(currentVal.slice(0, -1));
    }
  }
}
