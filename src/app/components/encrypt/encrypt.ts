import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MaterialModule } from '../../modules/material-module';
import BIP39 from '../../../assets/BIP39.json';
import { CryptService } from '../../services/crypt';

@Component({
  selector: 'app-encrypt',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TextFieldModule,
    MaterialModule
  ],
  templateUrl: './encrypt.html',
  styleUrl: './encrypt.scss'
})
export class Encrypt {
  firstFormGroup: FormGroup;
  secondFormGroup: FormGroup;
  isLoading = false;

  constructor(private _formBuilder: FormBuilder, private cryptService: CryptService) {
    this.firstFormGroup = this._formBuilder.group({
      firstCtrl: ['', [Validators.required, this.minWordsValidator(24)]]
    });
    this.secondFormGroup = this._formBuilder.group({
      secondCtrl: ['', Validators.required]
    });
  }

  onSubmit() {
    if (this.firstFormGroup.valid && this.secondFormGroup.valid) {
      this.isLoading = true;
      setTimeout(() => {
        const words = this.firstFormGroup.controls['firstCtrl'].value.trim().split(/[ ,]+/);
        const password = this.secondFormGroup.controls['secondCtrl'].value;

        const nonSeededFunctions: ((input: string) => string)[] = [
          this.cryptService.obfuscateByReversing,
          this.cryptService.obfuscateToCharCodes,
          this.cryptService.obfuscateToBinary,
          this.cryptService.obfuscateToHex,
          this.cryptService.obfuscateWithCaesarCipher,
          this.cryptService.obfuscateWithAtbashCipher,
          this.cryptService.obfuscateToLeet,
          this.cryptService.obfuscateByInterleaving,
          this.cryptService.obfuscateWithCaesarCipher7,
          this.cryptService.obfuscateWithCustomSeparator,
          this.cryptService.obfuscateWithBitwiseNot,
          this.cryptService.obfuscateToMorseCode,
          this.cryptService.obfuscateWithKeyboardShift,
          this.cryptService.obfuscateToHtmlEntities,
          this.cryptService.obfuscateToOctal,
          this.cryptService.obfuscateWithNibbleSwap,
          this.cryptService.obfuscateWithVowelRotation,
          this.cryptService.obfuscateWithIndexMath,
          this.cryptService.obfuscateWithMirrorCase,
          this.cryptService.obfuscateWithIndexInterleave,
          this.cryptService.obfuscateBySwappingAdjacentChars,
        ].map(f => f.bind(this.cryptService));

        const seededFunctions: ((input: string, seed: string) => string)[] = [
          this.cryptService.obfuscateByShuffling,
          this.cryptService.obfuscateWithXOR,
        ].map(f => f.bind(this.cryptService));
        
        const asciiShift = (input: string, seed: string) => this.cryptService.obfuscateWithAsciiShift(input, parseInt(seed, 10));
        seededFunctions.push(asciiShift.bind(this.cryptService));


        // Select 11 non-seeded functions
        const selectedNonSeeded = this.getRandomSubarray(nonSeededFunctions, 11);

        // Select 1 seeded function
        const selectedSeeded = this.getRandomSubarray(seededFunctions, 1)[0];

        const allFunctions = [...selectedNonSeeded, (input: string) => selectedSeeded(input, password)];
        this.shuffleArray(allFunctions);

        const functionSequence: number[] = [];
        const obfuscatedWords: string[] = [];

        for (let i = 0; i < words.length; i++) {
          const funcIndex = i % allFunctions.length;
          const func = allFunctions[funcIndex];
          obfuscatedWords.push(func(words[i]));
          functionSequence.push(funcIndex);
        }

        const functionSequenceString = functionSequence.join(',');

        const payload = [
          obfuscatedWords.join(' '),
          selectedNonSeeded.map(f => this.getFunctionName(f)).join(','),
          this.getFunctionName(selectedSeeded)
        ].join('||');

        const encrypted = this.cryptService.encryptAES256(payload, password);
        const reverseKey = functionSequenceString;

        console.log('Encrypted Payload:', encrypted);
        console.log('Reverse Key:', reverseKey);
        this.isLoading = false;
      }, 0);
    }
  }

