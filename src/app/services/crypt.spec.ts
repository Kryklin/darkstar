import { TestBed } from '@angular/core/testing';
import { CryptService } from './crypt';

describe('CryptService', () => {
  let service: CryptService;
  const testString = 'Hello, World! 123';
  const password = 'mysecretpassword';

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('AES Encryption', () => {
    it('should encrypt and decrypt a string using AES-256', () => {
      const encrypted = service.encryptAES256(testString, password);
      const decrypted = service.decryptAES256(encrypted, password);
      expect(decrypted).toBe(testString);
      expect(encrypted).not.toBe(testString);
    });
  });

  describe('Obfuscation and Deobfuscation', () => {
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

    it('should convert to and from binary', () => {
      const obfuscated = service.obfuscateToBinary(testString);
      const deobfuscated = service.deobfuscateFromBinary(obfuscated);
      expect(deobfuscated).toBe(testString);
    });

    it('should convert to and from hexadecimal', () => {
      const obfuscated = service.obfuscateToHex(testString);
      const deobfuscated = service.deobfuscateFromHex(obfuscated);
      expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse Caesar Cipher (ROT13)', () => {
      const obfuscated = service.obfuscateWithCaesarCipher(testString);
      const deobfuscated = service.deobfuscateWithCaesarCipher(obfuscated);
      expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse Atbash Cipher', () => {
      const obfuscated = service.obfuscateWithAtbashCipher(testString);
      const deobfuscated = service.deobfuscateWithAtbashCipher(obfuscated);
      expect(deobfuscated).toBe(testString);
    });

    it('should convert to and from Leet Speak', () => {
        const leetTest = "agile"
        const obfuscated = service.obfuscateToLeet(leetTest);
        const deobfuscated = service.deobfuscateFromLeet(obfuscated);
        expect(deobfuscated).toBe(leetTest);
    });

    it('should interleave and de-interleave a string', () => {
      const obfuscated = service.obfuscateByInterleaving(testString);
      const deobfuscated = service.deobfuscateByDeinterleaving(obfuscated);
      expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse Caesar Cipher (ROT7)', () => {
        const obfuscated = service.obfuscateWithCaesarCipher7(testString);
        const deobfuscated = service.deobfuscateWithCaesarCipher7(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should shuffle and un-shuffle a string with a seed', () => {
        const seed = 'test-seed';
        const obfuscated = service.obfuscateByShuffling(testString, seed);
        const deobfuscated = service.deobfuscateByShuffling(obfuscated, seed);
        expect(deobfuscated).toBe(testString);
    });

    it('should use and remove a custom separator', () => {
        const obfuscated = service.obfuscateWithCustomSeparator(testString);
        const deobfuscated = service.deobfuscateWithCustomSeparator(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse bitwise NOT', () => {
        const obfuscated = service.obfuscateWithBitwiseNot(testString);
        const deobfuscated = service.deobfuscateWithBitwiseNot(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse ASCII shift', () => {
        const obfuscated = service.obfuscateWithAsciiShift(testString);
        const deobfuscated = service.deobfuscateWithAsciiShift(obfuscated, '5');
        expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse XOR obfuscation', () => {
        const key = 'secret';
        const obfuscated = service.obfuscateWithXOR(testString, key);
        const deobfuscated = service.deobfuscateWithXOR(obfuscated, key);
        expect(deobfuscated).toBe(testString);
    });

    it('should convert to and from Morse Code', () => {
        const morseTest = 'HELLO WORLD';
        const obfuscated = service.obfuscateToMorseCode(morseTest);
        const deobfuscated = service.deobfuscateFromMorseCode(obfuscated);
        expect(deobfuscated).toBe(morseTest);
    });

    it('should apply and reverse keyboard shift', () => {
        const keyboardTest = "hello";
        const obfuscated = service.obfuscateWithKeyboardShift(keyboardTest);
        const deobfuscated = service.deobfuscateWithKeyboardShift(obfuscated);
        expect(deobfuscated).toBe(keyboardTest);
    });

    it('should convert to and from HTML entities', () => {
        const obfuscated = service.obfuscateToHtmlEntities(testString);
        const deobfuscated = service.deobfuscateFromHtmlEntities(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should convert to and from octal', () => {
        const obfuscated = service.obfuscateToOctal(testString);
        const deobfuscated = service.deobfuscateFromOctal(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse nibble swap', () => {
        const obfuscated = service.obfuscateWithNibbleSwap(testString);
        const deobfuscated = service.deobfuscateWithNibbleSwap(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse vowel rotation', () => {
        const obfuscated = service.obfuscateWithVowelRotation(testString);
        const deobfuscated = service.deobfuscateWithVowelRotation(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse index math', () => {
        const obfuscated = service.obfuscateWithIndexMath(testString);
        const deobfuscated = service.deobfuscateWithIndexMath(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should apply and reverse mirror case', () => {
        const obfuscated = service.obfuscateWithMirrorCase(testString);
        const deobfuscated = service.deobfuscateWithMirrorCase(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should interleave and de-interleave with index', () => {
        const obfuscated = service.obfuscateWithIndexInterleave(testString);
        const deobfuscated = service.deobfuscateWithIndexInterleave(obfuscated);
        expect(deobfuscated).toBe(testString);
    });

    it('should swap and un-swap adjacent characters', () => {
        const obfuscated = service.obfuscateBySwappingAdjacentChars(testString);
        const deobfuscated = service.deobfuscateBySwappingAdjacentChars(obfuscated);
        expect(deobfuscated).toBe(testString);
    });
  });
});
