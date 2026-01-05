import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Encrypt } from './encrypt';
import { CryptService } from '../../../services/crypt';

describe('Encrypt', () => {
  let component: Encrypt;
  let fixture: ComponentFixture<Encrypt>;
  let cryptService: CryptService;

  // Use a 24-word phrase for testing validation
  const testMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
  const testPassword = 'password123';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Encrypt, BrowserAnimationsModule],
      providers: [CryptService], // Provide the real service
    }).compileComponents();

    fixture = TestBed.createComponent(Encrypt);
    component = fixture.componentInstance;
    cryptService = TestBed.inject(CryptService); // Get the service instance
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have an invalid form if the recovery phrase is not 12 or 24 words', () => {
    component.firstFormGroup.controls['firstCtrl'].setValue('one two three');
    expect(component.firstFormGroup.valid).toBeFalsy();
  });

  it('should have a valid form if the recovery phrase has 24 words', () => {
    component.firstFormGroup.controls['firstCtrl'].setValue(testMnemonic);
    expect(component.firstFormGroup.valid).toBeTruthy();
  });

  it('should have a valid form if the recovery phrase has 12 words', () => {
    const twelveWords = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
    component.firstFormGroup.controls['firstCtrl'].setValue(twelveWords);
    expect(component.firstFormGroup.valid).toBeTruthy();
  });

  it('should have an invalid form if the password is empty', () => {
    expect(component.secondFormGroup.valid).toBeFalsy();
  });

  it('should have a valid form when a password is provided', () => {
    component.secondFormGroup.controls['secondCtrl'].setValue(testPassword);
    expect(component.secondFormGroup.valid).toBeTruthy();
  });

  it('should call the cryptService.encrypt method on valid form submission', () => {
    // Spy on the service method to ensure it's called
    const encryptSpy = spyOn(cryptService, 'encrypt').and.callThrough();

    // Set valid form values
    component.firstFormGroup.controls['firstCtrl'].setValue(testMnemonic);
    component.secondFormGroup.controls['secondCtrl'].setValue(testPassword);

    // Trigger form submission
    component.onSubmit();

    // Expect the spy to have been called with the correct values
    expect(encryptSpy).toHaveBeenCalledWith(testMnemonic, testPassword);
  });

  it('should display the result card with encrypted data after submission', () => {
    // Set valid form values
    component.firstFormGroup.controls['firstCtrl'].setValue(testMnemonic);
    component.secondFormGroup.controls['secondCtrl'].setValue(testPassword);

    // Trigger submission
    component.onSubmit();
    fixture.detectChanges(); // Update the DOM

    // Check component properties
    expect(component.showResult).toBe(true);
    expect(component.encryptedData).toBeDefined();
    expect(component.encryptedData.length).toBeGreaterThan(0);
    expect(component.reverseKey).toBeDefined();
    expect(component.reverseKey.length).toBeGreaterThan(0);

    // Check if the result card is rendered in the DOM
    const resultCard = fixture.nativeElement.querySelector('mat-card-title');
    expect(resultCard).toBeTruthy();
    expect(resultCard.textContent).toContain('Encryption Successful');
  });

  it('should reset the form and hide the result card', () => {
    // Set initial state
    component.firstFormGroup.controls['firstCtrl'].setValue(testMnemonic);
    component.secondFormGroup.controls['secondCtrl'].setValue(testPassword);
    component.showResult = true;
    component.encryptedData = 'some-encrypted-data';
    component.reverseKey = 'some-reverse-key';
    fixture.detectChanges();

    // Trigger the reset
    component.reset();
    fixture.detectChanges();

    // Check that the form is reset
    expect(component.firstFormGroup.controls['firstCtrl'].value).toBeNull();
    expect(component.secondFormGroup.controls['secondCtrl'].value).toBeNull();

    // Check that the result is hidden
    expect(component.showResult).toBe(false);
    expect(component.encryptedData).toBe('');
    expect(component.reverseKey).toBe('');

    // Check that the result card is no longer in the DOM
    const resultCardTitle = fixture.nativeElement.querySelector('.result-actions');
    expect(resultCardTitle).toBeFalsy();
  });
});
