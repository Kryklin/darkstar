import { Component } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MaterialModule } from '../../modules/material-module';
import BIP39 from '../../../assets/BIP39.json';

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

  constructor(private _formBuilder: FormBuilder) {
    this.firstFormGroup = this._formBuilder.group({
      firstCtrl: ['', [Validators.required, this.minWordsValidator(24)]],
    });
    this.secondFormGroup = this._formBuilder.group({
      secondCtrl: ['', Validators.required],
    });
  }

  generateRandomWords() {
    const words = BIP39.words;
    let randomWords = '';
    for (let i = 0; i < 24; i++) {
      randomWords += words[Math.floor(Math.random() * words.length)] + ' ';
    }
    this.firstFormGroup.controls['firstCtrl'].setValue(randomWords.trim());
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
}
