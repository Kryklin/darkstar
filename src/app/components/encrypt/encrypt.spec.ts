import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Encrypt } from './encrypt';
import { CryptService } from '../../services/crypt';

class MockCryptService {
  encryptAES256(data: string, password: string): string {
    return 'encrypted-data';
  }
  // Add any other methods from CryptService that are used in the component
  obfuscateByReversing = (input: string) => input.split('').reverse().join('');
  obfuscateToCharCodes = (input: string) => input.split('').map(c => c.charCodeAt(0)).join(' ');
  obfuscateToBinary = (input: string) => input.split('').map(c => c.charCodeAt(0).toString(2)).join(' ');
  obfuscateToHex = (input: string) => input.split('').map(c => c.charCodeAt(0).toString(16)).join(' ');
  obfuscateWithCaesarCipher = (input: string) => input;
  obfuscateWithAtbashCipher = (input: string) => input;
  obfuscateToLeet = (input: string) => input;
  obfuscateByInterleaving = (input: string) => input;
  obfuscateWithCaesarCipher7 = (input: string) => input;
  obfuscateWithCustomSeparator = (input: string) => input.split('').join('-');
  obfuscateWithBitwiseNot = (input: string) => input;
  obfuscateToMorseCode = (input: string) => input;
  obfuscateWithKeyboardShift = (input: string) => input;
  obfuscateToHtmlEntities = (input: string) => input;
  obfuscateToOctal = (input: string) => input;
  obfuscateWithNibbleSwap = (input: string) => input;
  obfuscateWithVowelRotation = (input: string) => input;
  obfuscateWithIndexMath = (input: string) => input;
  obfuscateWithMirrorCase = (input: string) => input;
  obfuscateWithIndexInterleave = (input: string) => input;
  obfuscateBySwappingAdjacentChars = (input: string) => input;
  obfuscateByShuffling = (input: string, seed: string) => input;
  obfuscateWithXOR = (input: string, key: string) => input;
  obfuscateWithAsciiShift = (input: string, shift: number) => input;
}

describe('Encrypt', () => {
  let component: Encrypt;
  let fixture: ComponentFixture<Encrypt>;
  let cryptService: CryptService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Encrypt, BrowserAnimationsModule],
      providers: [
        { provide: CryptService, useClass: MockCryptService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Encrypt);
    component = fixture.componentInstance;
    cryptService = TestBed.inject(CryptService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have an invalid form when the recovery phrase is less than 24 words', () => {
    component.firstFormGroup.controls['firstCtrl'].setValue('one two three');
    expect(component.firstFormGroup.valid).toBeFalsy();
  });

  it('should have a valid form when the recovery phrase is 24 words', () => {
    const phrase = Array(24).fill('word').join(' ');
    component.firstFormGroup.controls['firstCtrl'].setValue(phrase);
    expect(component.firstFormGroup.valid).toBeTruthy();
  });

  it('should have an invalid form when the password is empty', () => {
    expect(component.secondFormGroup.valid).toBeFalsy();
  });

  it('should have a valid form when a password is provided', () => {
    component.secondFormGroup.controls['secondCtrl'].setValue('password123');
    expect(component.secondFormGroup.valid).toBeTruthy();
  });

  it('should generate 24 random words', () => {
    component.generateRandomWords();
    const words = component.firstFormGroup.controls['firstCtrl'].value.split(' ');
    expect(words.length).toBe(24);
  });

  it('should show result card on submit', () => {
    const phrase = Array(24).fill('word').join(' ');
    component.firstFormGroup.controls['firstCtrl'].setValue(phrase);
    component.secondFormGroup.controls['secondCtrl'].setValue('password123');
    
    component.onSubmit();
    fixture.detectChanges();
    
    expect(component.showResult).toBe(true);
    expect(component.encryptedData).toBe('encrypted-data');
    expect(component.reverseKey).toBeDefined();
    const resultCard = fixture.nativeElement.querySelector('mat-card-title');
    expect(resultCard.textContent).toContain('Encryption Successful');
  });

  it('should call encryptAES256 on submit', () => {
    const phrase = Array(24).fill('word').join(' ');
    component.firstFormGroup.controls['firstCtrl'].setValue(phrase);
    component.secondFormGroup.controls['secondCtrl'].setValue('password123');
    
    const encryptSpy = spyOn(cryptService, 'encryptAES256').and.callThrough();
    
    component.onSubmit();
    
    expect(encryptSpy).toHaveBeenCalled();
  });

  it('should reset the state when reset() is called', () => {
    // Set the component to the result state
    component.showResult = true;
    component.encryptedData = 'some-data';
    component.reverseKey = 'some-key';
    component.firstFormGroup.controls['firstCtrl'].setValue('some words');
    component.secondFormGroup.controls['secondCtrl'].setValue('some password');

    component.reset();
    fixture.detectChanges();

    expect(component.showResult).toBe(false);
    expect(component.encryptedData).toBe('');
    expect(component.reverseKey).toBe('');
    expect(component.firstFormGroup.pristine).toBe(true);
    expect(component.secondFormGroup.pristine).toBe(true);
    const formCard = fixture.nativeElement.querySelector('mat-card-title');
    expect(formCard.textContent).toContain('BIP39 Mnemonic Encryption');
  });
});

