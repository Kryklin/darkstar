import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Decrypt } from './decrypt';
import { CryptService } from '../../services/crypt';
import { MaterialModule } from '../../modules/material/material';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

describe('Decrypt', () => {
  let component: Decrypt;
  let fixture: ComponentFixture<Decrypt>;
  let cryptService: CryptService;

  const testEncryptedData = 'U2FsdGVkX1+...'; // Placeholder
  const testReverseKey = 'eyJuYW1lIjoiSm...'; // Placeholder
  const testPassword = 'password123';
  const testDecryptedMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  beforeEach(async () => {
    // Mock clipboard API
    const clipboardMock = {
      writeText: jasmine.createSpy('writeText').and.resolveTo(undefined)
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
      configurable: true
    });

    await TestBed.configureTestingModule({
      imports: [
        Decrypt,
        BrowserAnimationsModule,
        MaterialModule,
        FormsModule,
        CommonModule
      ],
      providers: [CryptService]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Decrypt);
    component = fixture.componentInstance;
    cryptService = TestBed.inject(CryptService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call cryptService.decrypt and show mnemonic on success', () => {
    const decryptSpy = spyOn(cryptService, 'decrypt').and.returnValue(testDecryptedMnemonic);

    // Set signal values
    component.encryptedData.set(testEncryptedData);
    component.reverseKey.set(testReverseKey);
    component.password.set(testPassword);

    // Trigger decryption
    component.decrypt();
    fixture.detectChanges();

    // Expect service to be called
    expect(decryptSpy).toHaveBeenCalledWith(testEncryptedData, testReverseKey, testPassword);

    // Expect result to be in the decryptedMnemonic signal
    expect(component.decryptedMnemonic()).toBe(testDecryptedMnemonic);

    // Check if the result is rendered in the DOM
    const resultElement = fixture.nativeElement.querySelector('.decrypted-mnemonic-container');
    expect(resultElement).toBeTruthy();
    const p = resultElement.querySelector('p');
    expect(p.textContent).toContain(testDecryptedMnemonic);
  });

  it('should show an error message in the signal if decryption fails', () => {
    const error = new Error('Decryption failed');
    spyOn(cryptService, 'decrypt').and.throwError(error);

    // Set signal values
    component.encryptedData.set(testEncryptedData);
    component.reverseKey.set(testReverseKey);
    component.password.set('wrongpassword');

    // Trigger decryption
    component.decrypt();
    fixture.detectChanges();

    // Check that the error message is set in the signal
    expect(component.decryptedMnemonic()).toContain('Error: Decryption failed');

    // Check if the error is rendered in the DOM
    const resultElement = fixture.nativeElement.querySelector('.decrypted-mnemonic-container');
    expect(resultElement).toBeTruthy();
    const p = resultElement.querySelector('p');
    expect(p.textContent).toContain('Error: Decryption failed');
  });

  it('should toggle password visibility', () => {
    expect(component.hidePassword()).toBe(true);
    component.togglePasswordVisibility();
    expect(component.hidePassword()).toBe(false);
    component.togglePasswordVisibility();
    expect(component.hidePassword()).toBe(true);
  });

  it('should call clipboard.writeText when copyToClipboard is called', () => {
    component.decryptedMnemonic.set(testDecryptedMnemonic);

    component.copyToClipboard();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testDecryptedMnemonic);
  });

  it('should not call clipboard.writeText if mnemonic is empty', () => {
    component.decryptedMnemonic.set('');

    component.copyToClipboard();

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });
});
