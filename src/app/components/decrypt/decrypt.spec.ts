import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { Decrypt } from './decrypt';
import { CryptService } from '../../services/crypt';
import { MaterialModule } from '../../modules/material/material';

describe('Decrypt', () => {
  let component: Decrypt;
  let fixture: ComponentFixture<Decrypt>;
  let cryptService: CryptService;
  let decryptSpy: jasmine.Spy;

  const testEncryptedData = 'U2FsdGVkX1/encryptedData';
  const testReverseKey = 'base64ReverseKey';
  const testPassword = 'password123';
  const testDecryptedMnemonic = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        Decrypt,
        BrowserAnimationsModule,
        MaterialModule,
        ReactiveFormsModule
      ],
      providers: [CryptService]
    }).compileComponents();

    fixture = TestBed.createComponent(Decrypt);
    component = fixture.componentInstance;
    cryptService = TestBed.inject(CryptService);
    decryptSpy = spyOn(cryptService, 'decrypt');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize three form groups', () => {
    expect(component.firstFormGroup).toBeDefined();
    expect(component.secondFormGroup).toBeDefined();
    expect(component.thirdFormGroup).toBeDefined();
  });

  it('should have invalid form groups initially', () => {
    expect(component.firstFormGroup.valid).toBeFalsy();
    expect(component.secondFormGroup.valid).toBeFalsy();
    expect(component.thirdFormGroup.valid).toBeFalsy();
  });

  it('should have valid form groups after filling them', () => {
    component.firstFormGroup.setValue({ encryptedData: testEncryptedData });
    component.secondFormGroup.setValue({ reverseKey: testReverseKey });
    component.thirdFormGroup.setValue({ password: testPassword });

    expect(component.firstFormGroup.valid).toBeTruthy();
    expect(component.secondFormGroup.valid).toBeTruthy();
    expect(component.thirdFormGroup.valid).toBeTruthy();
  });

  describe('onSubmit', () => {
    beforeEach(() => {
      component.firstFormGroup.setValue({ encryptedData: testEncryptedData });
      component.secondFormGroup.setValue({ reverseKey: testReverseKey });
      component.thirdFormGroup.setValue({ password: testPassword });
    });

    it('should call cryptService.decrypt and show mnemonic on success', () => {
      decryptSpy.and.returnValue(testDecryptedMnemonic);

      component.onSubmit();

      expect(decryptSpy).toHaveBeenCalledWith(testEncryptedData, testReverseKey, testPassword);
      expect(component.showResult).toBeTrue();
      expect(component.decryptedMnemonic).toBe(testDecryptedMnemonic);
      expect(component.error).toBe('');
    });

    it('should show an error message if decryption fails', () => {
      const errorMessage = 'Decryption failed';
      decryptSpy.and.throwError(new Error(errorMessage));

      component.onSubmit();

      expect(decryptSpy).toHaveBeenCalledWith(testEncryptedData, testReverseKey, testPassword);
      expect(component.showResult).toBeTrue();
      expect(component.decryptedMnemonic).toBe('');
      expect(component.error).toContain(errorMessage);
    });

    it('should not call cryptService.decrypt if forms are invalid', () => {
      component.firstFormGroup.reset();
      component.onSubmit();
      expect(decryptSpy).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset all form groups and result state', () => {
      component.firstFormGroup.setValue({ encryptedData: testEncryptedData });
      component.secondFormGroup.setValue({ reverseKey: testReverseKey });
      component.thirdFormGroup.setValue({ password: testPassword });
      component.showResult = true;
      component.decryptedMnemonic = testDecryptedMnemonic;
      component.error = 'some error';

      component.reset();

      expect(component.firstFormGroup.pristine).toBeTrue();
      expect(component.firstFormGroup.value.encryptedData).toBeNull();
      expect(component.secondFormGroup.pristine).toBeTrue();
      expect(component.secondFormGroup.value.reverseKey).toBeNull();
      expect(component.thirdFormGroup.pristine).toBeTrue();
      expect(component.thirdFormGroup.value.password).toBeNull();
      expect(component.showResult).toBeFalse();
      expect(component.decryptedMnemonic).toBe('');
      expect(component.error).toBe('');
    });
  });
});
