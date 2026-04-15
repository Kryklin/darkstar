import { TestBed } from '@angular/core/testing';
import { CryptService } from './crypt';

describe('CryptService', () => {
  let service: CryptService;
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const testPassword = 'mysecretpassword';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CryptService],
    });
    service = TestBed.inject(CryptService);

    // Mock Electron API
    (window as any).electronAPI = {
      dAsPEncrypt: jasmine.createSpy('dAsPEncrypt').and.resolveTo({
        encryptedData: JSON.stringify({ v: 6, data: 'mock-encrypted-data' }),
        reverseKey: '',
      }),
      dAsPDecrypt: jasmine.createSpy('dAsPDecrypt').and.resolveTo(testMnemonic),
    };
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Main Encryption/Decryption Logic (D-KASP V6)', () => {
    it('should call Electron IPC for encryption', async () => {
      const result = await service.encrypt(testMnemonic, testPassword);

      expect((window as any).electronAPI.dAsPEncrypt).toHaveBeenCalledWith(testMnemonic, testPassword, jasmine.any(String), undefined);
      expect(JSON.parse(result.encryptedData).v).toBe(6);
    });

    it('should call Electron IPC for decryption', async () => {
      const encryptedData = JSON.stringify({ v: 6, data: 'mock-encrypted-data' });
      const result = await service.decrypt(encryptedData, '', testPassword);

      expect((window as any).electronAPI.dAsPDecrypt).toHaveBeenCalledWith(encryptedData, '', testPassword, jasmine.any(String), undefined);
      expect(result.decrypted).toBe(testMnemonic);
      expect(result.isLegacy).toBeFalse();
    });

    it('should identify legacy V3 volumes', async () => {
      const encryptedData = JSON.stringify({ v: 3, data: 'legacy-data' });
      const result = await service.decrypt(encryptedData, 'some-rk', testPassword);

      expect(result.isLegacy).toBeTrue();
    });
  });

  describe('AES Helper Methods', () => {
    const plainText = 'Hello Darkstar';
    const password = 'pass';
    const iterations = 1000;

    it('should encrypt and decrypt using AES-256-CBC (sync)', () => {
      const encrypted = service.encryptAES256(plainText, password, iterations);
      const decrypted = service.decryptAES256(encrypted, password, iterations);
      expect(decrypted).toBe(plainText);
    });

    it('should encrypt and decrypt using AES-256-CBC (async)', async () => {
      const encrypted = await service.encryptAES256Async(plainText, password, iterations);
      const decrypted = await service.decryptAES256Async(encrypted, password, iterations);
      expect(decrypted).toBe(plainText);
    });

    it('should encrypt and decrypt using AES-256-GCM (async)', async () => {
      const encrypted = await service.encryptAES256GCMAsync(plainText, password, iterations);
      const decrypted = await service.decryptAES256GCMAsync(encrypted, password, iterations);
      expect(decrypted).toBe(plainText);
    });
  });

  describe('Binary Crypto Helpers', () => {
    it('should encrypt and decrypt Uint8Array data', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const password = 'binary-pass';

      const encrypted = await service.encryptBinary(data, password);
      const decrypted = await service.decryptBinary(encrypted, password);

      expect(decrypted).toEqual(data);
    });
  });
});