  private getFunctionName(fn: Function): string {
    const allFunctions: {[key: string]: Function} = {
      'obfuscateByReversing': this.cryptService.obfuscateByReversing,
      'obfuscateToCharCodes': this.cryptService.obfuscateToCharCodes,
      'obfuscateToBinary': this.cryptService.obfuscateToBinary,
      'obfuscateToHex': this.cryptService.obfuscateToHex,
      'obfuscateWithCaesarCipher': this.cryptService.obfuscateWithCaesarCipher,
      'obfuscateWithAtbashCipher': this.cryptService.obfuscateWithAtbashCipher,
      'obfuscateToLeet': this.cryptService.obfuscateToLeet,
      'obfuscateByInterleaving': this.cryptService.obfuscateByInterleaving,
      'obfuscateWithCaesarCipher7': this.cryptService.obfuscateWithCaesarCipher7,
      'obfuscateWithCustomSeparator': this.cryptService.obfuscateWithCustomSeparator,
      'obfuscateWithBitwiseNot': this.cryptService.obfuscateWithBitwiseNot,
      'obfuscateToMorseCode': this.cryptService.obfuscateToMorseCode,
      'obfuscateWithKeyboardShift': this.cryptService.obfuscateWithKeyboardShift,
      'obfuscateToHtmlEntities': this.cryptService.obfuscateToHtmlEntities,
      'obfuscateToOctal': this.cryptService.obfuscateToOctal,
      'obfuscateWithNibbleSwap': this.cryptService.obfuscateWithNibbleSwap,
      'obfuscateWithVowelRotation': this.cryptService.obfuscateWithVowelRotation,
      'obfuscateWithIndexMath': this.cryptService.obfuscateWithIndexMath,
      'obfuscateWithMirrorCase': this.cryptService.obfuscateWithMirrorCase,
      'obfuscateWithIndexInterleave': this.cryptService.obfuscateWithIndexInterleave,
      'obfuscateBySwappingAdjacentChars': this.cryptService.obfuscateBySwappingAdjacentChars,
      'obfuscateByShuffling': this.cryptService.obfuscateByShuffling,
      'obfuscateWithXOR': this.cryptService.obfuscateWithXOR,
      'obfuscateWithAsciiShift': this.cryptService.obfuscateWithAsciiShift
    };

    for (const name in allFunctions) {
      if (allFunctions[name].toString() === fn.toString()) {
        return name;
      }
    }
    // Special case for the wrapped ascii shift
    if (fn.toString().includes('obfuscateWithAsciiShift')) {
        return 'obfuscateWithAsciiShift';
    }

    return 'unknown';
  }

  private getRandomSubarray<T>(arr: T[], size: number): T[] {
    const shuffled = arr.slice(0);
    let i = arr.length;
    let temp: T;
    let index: number;
    while (i--) {
      index = Math.floor((i + 1) * Math.random());
      temp = shuffled[index];
      shuffled[index] = shuffled[i];
      shuffled[i] = temp;
    }
    return shuffled.slice(0, size);
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  minWordsValidator(minWords: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;
      if (!value) {
        return null;
      }
      const words = value.trim().split(/[ ,]+/).filter(Boolean);
      return words.length >= minWords ? null : { minWords: { required: minWords, actual: words.length } };
    };
  }

  generateRandomWords() {
    const words = BIP39.words;
    let randomWords = '';
    for (let i = 0; i < 24; i++) {
      randomWords += words[Math.floor(Math.random() * words.length)] + ' ';
    }
    this.firstFormGroup.controls['firstCtrl'].setValue(randomWords.trim());
  }
}
