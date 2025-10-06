import { TestBed } from '@angular/core/testing';
import { CryptService } from './crypt';

describe('CryptService', () => {
  let service: CryptService;
  // A 12-word mnemonic for faster testing
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const testPassword = 'mysecretpassword';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CryptService]
    });
    service = TestBed.inject(CryptService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Main Encryption/Decryption Logic', () => {
    it('should encrypt and then decrypt a mnemonic phrase successfully', () => {
      // Encrypt the mnemonic
      const { encryptedData, reverseKey } = service.encrypt(testMnemonic, testPassword);

      // Ensure the output looks encrypted and valid
      expect(encryptedData).not.toBe(testMnemonic);
      expect(reverseKey).toBeDefined();
      expect(encryptedData.length).toBeGreaterThan(0);
      expect(reverseKey.length).toBeGreaterThan(0);

      // Decrypt the data
      const decryptedMnemonic = service.decrypt(encryptedData, reverseKey, testPassword);

      // Check if the decrypted mnemonic matches the original
      expect(decryptedMnemonic).toBe(testMnemonic);
    });

    it('should fail decryption with the wrong password', () => {
      const { encryptedData, reverseKey } = service.encrypt(testMnemonic, testPassword);
      const wrongPassword = 'another-wrong-password';

      // Expect the decrypt method to throw an error because AES decryption will fail
      expect(() => service.decrypt(encryptedData, reverseKey, wrongPassword)).toThrow();
    });

    it('should use "§" as a delimiter in the intermediate obfuscated string', () => {
      const words = testMnemonic.split(' ');
      // Spy on the internal AES256 encryption method to inspect the data passed to it
      const spy = spyOn(service, 'encryptAES256').and.callThrough();
      
      service.encrypt(testMnemonic, testPassword);

      // Check that the spy was called
      expect(spy).toHaveBeenCalled();
      
      // Get the first argument passed to the spy, which is the obfuscated string
      const obfuscatedString = spy.calls.first().args[0];
      
      // The string should be joined by '§', so splitting by it should yield the original number of words
      expect(obfuscatedString.split('§').length).toBe(words.length);
      // Conversely, splitting by a space should not yield the same number of words
      expect(obfuscatedString.split(' ').length).not.toBe(words.length);
    });
  });

  describe('Individual Obfuscation/Deobfuscation Functions', () => {
    const testString = 'hello';

    it('should reverse and de-reverse a string', () => {
      const obfuscated = service.obfuscateByReversing(testString);
      const deobfuscated = service.deobfuscateByReversing(obfuscated);
      expect(deobfuscated).toBe(testString);
    });

    it('should convert to and from char codes', () => {
      const obfuscated = service.obfuscateToCharCodes(testString);
      const deobfuscated = service.deobfuscateFromCharCodes(obfuscated);
      expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse Caesar Cipher (ROT13)', () => {
      const obfuscated = service.obfuscateWithCaesarCipher(testString);
      const deobfuscated = service.deobfuscateWithCaesarCipher(obfuscated);
      expect(deobfuscated).toBe(testString);
    });

    it('should shuffle and un-shuffle a string with a seed', () => {
      const seed = 'a-specific-seed-for-testing';
      const obfuscated = service.obfuscateByShuffling(testString, seed);
      const deobfuscated = service.deobfuscateByShuffling(obfuscated, seed);
      expect(deobfuscated).toBe(testString);
    });
  });
});
