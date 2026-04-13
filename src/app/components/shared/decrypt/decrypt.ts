import { Component, Input, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { TextFieldModule } from '@angular/cdk/text-field';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MaterialModule } from '../../../modules/material/material';
import { CryptService } from '../../../services/crypt';
import { SteganographyService } from '../../../services/steganography.service';
import { VirtualKeyboard } from '../../virtual-keyboard/virtual-keyboard';
import { QrReceiver } from '../qr-receiver/qr-receiver';
import { VaultService } from '../../../services/vault';

@Component({
  selector: 'app-shared-decrypt',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, TextFieldModule, MaterialModule, VirtualKeyboard, QrReceiver],
  templateUrl: './decrypt.html',
  styleUrl: './decrypt.scss',
})
export class SharedDecryptComponent {
  @Input() protocolTitle = '';
  @Input() protocolSummary = '';
  @Input() protocolLink = '';

  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  thirdFormGroup: FormGroup;
  showResult = false;
  decryptedMnemonic = '';
  error = '';
  isV5Payload = true;
  isV8Payload = true;
  showReverseKeyStep = false;

  inputType: 'text' | 'file' = 'text';
  fileName = '';
  isFileProcessing = false;
  showQrReceiver = false;

  virtualKeyboardEnabled = false;
  useVaultSignature = false;
  useHardwareId = false;
  vaultService = inject(VaultService);

  private fb = inject(FormBuilder);
  private cryptService = inject(CryptService);
  private steganographyService = inject(SteganographyService);
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
      password: ['', Validators.required],
    });

    this.firstFormGroup.controls['encryptedData'].valueChanges.subscribe((val) => {
      try {
        if (val && val.trim().startsWith('{')) {
          const parsed = JSON.parse(val);
          const v = parsed.v || 0;

          // ML-KEM Identity Decryption (V5+)
          this.isV5Payload = v >= 5;

          // Deterministic Gauntlet (V8+) - No Reverse Key required
          this.isV8Payload = v >= 8;
          this.showReverseKeyStep = v < 8;

          if (this.isV5Payload) {
            this.thirdFormGroup.controls['password'].clearValidators();
          } else {
            this.thirdFormGroup.controls['password'].setValidators([Validators.required]);
          }

          if (!this.showReverseKeyStep) {
            this.secondFormGroup.controls['reverseKey'].clearValidators();
          } else {
            this.secondFormGroup.controls['reverseKey'].setValidators([Validators.required]);
          }

          this.thirdFormGroup.controls['password'].updateValueAndValidity();
          this.secondFormGroup.controls['reverseKey'].updateValueAndValidity();
          return;
        }
      } catch {
        // Ignore parse errors as it might be legacy text data
      }
      this.isV5Payload = false;
      this.isV8Payload = false;
      this.showReverseKeyStep = true;
      this.thirdFormGroup.controls['password'].setValidators([Validators.required]);
      this.secondFormGroup.controls['reverseKey'].setValidators([Validators.required]);
      this.thirdFormGroup.controls['password'].updateValueAndValidity();
      this.secondFormGroup.controls['reverseKey'].updateValueAndValidity();
    });
  }

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

      reader.onload = async (e: ProgressEvent<FileReader>) => {
        try {
          const content = e.target?.result as string;

          if (!content) return;

          // Detect Mode
          const mode = this.steganographyService.detectMode(file.name, content);

          if (mode === 'image') {
            // Handle Image Extraction
            try {
              const extractedData = await this.steganographyService.revealFromImage(file);
              if (extractedData) {
                this.firstFormGroup.controls['encryptedData'].setValue(extractedData);
                this.snackBar.open(`Extracted payload from Image`, 'OK', { duration: 3000 });
              } else {
                this.snackBar.open('Could not find hidden payload in image', 'Error', { duration: 3000 });
              }
            } catch (err) {
              console.error(err);
              this.snackBar.open('Error extracting from image', 'Close', { duration: 3000 });
            }
          } else if (mode) {
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

  onQrScanned(payload: string) {
    if (payload) {
      this.firstFormGroup.controls['encryptedData'].setValue(payload);
      this.showQrReceiver = false;
      this.snackBar.open('Optical payload successfully received!', 'Close', { duration: 3000 });
    }
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

  async onSubmit() {
    if (this.firstFormGroup.valid && (this.secondFormGroup.valid || !this.showReverseKeyStep) && (this.thirdFormGroup.valid || this.isV5Payload)) {
      const { encryptedData } = this.firstFormGroup.value;
      const reverseKey = this.showReverseKeyStep ? this.secondFormGroup.value.reverseKey : '';
      let passwordOrSk = this.thirdFormGroup.controls['password'].value;

      if (this.isV5Payload) {
        if (!this.vaultService.isUnlocked()) {
          this.error = 'Decryption failed: Vault is locked. ML-KEM-1024 Private Key is unavailable.';
          this.showResult = true;
          return;
        }
        const id = this.vaultService.identity();
        if (!id || !id.pqcPrivateKey) {
          this.error = 'Decryption failed: Vault Identity does not contain a valid ML-KEM-1024 Private Key.';
          this.showResult = true;
          return;
        }
        // Convert Base64 PQC Private Key to Hex
        const rawBody = atob(id.pqcPrivateKey);
        let skHex = '';
        for (let i = 0; i < rawBody.length; i++) {
          const hex = rawBody.charCodeAt(i).toString(16);
          skHex += hex.length === 2 ? hex : '0' + hex;
        }
        passwordOrSk = skHex;
      }

      if (this.useVaultSignature && this.vaultService.isUnlocked()) {
        const id = this.vaultService.identity();
        if (id && id.privateKey && id.privateKey.d) {
          passwordOrSk = passwordOrSk + id.privateKey.d;
        } else if (!this.isV5Payload) {
          console.error('Failed to retrieve vault identity private key');
          this.error = 'Decryption failed: Unable to compute vault signature (Identity missing).';
          this.showResult = true;
          return;
        }
      }

      let hwid: string | undefined = undefined;

      if (this.useHardwareId) {
        const hwId = await this.vaultService.getHardwareId();
        if (hwId) {
          hwid = hwId;
        } else {
          console.error('Failed to retrieve Machine Hardware ID');
          this.error = 'Decryption failed: Unable to retrieve Machine Hardware ID from system.';
          this.showResult = true;
          return;
        }
      }

      try {
        const result = await this.cryptService.decrypt(encryptedData, reverseKey, passwordOrSk, hwid);
        this.decryptedMnemonic = result.decrypted;

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
    this.isV5Payload = false;
    this.virtualKeyboardEnabled = false;
    this.inputType = 'text';
    this.fileName = '';
    this.showQrReceiver = false;
    this.useVaultSignature = false;
    this.useHardwareId = false;
  }

  onVirtualKeyPress(key: string) {
    const currentVal = this.thirdFormGroup.controls['password'].value || '';
    this.thirdFormGroup.controls['password'].setValue(currentVal + key);
    this.thirdFormGroup.controls['password'].markAsDirty();
  }

  onVirtualBackspace() {
    const currentVal = this.thirdFormGroup.controls['password'].value || '';
    if (currentVal.length > 0) {
      this.thirdFormGroup.controls['password'].setValue(currentVal.slice(0, -1));
    }
  }
}
