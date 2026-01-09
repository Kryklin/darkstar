import { Component, ViewChild } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { SharedEncryptComponent } from '../shared/encrypt/encrypt';
import ElectrumLegacy from '../../../assets/electrum-legacy.json';

@Component({
  selector: 'app-electrum-legacy-encrypt',
  standalone: true,
  imports: [SharedEncryptComponent],
  template: `
    <app-shared-encrypt
      [protocolTitle]="protocolTitle"
      [protocolSummary]="protocolSummary"
      [protocolLink]="protocolLink"
      mnemonicLabel="Insert the Electrum Legacy seed phrase"
      mnemonicPlaceholder="e.g. constant forest adoring..."
      [randomWordsGenerator]="generateRandomWords"
      (generateRandom)="generateRandomWords()"
    ></app-shared-encrypt>
  `,
})
export class ElectrumLegacyEncrypt {
  @ViewChild(SharedEncryptComponent) sharedEncrypt!: SharedEncryptComponent;

  protocolTitle = ElectrumLegacy.title;
  protocolSummary = ElectrumLegacy.summary;
  protocolLink = ElectrumLegacy.link;

  allowedWordCountsValidator(allowedCounts: number[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as string;
      if (!value) {
        return null;
      }
      const words = value.trim().split(/[ ,]+/).filter(Boolean);
      const allowed = allowedCounts as number[];
      return allowed.includes(words.length) ? null : { allowedWordCounts: { required: allowedCounts, actual: words.length } };
    };
  }

  generateRandomWords = () => {
    const words = ElectrumLegacy.words;
    let randomWords = '';
    // Electrum Legacy standard is typically 12 words
    for (let i = 0; i < 12; i++) {
      randomWords += words[Math.floor(Math.random() * words.length)] + ' ';
    }
    this.sharedEncrypt.setMnemonic(randomWords.trim());
    return randomWords.trim();
  };
}
