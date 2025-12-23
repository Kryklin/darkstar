import { Injectable } from '@angular/core';
import CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root',
})
export class CryptService {
  // --- AES-256 Encryption ---

  /**
   * Encrypts a string using AES-256.
   * @param data The string to encrypt.
   * @param password The password to use for encryption.
   * @returns The encrypted string (ciphertext).
   */
  encryptAES256(data: string, password: string): string {
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 1000,
    });
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC,
    });
    // Combine salt, iv and ciphertext for transit
    const transitmessage = salt.toString() + iv.toString() + encrypted.toString();
    return transitmessage;
  }

  /**
   * Decrypts a string using AES-256.
   * @param transitmessage The encrypted string (ciphertext) with salt and iv.
   * @param password The password to use for decryption.
   * @returns The decrypted string.
   */
  decryptAES256(transitmessage: string, password: string): string {
    const salt = CryptoJS.enc.Hex.parse(transitmessage.substr(0, 32));
    const iv = CryptoJS.enc.Hex.parse(transitmessage.substr(32, 32));
    const encrypted = transitmessage.substring(64);

    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 1000,
    });

    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  // --- Main Encryption/Decryption Logic ---

  /**
   * Encrypts a mnemonic phrase by shuffling and obfuscating with a seeded password reference.
   * Returns encrypted data and the reverse key needed for decryption.
   */
  encrypt(mnemonic: string, password: string): { encryptedData: string; reverseKey: string } {
    const words = mnemonic.split(' ');
    const obfuscatedWords: string[] = [];
    const reverseKey: number[][] = [];

    for (const word of words) {
      // Create a fresh, ordered list of all 12 function indexes for each word
      const selectedFunctions = Array.from({ length: this.obfuscationFunctions.length }, (_, i) => i);

      // Shuffle the entire list of 12 functions deterministically for this word
      this.shuffleArray(selectedFunctions, password + word);

      let currentWord = word;
      const wordReverseKey: number[] = [];

      // Generate a checksum from the now-shuffled function indexes
      const checksum = this._generateChecksum(selectedFunctions);
      const combinedSeed = password + checksum;

      for (const funcIndex of selectedFunctions) {
        const func = this.obfuscationFunctions[funcIndex];
        // Seeded functions are now at indices 6 through 11
        const isSeeded = funcIndex >= 6;
        const seed = isSeeded ? combinedSeed : undefined;
        currentWord = func(currentWord, seed);
        wordReverseKey.push(funcIndex);
      }

      obfuscatedWords.push(currentWord);
      reverseKey.push(wordReverseKey);
    }

    const obfuscatedString = obfuscatedWords.join('§');
    const encryptedData = this.encryptAES256(obfuscatedString, password);
    const reverseKeyString = JSON.stringify(reverseKey);
    const encodedReverseKey = btoa(reverseKeyString); // Base64 encode

    return { encryptedData, reverseKey: encodedReverseKey };
  }

  /**
   * Decrypts an encrypted mnemonic phrase using the provided reverse key and password.
   */
  decrypt(encryptedData: string, reverseKey: string, password: string): string {
    // 1. Decode the reverse key from Base64
    const reverseKeyString = atob(reverseKey);
    const reverseKeyJson: number[][] = JSON.parse(reverseKeyString);

    // 2. Decrypt the main data block
    const decryptedObfuscatedString = this.decryptAES256(encryptedData, password);
    if (!decryptedObfuscatedString) {
      throw new Error('AES decryption failed. Check password.');
    }
    const obfuscatedWords = decryptedObfuscatedString.split('§');

    if (obfuscatedWords.length !== reverseKeyJson.length) {
      throw new Error('Data mismatch: Word count does not match reverse key.');
    }

    const deobfuscatedWords: string[] = [];

    // 3. De-obfuscate each word
    for (let i = 0; i < obfuscatedWords.length; i++) {
      let currentWord = obfuscatedWords[i];
      const wordReverseKey = reverseKeyJson[i];

      // Generate the checksum from the reverse key for this word to reconstruct the seed
      const checksum = this._generateChecksum(wordReverseKey);
      const combinedSeed = password + checksum;

      // Apply deobfuscation functions in reverse order
      for (let j = wordReverseKey.length - 1; j >= 0; j--) {
        const funcIndex = wordReverseKey[j];
        const func = this.deobfuscationFunctions[funcIndex];
        if (!func) {
          throw new Error(`Invalid deobfuscation function index: ${funcIndex}`);
        }
        // Seeded functions are at indices 6 through 11
        const isSeeded = funcIndex >= 6;
        const seed = isSeeded ? combinedSeed : undefined;
        currentWord = func(currentWord, seed);
      }
      deobfuscatedWords.push(currentWord);
    }

    return deobfuscatedWords.join(' ');
  }

  private _generateChecksum(numbers: number[]): number {
    if (!numbers || numbers.length === 0) {
      return 0;
    }
    // Sum all numbers in the array
    const sum = numbers.reduce((acc, curr) => acc + curr, 0);
    // Use a modulo to keep the number in a manageable range, using a prime number
    return sum % 997; // 997 is a prime number
  }

  public obfuscationFunctions: ((input: string, seed?: string) => string)[];
  public deobfuscationFunctions: ((input: string, seed?: string) => string)[];

  constructor() {
    this.obfuscationFunctions = [
      // --- 6 Unseeded Functions ---
      this.obfuscateByReversing.bind(this), // 0
      this.obfuscateWithAtbashCipher.bind(this), // 1
      this.obfuscateToCharCodes.bind(this), // 2
      this.obfuscateToBinary.bind(this), // 3
      this.obfuscateWithCaesarCipher.bind(this), // 4
      this.obfuscateBySwappingAdjacentChars.bind(this), // 5

      // --- 6 Seeded Functions ---
      this.obfuscateByShuffling.bind(this), // 6
      this.obfuscateWithXOR.bind(this), // 7
      this.obfuscateByInterleaving.bind(this), // 8
      this.obfuscateWithVigenereCipher.bind(this), // 9
      this.obfuscateWithSeededBlockReversal.bind(this), // 10
      this.obfuscateWithSeededSubstitution.bind(this), // 11
    ];
    this.deobfuscationFunctions = [
      // --- 6 Unseeded Functions ---
      this.deobfuscateByReversing.bind(this), // 0
      this.deobfuscateWithAtbashCipher.bind(this), // 1
      this.deobfuscateFromCharCodes.bind(this), // 2
      this.deobfuscateFromBinary.bind(this), // 3
      this.deobfuscateWithCaesarCipher.bind(this), // 4
      this.deobfuscateBySwappingAdjacentChars.bind(this), // 5

      // --- 6 Seeded Functions ---
      this.deobfuscateByShuffling.bind(this), // 6
      this.deobfuscateWithXOR.bind(this), // 7
      this.deobfuscateByDeinterleaving.bind(this), // 8
      this.deobfuscateWithVigenereCipher.bind(this), // 9
      this.deobfuscateWithSeededBlockReversal.bind(this), // 10
      this.deobfuscateWithSeededSubstitution.bind(this), // 11
    ];
  }

  // --- Unseeded Transformation Functions ---

  // 0. Reverse String
  obfuscateByReversing(input: string): string {
    return input.split('').reverse().join('');
  }
  deobfuscateByReversing(input: string): string {
    return this.obfuscateByReversing(input);
  }

  // 1. Atbash Cipher
  obfuscateWithAtbashCipher(input: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        // Uppercase
        return String.fromCharCode(90 - (code - 65));
      } else if (code >= 97 && code <= 122) {
        // Lowercase
        return String.fromCharCode(122 - (code - 97));
      }
      return c;
    });
  }
  deobfuscateWithAtbashCipher(input: string): string {
    return this.obfuscateWithAtbashCipher(input);
  }

  // 2. Character Code
  obfuscateToCharCodes(input: string): string {
    return input
      .split('')
      .map((char) => char.charCodeAt(0))
      .join(',');
  }
  deobfuscateFromCharCodes(input: string): string {
    return input
      .split(',')
      .map((code) => String.fromCharCode(parseInt(code, 10)))
      .join('');
  }

  // 3. Binary
  obfuscateToBinary(input: string): string {
    return input
      .split('')
      .map((char) => char.charCodeAt(0).toString(2))
      .join(',');
  }
  deobfuscateFromBinary(input: string): string {
    return input
      .split(',')
      .map((bin) => String.fromCharCode(parseInt(bin, 2)))
      .join('');
  }

  // 4. Caesar Cipher (ROT13)
  obfuscateWithCaesarCipher(input: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const base = code < 91 ? 65 : 97;
      return String.fromCharCode(((code - base + 13) % 26) + base);
    });
  }
  deobfuscateWithCaesarCipher(input: string): string {
    return this.obfuscateWithCaesarCipher(input);
  }

  // 5. Adjacent Character Swap
  obfuscateBySwappingAdjacentChars(input: string): string {
    const chars = input.split('');
    for (let i = 0; i < chars.length - 1; i += 2) {
      [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    }
    return chars.join('');
  }
  deobfuscateBySwappingAdjacentChars(input: string): string {
    return this.obfuscateBySwappingAdjacentChars(input);
  }

  // --- Seeded Functions ---

  // 6. Character Shuffling
  obfuscateByShuffling(input: string, seed?: string): string {
    const a = input.split('');
    const n = a.length;
    const rng = this.seededRandom(seed!);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.join('');
  }
  deobfuscateByShuffling(input: string, seed?: string): string {
    const a = input.split('');
    const n = a.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    const rng = this.seededRandom(seed!);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const unshuffled = new Array(n);
    for (let i = 0; i < n; i++) {
      unshuffled[indices[i]] = a[i];
    }
    return unshuffled.join('');
  }

  // 7. XOR Obfuscation
  obfuscateWithXOR(input: string, seed?: string): string {
    return input
      .split('')
      .map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ seed!.charCodeAt(i % seed!.length)))
      .join('');
  }
  deobfuscateWithXOR(input: string, seed?: string): string {
    return this.obfuscateWithXOR(input, seed);
  }

  // 8. Interleave
  obfuscateByInterleaving(input: string, seed?: string): string {
    const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const rng = this.seededRandom(seed!);
    for (const char of input) {
      const randomChar = randomChars.charAt(Math.floor(rng() * randomChars.length));
      result += char + randomChar;
    }
    return result;
  }
  deobfuscateByDeinterleaving(input: string): string {
    let result = '';
    for (let i = 0; i < input.length; i += 2) {
      result += input[i];
    }
    return result;
  }

  // 9. Vigenère Cipher
  obfuscateWithVigenereCipher(input: string, seed?: string): string {
    const codes: number[] = [];
    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i);
      const keyCode = seed!.charCodeAt(i % seed!.length);
      codes.push(charCode + keyCode);
    }
    return codes.join(',');
  }
  deobfuscateWithVigenereCipher(input: string, seed?: string): string {
    const codes = input.split(',').map((c) => parseInt(c, 10));
    let result = '';
    for (let i = 0; i < codes.length; i++) {
      const keyCode = seed!.charCodeAt(i % seed!.length);
      result += String.fromCharCode(codes[i] - keyCode);
    }
    return result;
  }

  // 10. Seeded Block Reversal
  obfuscateWithSeededBlockReversal(input: string, seed?: string): string {
    const rng = this.seededRandom(seed!);
    const blockSize = Math.floor(rng() * (input.length / 2)) + 2;
    let result = '';
    for (let i = 0; i < input.length; i += blockSize) {
      result += input
        .substring(i, i + blockSize)
        .split('')
        .reverse()
        .join('');
    }
    return result;
  }
  deobfuscateWithSeededBlockReversal(input: string, seed?: string): string {
    return this.obfuscateWithSeededBlockReversal(input, seed);
  }

  // 11. Seeded Substitution
  obfuscateWithSeededSubstitution(input: string, seed?: string): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    const shuffledChars = [...chars];
    this.shuffleArray(shuffledChars, seed!);
    const subMap = new Map(chars.map((c, i) => [c, shuffledChars[i]]));
    return input
      .split('')
      .map((char) => subMap.get(char) || char)
      .join('');
  }
  deobfuscateWithSeededSubstitution(input: string, seed?: string): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    const shuffledChars = [...chars];
    this.shuffleArray(shuffledChars, seed!);
    const unsubMap = new Map(shuffledChars.map((c, i) => [c, chars[i]]));
    return input
      .split('')
      .map((char) => unsubMap.get(char) || char)
      .join('');
  }

  private shuffleArray<T>(array: T[], seed: string) {
    const rng = this.seededRandom(seed);
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private seededRandom(seed: string) {
    let h = 1779033703,
      i = 0;
    for (i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    }
    h = (h << 13) | (h >>> 19);
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
}
