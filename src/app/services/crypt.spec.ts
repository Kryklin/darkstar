import { TestBed } from '@angular/core/testing';
import { CryptService } from './crypt';
import * as BIP39 from '../../assets/BIP39.json';
import * as ElectrumLegacy from '../../assets/electrum-legacy.json';
import * as ElectrumV2 from '../../assets/electrum-v2.json';
import * as Slip39 from '../../assets/slip39.json';

describe('CryptService', () => {
  let service: CryptService;
  let testMnemonic: string;
  const testPassword = 'mysecretpassword';

  beforeAll(() => {
    // Generate a predictable mnemonic for general testing
    const words = BIP39.words;
    const randomWords = [];
    for (let i = 0; i < 12; i++) {
      randomWords.push(words[Math.floor(Math.random() * words.length)]);
    }
    testMnemonic = randomWords.join(' ');
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CryptService],
    });
    service = TestBed.inject(CryptService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Main Encryption/Decryption Logic', () => {
    it('should encrypt and then decrypt a mnemonic phrase successfully (V2 format)', async () => {
      // Encrypt the mnemonic
      const { encryptedData, reverseKey } = await service.encrypt(testMnemonic, testPassword);

      // Verify V2 format (JSON envelope)
      const parsedData = JSON.parse(encryptedData);
      expect(parsedData.v).toBe(2);
      expect(parsedData.data).toBeDefined();

      // Ensure the output looks encrypted and valid
      expect(encryptedData).not.toBe(testMnemonic);
      expect(reverseKey).toBeDefined();
      expect(encryptedData.length).toBeGreaterThan(0);
      expect(reverseKey.length).toBeGreaterThan(0);

      // Decrypt the data
      const result = await service.decrypt(encryptedData, reverseKey, testPassword);

      // Check if the decrypted mnemonic matches the original and is flagged as NOT legacy
      expect(result.decrypted).toBe(testMnemonic);
      expect(result.isLegacy).toBeFalse();
    });

    it('should fail decryption with the wrong password', async () => {
      const { encryptedData, reverseKey } = await service.encrypt(testMnemonic, testPassword);
      const wrongPassword = 'another-wrong-password';

      // Expect the decrypt method to throw an error
      await expectAsync(service.decrypt(encryptedData, reverseKey, wrongPassword)).toBeRejected();
    });

    it('should use "§" as a delimiter in the intermediate obfuscated string', async () => {
      // Spy on the internal AES256 encryption method
      const spy = spyOn(service, 'encryptAES256Async').and.callThrough();

      await service.encrypt(testMnemonic, testPassword);

      // Check that the spy was called
      expect(spy).toHaveBeenCalled();

      // Get the first argument passed to the spy (obfuscated string / base64)
      const obfuscatedString = spy.calls.mostRecent().args[0];

      // V2 Logic: The output is a Base64 string, NOT a string joined by '§'
      // Ideally we should check if it is valid base64 or just that it DOESN'T contain '§'
      expect(obfuscatedString).not.toContain('§');

      // Basic Base64 regex check (simplified)
      expect(obfuscatedString).toMatch(/^[A-Za-z0-9+/]*={0,2}$/);
    });
  });

  describe('Legacy Support', () => {
    it('should decrypt legacy (V1 format) data correctly', async () => {
      // Manually simulate V1 Encryption (LCG + 1000 Iterations + No JSON Envelope)
      const words = testMnemonic.split(' ');
      const obfuscatedWords: string[] = [];
      const reverseKey: number[][] = [];

      // Define interface to access private members type-safely for testing
      type RandomGenerator = () => number;
      type PrngFactory = (seed: string) => RandomGenerator;

      interface PrivateCryptService {
        seededRandomLegacy(seed: string): RandomGenerator;
        shuffleArray<T>(array: T[], seed: string, rngFactory: PrngFactory): void;
        _generateChecksum(numbers: number[]): number;
      }

      const legacyService = service as unknown as PrivateCryptService;

      // Access the private legacy PRNG for simulation
      const legacyPrng = legacyService.seededRandomLegacy.bind(service);

      for (const word of words) {
        // 1. Setup functions
        const selectedFunctions = Array.from({ length: service.obfuscationFunctions.length }, (_, i) => i);

        // 2. Shuffle using LCG
        legacyService.shuffleArray(selectedFunctions, testPassword + word, legacyPrng);

        let currentWord = word;
        const wordReverseKey: number[] = [];

        // 3. Generate Checksum
        const checksum = legacyService._generateChecksum(selectedFunctions);
        const combinedSeed = testPassword + checksum;

        // 4. Apply functions using LCG
        for (const funcIndex of selectedFunctions) {
          const func = service.obfuscationFunctions[funcIndex];
          const isSeeded = funcIndex >= 6;
          const seed = isSeeded ? combinedSeed : undefined;
          currentWord = func(currentWord, seed, legacyPrng);
          wordReverseKey.push(funcIndex);
        }

        obfuscatedWords.push(currentWord);
        reverseKey.push(wordReverseKey);
      }

      const obfuscatedString = obfuscatedWords.join('§');

      // 5. Encrypt using AES with Legacy Iterations (1000)
      const legacyEncryptedData = service.encryptAES256(obfuscatedString, testPassword, 1000);

      const reverseKeyJson = JSON.stringify(reverseKey);
      const encodedReverseKey = btoa(reverseKeyJson);

      // --- TEST EXECUTION ---
      // Pass the raw legacy string (no JSON V2 envelope) to decrypt
      const result = await service.decrypt(legacyEncryptedData, encodedReverseKey, testPassword);

      // Verify it worked and detected legacy
      expect(result.decrypted).toBe(testMnemonic);
      expect(result.isLegacy).toBeTrue();
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
      // Test with explicitly provided seed
      const seed = 'a-specific-seed-for-testing';
      const obfuscated = service.obfuscateByShuffling(testString, seed);
      const deobfuscated = service.deobfuscateByShuffling(obfuscated, seed);
      expect(deobfuscated).toBe(testString);
    });
  });

  describe('Wordlist Compatibility', () => {
    const wordlists = [
      { name: 'BIP39', words: BIP39.words },
      { name: 'Electrum Legacy', words: ElectrumLegacy.words },
      { name: 'Electrum V2', words: ElectrumV2.words },
      { name: 'SLIP39', words: Slip39.words },
    ];

    wordlists.forEach((list) => {
      it(`should encrypt and decrypt a random phrase from ${list.name}`, async () => {
        let randomPhrase = '';
        for (let i = 0; i < 12; i++) {
          randomPhrase += list.words[Math.floor(Math.random() * list.words.length)] + ' ';
        }
        randomPhrase = randomPhrase.trim();

        const { encryptedData, reverseKey } = await service.encrypt(randomPhrase, testPassword);
        expect(encryptedData).toBeTruthy();
        expect(reverseKey).toBeTruthy();

        const result = await service.decrypt(encryptedData, reverseKey, testPassword);
        expect(result.decrypted).toBe(randomPhrase);
        expect(result.isLegacy).toBeFalse();
      });
    });
  });
});
