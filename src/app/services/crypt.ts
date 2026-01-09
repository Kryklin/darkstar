import { Injectable } from '@angular/core';
import CryptoJS from 'crypto-js';

export interface DecryptionResult {
  decrypted: string;
  isLegacy: boolean;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Core cryptographic engine for the Darkstar security suite.
 * Handles multi-layered encryption, structural obfuscation, and memory hardening.
 */
export class CryptService {
  /** Iterations for legacy (V1) encryption. Deprecated. */
  private readonly ITERATIONS_V1 = 1000;
  
  /** 
   * Iterations for standard (V2) encryption. 
   * Aligns with modern OWASP recommendations for high-security. 
   */
  public ITERATIONS_V2 = 600000;

  private readonly KEY_SIZE = 256 / 32;
  private readonly SALT_SIZE_BYTES = 128 / 8;
  private readonly IV_SIZE_BYTES = 128 / 8;

  /**
   * Synchronous AES-256-CBC encryption using PBKDF2.
   * Note: Primarily used for legacy compatibility. Use Async variants for new features.
   * @param {string} data Plaintext to encrypt.
   * @param {string} password Secret passphrase.
   * @param {number} iterations Computational hardening factor.
   * @returns {string} Hex-encoded Salt + IV + Base64 ciphertext.
   */
  encryptAES256(data: string, password: string, iterations: number): string {
    const salt = CryptoJS.lib.WordArray.random(this.SALT_SIZE_BYTES);
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: this.KEY_SIZE,
      iterations: iterations,
    });
    const iv = CryptoJS.lib.WordArray.random(this.IV_SIZE_BYTES);
    const encrypted = CryptoJS.AES.encrypt(data, key, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC,
    });

    return salt.toString() + iv.toString() + encrypted.ciphertext.toString(CryptoJS.enc.Base64);
  }

  /**
   * Synchronous AES-256-CBC decryption.
   * @param {string} transitmessage Combined hex/base64 payload.
   * @param {string} password Secret passphrase.
   * @param {number} iterations Computational hardening factor.
   * @returns {string} Decrypted plaintext or empty string on failure.
   */
  decryptAES256(transitmessage: string, password: string, iterations: number): string {
    try {
      const saltHex = transitmessage.substr(0, 32);
      const ivHex = transitmessage.substr(32, 32);
      const encryptedBase64 = transitmessage.substring(64);

      const salt = CryptoJS.enc.Hex.parse(saltHex);
      const iv = CryptoJS.enc.Hex.parse(ivHex);

      const key = CryptoJS.PBKDF2(password, salt, {
        keySize: this.KEY_SIZE,
        iterations: iterations,
      });

      const decrypted = CryptoJS.AES.decrypt(encryptedBase64, key, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC,
      });

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Core Crypt Decryption Error:', error);
      return '';
    }
  }

  /**
   * Asynchronous AES-256-CBC encryption powered by the Web Crypto API.
   * Implements secure key derivation and modern buffer patterns for memory hardening.
   * @param {string} data Plaintext to encrypt.
   * @param {string} password Secret passphrase.
   * @param {number} iterations PBKDF2 iteration count.
   * @returns {Promise<string>} Hex-encoded Salt + IV + Base64 ciphertext.
   */
  async encryptAES256Async(data: string, password: string, iterations: number): Promise<string> {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(this.SALT_SIZE_BYTES));
    const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_SIZE_BYTES));

    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-CBC', length: 256 },
      false,
      ['encrypt'],
    );

    const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv as BufferSource }, key, enc.encode(data));

    return this.buf2hex(salt) + this.buf2hex(iv) + this.buf2base64(encrypted);
  }

  /**
   * Asynchronous AES-256-CBC decryption.
   * Verifies data integrity and reverses the Web Crypto encryption process.
   * @param {string} transitmessage Combined payload string.
   * @param {string} password Secret passphrase.
   * @param {number} iterations PBKDF2 iteration count.
   * @returns {Promise<string>} Decrypted plaintext.
   */
  async decryptAES256Async(transitmessage: string, password: string, iterations: number): Promise<string> {
    try {
      const saltHex = transitmessage.substr(0, 32);
      const ivHex = transitmessage.substr(32, 32);
      const encryptedBase64 = transitmessage.substring(64);

      const salt = this.hex2buf(saltHex);
      const iv = this.hex2buf(ivHex);
      const encryptedBytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt as BufferSource,
          iterations: iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-CBC', length: 256 },
        false,
        ['decrypt'],
      );

      const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv as BufferSource }, key, encryptedBytes);

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Async Decryption failure:', error);
      return '';
    }
  }

  /** Converts binary buffer to hex string. */
  private buf2hex(buffer: ArrayBuffer | Uint8Array): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /** Parses hex string into Uint8Array. */
  private hex2buf(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  }

  /** Encodes binary buffer to Base64 string. */
  private buf2base64(buffer: ArrayBuffer | Uint8Array): string {
    let binary = '';
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Encrypts a mnemonic phrase using the Mnemonic Engine (12-stage Dynamic Obfuscation).
   * Implements the V2 security model with Mulberry32 PRNG and memory hardening.
   * @param {string} mnemonic The space-separated recovery phrase.
   * @param {string} password The user-defined master password.
   * @returns {Promise<{ encryptedData: string; reverseKey: string }>} JSON envelope + B64 packed key.
   */
  async encrypt(mnemonic: string, password: string): Promise<{ encryptedData: string; reverseKey: string }> {
    const words = mnemonic.split(' ');
    const obfuscatedWords: Uint8Array[] = [];
    const reverseKey: number[][] = [];

    const passwordBytes = this.stringToBytes(password);
    const prngFactory = this.mulberry32.bind(this);

    for (const word of words) {
      let currentWordBytes = this.stringToBytes(word);
      const selectedFunctions = Array.from({ length: this.obfuscationFunctionsV2.length }, (_, i) => i);

      /**
       * Deterministically shuffle the function order for this specific word
       * using the host password and word-data as the entropy seed.
       */
      this.shuffleArray(selectedFunctions, password + word, prngFactory);

      const wordReverseKey: number[] = [];
      const checksum = this._generateChecksum(selectedFunctions);
      const checksumBytes = this.stringToBytes(checksum.toString());
      
      const combinedSeed = new Uint8Array(passwordBytes.length + checksumBytes.length);
      combinedSeed.set(passwordBytes);
      combinedSeed.set(checksumBytes, passwordBytes.length);

      /** Apply the unique 12-stage transformation gauntlet. */
      for (const funcIndex of selectedFunctions) {
        const func = this.obfuscationFunctionsV2[funcIndex];
        const isSeeded = funcIndex >= 6;
        const seed = isSeeded ? combinedSeed : undefined;

        const nextWordBytes = func(currentWordBytes, seed, prngFactory);

        if (currentWordBytes !== nextWordBytes) {
          this.zero(currentWordBytes);
        }
        currentWordBytes = nextWordBytes;
        wordReverseKey.push(funcIndex);
      }

      obfuscatedWords.push(currentWordBytes);
      reverseKey.push(wordReverseKey);
      this.zero(combinedSeed);
    }

    /** 
     * Package the obfuscated words into a binary stream using length-prefixing
     * to prevent delimiter-injection attacks on binary data.
     */
    let totalLength = 0;
    for (const wb of obfuscatedWords) {
      totalLength += 2 + wb.length;
    }
    const finalBlob = new Uint8Array(totalLength);
    let offset = 0;
    for (const wb of obfuscatedWords) {
      finalBlob[offset] = (wb.length >> 8) & 0xff;
      finalBlob[offset + 1] = wb.length & 0xff;
      finalBlob.set(wb, offset + 2);
      offset += 2 + wb.length;
      this.zero(wb);
    }

    let binaryString = '';
    for (const byte of finalBlob) {
      binaryString += String.fromCharCode(byte);
    }
    const base64Content = btoa(binaryString);

    this.zero(finalBlob);
    this.zero(passwordBytes);

    const encryptedContent = await this.encryptAES256Async(base64Content, password, this.ITERATIONS_V2);

    const resultObj = {
      v: 2,
      data: encryptedContent,
    };

    const encodedReverseKey = this.packReverseKey(reverseKey);
    return { encryptedData: JSON.stringify(resultObj), reverseKey: encodedReverseKey };
  }

  /**
   * Decrypts and de-obfuscates an encrypted mnemonic payload.
   * Auto-identifies protocol version (V1 Legacy vs V2 Standard).
   * @param {string} encryptedDataRaw The ciphertext string or JSON envelope.
   * @param {string} reverseKey The functional map required for de-obfuscation.
   * @param {string} password The master password.
   * @returns {Promise<DecryptionResult>} Decrypted phrase and legacy flag.
   */
  async decrypt(encryptedDataRaw: string, reverseKey: string, password: string): Promise<DecryptionResult> {
    let iterations = this.ITERATIONS_V1;
    let encryptedContent = encryptedDataRaw;
    let prngFactory = this.seededRandomLegacy.bind(this);
    let isLegacy = true;

    try {
      if (encryptedDataRaw.trim().startsWith('{')) {
        const parsed = JSON.parse(encryptedDataRaw);
        if (parsed.v === 2 && parsed.data) {
          iterations = this.ITERATIONS_V2;
          encryptedContent = parsed.data;
          prngFactory = this.mulberry32.bind(this);
          isLegacy = false;
        }
      }
    } catch {
      // Logic defaults to legacy V1
    }

    let reverseKeyJson: number[][];
    try {
      const reversedKeyString = atob(reverseKey);
      if (reversedKeyString.trim().startsWith('[')) {
        reverseKeyJson = JSON.parse(reversedKeyString);
      } else {
        reverseKeyJson = this.unpackReverseKey(reverseKey);
      }
    } catch {
      try {
        reverseKeyJson = this.unpackReverseKey(reverseKey);
      } catch (e) {
        console.error('Critical: Functional Map Corruption', e);
        throw new Error('De-obfuscation failed: functional map is invalid or corrupt.');
      }
    }

    let decryptedObfuscatedString = '';
    if (isLegacy) {
      decryptedObfuscatedString = this.decryptAES256(encryptedContent, password, iterations);
    } else {
      decryptedObfuscatedString = await this.decryptAES256Async(encryptedContent, password, iterations);
    }

    if (!decryptedObfuscatedString) {
      throw new Error('Authentication Failed: Incorrect password.');
    }

    if (!isLegacy) {
      const binaryString = atob(decryptedObfuscatedString);
      const fullBlob = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        fullBlob[i] = binaryString.charCodeAt(i);
      }

      const deobfuscatedWords: string[] = [];
      const passwordBytes = this.stringToBytes(password);

      let offset = 0;
      let wordIndex = 0;

      while (offset < fullBlob.length) {
        if (wordIndex >= reverseKeyJson.length) break;

        const len = (fullBlob[offset] << 8) | fullBlob[offset + 1];
        offset += 2;

        let currentWordBytes: any = fullBlob.slice(offset, offset + len);
        offset += len;

        const wordReverseKey = reverseKeyJson[wordIndex];
        const checksum = this._generateChecksum(wordReverseKey);
        const checksumBytes = this.stringToBytes(checksum.toString());
        const combinedSeed = new Uint8Array(passwordBytes.length + checksumBytes.length);
        combinedSeed.set(passwordBytes);
        combinedSeed.set(checksumBytes, passwordBytes.length);

        for (let j = wordReverseKey.length - 1; j >= 0; j--) {
          const funcIndex = wordReverseKey[j];
          const func = this.deobfuscationFunctionsV2[funcIndex];
          if (!func) throw new Error(`Engine Mismatch: Invalid function index ${funcIndex}`);

          const isSeeded = funcIndex >= 6;
          const seed = isSeeded ? combinedSeed : undefined;

          currentWordBytes = func(currentWordBytes, seed, prngFactory) as any as Uint8Array;
        }

        deobfuscatedWords.push(this.bytesToString(currentWordBytes));
        wordIndex++;
      }

      return { decrypted: deobfuscatedWords.join(' '), isLegacy };
    } else {
      const obfuscatedWords = decryptedObfuscatedString.split('§');
      if (obfuscatedWords.length !== reverseKeyJson.length) {
        throw new Error('Data Integrity Fault: Structure mismatch.');
      }

      const deobfuscatedWords: string[] = [];
      for (let i = 0; i < obfuscatedWords.length; i++) {
        let currentWord = obfuscatedWords[i];
        const wordReverseKey = reverseKeyJson[i];
        const checksum = this._generateChecksum(wordReverseKey);
        const combinedSeed = password + checksum;

        for (let j = wordReverseKey.length - 1; j >= 0; j--) {
          const funcIndex = wordReverseKey[j];
          const func = this.deobfuscationFunctions[funcIndex];
          if (!func) throw new Error(`Legacy Engine Mismatch: Invalid index ${funcIndex}`);
          
          const isSeeded = funcIndex >= 6;
          const seed = isSeeded ? combinedSeed : undefined;
          currentWord = func(currentWord, seed, prngFactory);
        }
        deobfuscatedWords.push(currentWord);
      }

      return { decrypted: deobfuscatedWords.join(' '), isLegacy };
    }
  }

  /**
   * Compresses a functional map into a high-density binary Base64 format.
   * @param {number[][]} reverseKey The raw functional map.
   * @returns {string} Compressed Base64 representation.
   */
  private packReverseKey(reverseKey: number[][]): string {
    const wordCount = reverseKey.length;
    const packedSize = wordCount * 6;
    const buffer = new Uint8Array(packedSize);

    let offset = 0;
    for (const wordKey of reverseKey) {
      if (wordKey.length !== 12) {
        throw new Error('Compression Error: Invalid functional sequence length.');
      }

      for (let i = 0; i < 12; i += 2) {
        const high = wordKey[i];
        const low = wordKey[i + 1];
        buffer[offset++] = (high << 4) | (low & 0x0f);
      }
    }
    return this.buf2base64(buffer);
  }

  /**
   * Reverses functional map compression.
   * @param {string} base64 The compressed map string.
   * @returns {number[][]} Reconstructed functional map.
   */
  private unpackReverseKey(base64: string): number[][] {
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }

    const reverseKey: number[][] = [];
    const wordCount = buffer.length / 6;

    let offset = 0;
    for (let w = 0; w < wordCount; w++) {
      const wordKey: number[] = [];
      for (let i = 0; i < 6; i++) {
        const byte = buffer[offset++];
        const high = (byte >> 4) & 0x0f;
        const low = byte & 0x0f;
        wordKey.push(high, low);
      }
      reverseKey.push(wordKey);
    }

    return reverseKey;
  }

  /** Generates a deterministic checksum for functional sequence verification. */
  private _generateChecksum(numbers: number[]): number {
    if (!numbers || numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, curr) => acc + curr, 0);
    return sum % 997;
  }

  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  /** Efficiently encodes strings to bytes. */
  private stringToBytes(str: string): Uint8Array {
    return this.textEncoder.encode(str);
  }

  /** Decodes byte buffers to UTF-8 strings. */
  private bytesToString(bytes: Uint8Array): string {
    return this.textDecoder.decode(bytes);
  }

  /** Explicitly zeros out sensitive data from memory. */
  private zero(bytes: Uint8Array): void {
    bytes.fill(0);
  }

  public obfuscationFunctions: ((input: string, seed?: string, rngFactory?: (s: string) => () => number) => string)[];
  public deobfuscationFunctions: ((input: string, seed?: string, rngFactory?: (s: string) => () => number) => string)[];
  public obfuscationFunctionsV2: ((input: Uint8Array, seed?: Uint8Array, rngFactory?: (s: string) => () => number) => Uint8Array)[];
  public deobfuscationFunctionsV2: ((input: Uint8Array, seed?: Uint8Array, rngFactory?: (s: string) => () => number) => Uint8Array)[];

  constructor() {
    this.obfuscationFunctions = [
      this.obfuscateByReversing.bind(this),
      this.obfuscateWithAtbashCipher.bind(this),
      this.obfuscateToCharCodes.bind(this),
      this.obfuscateToBinary.bind(this),
      this.obfuscateWithCaesarCipher.bind(this),
      this.obfuscateBySwappingAdjacentChars.bind(this),
      this.obfuscateByShuffling.bind(this),
      this.obfuscateWithXOR.bind(this),
      this.obfuscateByInterleaving.bind(this),
      this.obfuscateWithVigenereCipher.bind(this),
      this.obfuscateWithSeededBlockReversal.bind(this),
      this.obfuscateWithSeededSubstitution.bind(this),
    ];
    this.deobfuscationFunctions = [
      this.deobfuscateByReversing.bind(this),
      this.deobfuscateWithAtbashCipher.bind(this),
      this.deobfuscateFromCharCodes.bind(this),
      this.deobfuscateFromBinary.bind(this),
      this.deobfuscateWithCaesarCipher.bind(this),
      this.deobfuscateBySwappingAdjacentChars.bind(this),
      this.deobfuscateByShuffling.bind(this),
      this.deobfuscateWithXOR.bind(this),
      this.deobfuscateByDeinterleaving.bind(this),
      this.deobfuscateWithVigenereCipher.bind(this),
      this.deobfuscateWithSeededBlockReversal.bind(this),
      this.deobfuscateWithSeededSubstitution.bind(this),
    ];
    this.obfuscationFunctionsV2 = [
      this.obfuscateByReversingV2.bind(this),
      this.obfuscateWithAtbashCipherV2.bind(this),
      this.obfuscateToCharCodesV2.bind(this),
      this.obfuscateToBinaryV2.bind(this),
      this.obfuscateWithCaesarCipherV2.bind(this),
      this.obfuscateBySwappingAdjacentBytesV2.bind(this),
      this.obfuscateByShufflingV2.bind(this),
      this.obfuscateWithXORV2.bind(this),
      this.obfuscateByInterleavingV2.bind(this),
      this.obfuscateWithVigenereCipherV2.bind(this),
      this.obfuscateWithSeededBlockReversalV2.bind(this),
      this.obfuscateWithSeededSubstitutionV2.bind(this),
    ];
    this.deobfuscationFunctionsV2 = [
      this.deobfuscateByReversingV2.bind(this),
      this.deobfuscateWithAtbashCipherV2.bind(this),
      this.deobfuscateFromCharCodesV2.bind(this),
      this.deobfuscateFromBinaryV2.bind(this),
      this.deobfuscateWithCaesarCipherV2.bind(this),
      this.deobfuscateBySwappingAdjacentBytesV2.bind(this),
      this.deobfuscateByShufflingV2.bind(this),
      this.deobfuscateWithXORV2.bind(this),
      this.deobfuscateByDeinterleavingV2.bind(this),
      this.deobfuscateWithVigenereCipherV2.bind(this),
      this.deobfuscateWithSeededBlockReversalV2.bind(this),
      this.deobfuscateWithSeededSubstitutionV2.bind(this),
    ];
  }

  // --- Unseeded Transformation Functions ---

  // 0. Reverse String
  /** 0. Obfuscate by reversing character order (Legacy). */
  obfuscateByReversing(input: string): string {
    return input.split('').reverse().join('');
  }
  /** Reverses the reversal (Legacy). */
  deobfuscateByReversing(input: string): string {
    return this.obfuscateByReversing(input);
  }

  /** 1. Obfuscate with Atbash cipher (Legacy). Maps A->Z, a->z. */
  obfuscateWithAtbashCipher(input: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCharCode(90 - (code - 65));
      if (code >= 97 && code <= 122) return String.fromCharCode(122 - (code - 97));
      return c;
    });
  }
  /** Reverses Atbash (Identity operation) (Legacy). */
  deobfuscateWithAtbashCipher(input: string): string {
    return this.obfuscateWithAtbashCipher(input);
  }

  /** 2. Obfuscate to comma-separated character codes (Legacy). */
  obfuscateToCharCodes(input: string): string {
    return input.split('').map((char) => char.charCodeAt(0)).join(',');
  }
  /** Reconstructs string from character codes (Legacy). */
  deobfuscateFromCharCodes(input: string): string {
    return input.split(',').map((code) => String.fromCharCode(parseInt(code, 10))).join('');
  }

  /** 3. Obfuscate to comma-separated binary strings (Legacy). */
  obfuscateToBinary(input: string): string {
    return input.split('').map((char) => char.charCodeAt(0).toString(2)).join(',');
  }
  /** Reconstructs string from binary representation (Legacy). */
  deobfuscateFromBinary(input: string): string {
    return input.split(',').map((bin) => String.fromCharCode(parseInt(bin, 2))).join('');
  }

  /** 4. Obfuscate with Caesar Cipher (ROT13) (Legacy). */
  obfuscateWithCaesarCipher(input: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const base = code < 91 ? 65 : 97;
      return String.fromCharCode(((code - base + 13) % 26) + base);
    });
  }
  /** Reverses ROT13 (Identity operation) (Legacy). */
  deobfuscateWithCaesarCipher(input: string): string {
    return this.obfuscateWithCaesarCipher(input);
  }

  /** 5. Obfuscate by swapping adjacent character pairs (Legacy). */
  obfuscateBySwappingAdjacentChars(input: string): string {
    const chars = input.split('');
    for (let i = 0; i < chars.length - 1; i += 2) {
      [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    }
    return chars.join('');
  }
  /** Reverses adjacent swap (Identity operation) (Legacy). */
  deobfuscateBySwappingAdjacentChars(input: string): string {
    return this.obfuscateBySwappingAdjacentChars(input);
  }

  /** 6. Obfuscate by shuffling characters using a seeded PRNG (Legacy). */
  obfuscateByShuffling(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    const a = input.split('');
    const n = a.length;
    const rng = prngFactory ? prngFactory(seed!) : this.seededRandomLegacy(seed!);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.join('');
  }
  /** Reverses character shuffle using deterministic seed (Legacy). */
  deobfuscateByShuffling(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    const a = input.split('');
    const n = a.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    const rng = prngFactory ? prngFactory(seed!) : this.seededRandomLegacy(seed!);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const unshuffled = new Array(n);
    for (let i = 0; i < n; i++) unshuffled[indices[i]] = a[i];
    return unshuffled.join('');
  }

  /** 7. Obfuscate using bitwise XOR with a seeded password reference (Legacy). */
  obfuscateWithXOR(input: string, seed?: string): string {
    return input.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ seed!.charCodeAt(i % seed!.length))).join('');
  }
  /** Reverses XOR (Identity operation) (Legacy). */
  deobfuscateWithXOR(input: string, seed?: string): string {
    return this.obfuscateWithXOR(input, seed);
  }

  /** 8. Obfuscate by interleaving data with deterministic random noise (Legacy). */
  obfuscateByInterleaving(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const rng = prngFactory ? prngFactory(seed!) : this.seededRandomLegacy(seed!);
    for (const char of input) {
      const randomChar = randomChars.charAt(Math.floor(rng() * randomChars.length));
      result += char + randomChar;
    }
    return result;
  }
  /** Removes deterministic noise from interleaved string (Legacy). */
  deobfuscateByDeinterleaving(input: string): string {
    let result = '';
    for (let i = 0; i < input.length; i += 2) result += input[i];
    return result;
  }

  /** 9. Obfuscate with Vigenère cipher (Legacy). */
  obfuscateWithVigenereCipher(input: string, seed?: string): string {
    const codes: number[] = [];
    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i);
      const keyCode = seed!.charCodeAt(i % seed!.length);
      codes.push(charCode + keyCode);
    }
    return codes.join(',');
  }
  /** Reverses Vigenère cipher (Legacy). */
  deobfuscateWithVigenereCipher(input: string, seed?: string): string {
    const codes = input.split(',').map((c) => parseInt(c, 10));
    let result = '';
    for (let i = 0; i < codes.length; i++) {
      const keyCode = seed!.charCodeAt(i % seed!.length);
      result += String.fromCharCode(codes[i] - keyCode);
    }
    return result;
  }

  /** 10. Obfuscate by reversing data blocks of deterministic size (Legacy). */
  obfuscateWithSeededBlockReversal(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    const rng = prngFactory ? prngFactory(seed!) : this.seededRandomLegacy(seed!);
    const blockSize = Math.floor(rng() * (input.length / 2)) + 2;
    let result = '';
    for (let i = 0; i < input.length; i += blockSize) {
      result += input.substring(i, i + blockSize).split('').reverse().join('');
    }
    return result;
  }
  /** Reverses block-level reversal (Legacy). */
  deobfuscateWithSeededBlockReversal(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    return this.obfuscateWithSeededBlockReversal(input, seed, prngFactory);
  }

  /** 11. Obfuscate using a seeded character substitution map (Legacy). */
  obfuscateWithSeededSubstitution(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    const shuffledChars = [...chars];
    this.shuffleArray(shuffledChars, seed!, prngFactory!);
    const subMap = new Map(chars.map((c, i) => [c, shuffledChars[i]]));
    return input.split('').map((char) => subMap.get(char) || char).join('');
  }
  /** Reverses seeded substitution (Legacy). */
  deobfuscateWithSeededSubstitution(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    const shuffledChars = [...chars];
    this.shuffleArray(shuffledChars, seed!, prngFactory!);
    const unsubMap = new Map(shuffledChars.map((c, i) => [c, chars[i]]));
    return input.split('').map((char) => unsubMap.get(char) || char).join('');
  }

  /** 0. Obfuscate by reversing byte order (V2). */
  obfuscateByReversingV2(input: Uint8Array): Uint8Array {
    return input.reverse();
  }
  /** Reverses the byte-level reversal (V2). */
  deobfuscateByReversingV2(input: Uint8Array): Uint8Array {
    return input.reverse();
  }

  /** 1. Obfuscate with Atbash cipher (V2). Only affects ASCII a-z, A-Z. */
  obfuscateWithAtbashCipherV2(input: Uint8Array): Uint8Array {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const code = input[i];
      if (code >= 65 && code <= 90) output[i] = 90 - (code - 65);
      else if (code >= 97 && code <= 122) output[i] = 122 - (code - 97);
      else output[i] = code;
    }
    return output;
  }
  /** Reverses byte-level Atbash (V2). */
  deobfuscateWithAtbashCipherV2(input: Uint8Array): Uint8Array {
    return this.obfuscateWithAtbashCipherV2(input);
  }

  /** 2. Obfuscate bytes to their comma-separated character code representation (V2). */
  obfuscateToCharCodesV2(input: Uint8Array): Uint8Array {
    const parts: number[] = [];
    for (let i = 0; i < input.length; i++) {
      if (i > 0) parts.push(44);
      const strVal = input[i].toString();
      for (let j = 0; j < strVal.length; j++) parts.push(strVal.charCodeAt(j));
    }
    return new Uint8Array(parts);
  }
  /** Reconstructs byte array from character code string bytes (V2). */
  deobfuscateFromCharCodesV2(input: Uint8Array): Uint8Array {
    const output: number[] = [];
    let currentNumStr = '';
    for (const byte of input) {
      if (byte === 44) {
        if (currentNumStr) {
          output.push(parseInt(currentNumStr, 10));
          currentNumStr = '';
        }
      } else currentNumStr += String.fromCharCode(byte);
    }
    if (currentNumStr) output.push(parseInt(currentNumStr, 10));
    return new Uint8Array(output);
  }

  /** 3. Obfuscate bytes to their comma-separated binary string representation (V2). */
  obfuscateToBinaryV2(input: Uint8Array): Uint8Array {
    const parts: number[] = [];
    for (let i = 0; i < input.length; i++) {
      if (i > 0) parts.push(44);
      const binVal = input[i].toString(2);
      for (let j = 0; j < binVal.length; j++) parts.push(binVal.charCodeAt(j));
    }
    return new Uint8Array(parts);
  }
  /** Reconstructs byte array from binary string bytes (V2). */
  deobfuscateFromBinaryV2(input: Uint8Array): Uint8Array {
    const output: number[] = [];
    let currentBinStr = '';
    for (const byte of input) {
      if (byte === 44) {
        if (currentBinStr) {
          output.push(parseInt(currentBinStr, 2));
          currentBinStr = '';
        }
      } else currentBinStr += String.fromCharCode(byte);
    }
    if (currentBinStr) output.push(parseInt(currentBinStr, 2));
    return new Uint8Array(output);
  }

  /** 4. Obfuscate bytes using Caesar Cipher (ROT13) (V2). */
  obfuscateWithCaesarCipherV2(input: Uint8Array): Uint8Array {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const code = input[i];
      if (code >= 65 && code <= 90) output[i] = ((code - 65 + 13) % 26) + 65;
      else if (code >= 97 && code <= 122) output[i] = ((code - 97 + 13) % 26) + 97;
      else output[i] = code;
    }
    return output;
  }
  /** Reverses byte-level ROT13 (V2). */
  deobfuscateWithCaesarCipherV2(input: Uint8Array): Uint8Array {
    return this.obfuscateWithCaesarCipherV2(input);
  }

  /** 5. Obfuscate by swapping adjacent byte pairs (V2). */
  obfuscateBySwappingAdjacentBytesV2(input: Uint8Array): Uint8Array {
    const output = new Uint8Array(input);
    for (let i = 0; i < output.length - 1; i += 2) {
      [output[i], output[i + 1]] = [output[i + 1], output[i]];
    }
    return output;
  }
  /** Reverses adjacent byte swap (V2). */
  deobfuscateBySwappingAdjacentBytesV2(input: Uint8Array): Uint8Array {
    return this.obfuscateBySwappingAdjacentBytesV2(input);
  }

  /** 6. Obfuscate bytes by shuffling using a seeded Mulberry32 PRNG (V2). */
  obfuscateByShufflingV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const a = new Uint8Array(input);
    const n = a.length;
    const seedStr = this.bytesToString(seed!);
    const rng = prngFactory!(seedStr);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** Reverses byte-level shuffle using deterministic seed (V2). */
  deobfuscateByShufflingV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const a = new Uint8Array(input);
    const n = a.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    const seedStr = this.bytesToString(seed!);
    const rng = prngFactory!(seedStr);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const unshuffled = new Uint8Array(n);
    for (let i = 0; i < n; i++) unshuffled[indices[i]] = a[i];
    return unshuffled;
  }

  /** 7. Obfuscate using bitwise XOR with a seeded byte-array (V2). */
  obfuscateWithXORV2(input: Uint8Array, seed?: Uint8Array): Uint8Array {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) output[i] = input[i] ^ seed![i % seed!.length];
    return output;
  }
  /** Reverses byte-level XOR (V2). */
  deobfuscateWithXORV2(input: Uint8Array, seed?: Uint8Array): Uint8Array {
    return this.obfuscateWithXORV2(input, seed);
  }

  /** 8. Obfuscate by interleaving data with deterministic Mulberry32 noise (V2). */
  obfuscateByInterleavingV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const seedStr = this.bytesToString(seed!);
    const rng = prngFactory!(seedStr);
    const output = new Uint8Array(input.length * 2);
    for (let i = 0; i < input.length; i++) {
      output[i * 2] = input[i];
      const randomCharIndex = Math.floor(rng() * randomChars.length);
      output[i * 2 + 1] = randomChars.charCodeAt(randomCharIndex);
    }
    return output;
  }
  /** Removes deterministic noise from interleaved byte array (V2). */
  deobfuscateByDeinterleavingV2(input: Uint8Array): Uint8Array {
    const output = new Uint8Array(input.length / 2);
    for (let i = 0; i < input.length; i += 2) output[i / 2] = input[i];
    return output;
  }

  /** 9. Obfuscate with Vigenère cipher over a byte stream (V2). */
  obfuscateWithVigenereCipherV2(input: Uint8Array, seed?: Uint8Array): Uint8Array {
    const parts: number[] = [];
    for (let i = 0; i < input.length; i++) {
      if (i > 0) parts.push(44);
      const val = (input[i] + seed![i % seed!.length]).toString();
      for (let k = 0; k < val.length; k++) parts.push(val.charCodeAt(k));
    }
    return new Uint8Array(parts);
  }
  /** Reverses byte-stream Vigenère cipher (V2). */
  deobfuscateWithVigenereCipherV2(input: Uint8Array, seed?: Uint8Array): Uint8Array {
    const output: number[] = [];
    let currentValStr = '';
    let byteIndex = 0;
    for (const byte of input) {
      if (byte === 44) {
        if (currentValStr) {
          output.push(parseInt(currentValStr, 10) - seed![byteIndex % seed!.length]);
          byteIndex++;
          currentValStr = '';
        }
      } else currentValStr += String.fromCharCode(byte);
    }
    if (currentValStr) output.push(parseInt(currentValStr, 10) - seed![byteIndex % seed!.length]);
    return new Uint8Array(output);
  }

  /** 10. Obfuscate by reversing byte blocks of deterministic size (V2). */
  obfuscateWithSeededBlockReversalV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const seedStr = this.bytesToString(seed!);
    const rng = prngFactory!(seedStr);
    const blockSize = Math.floor(rng() * (input.length / 2)) + 2;
    const output: number[] = [];
    for (let i = 0; i < input.length; i += blockSize) {
      const chunk = input.slice(i, i + blockSize).reverse();
      chunk.forEach((b) => output.push(b));
    }
    return new Uint8Array(output);
  }
  /** Reverses V2 block-level reversal (V2). */
  deobfuscateWithSeededBlockReversalV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    return this.obfuscateWithSeededBlockReversalV2(input, seed, prngFactory);
  }

  /** 11. Obfuscate using a seeded full-byte (0-255) substitution map (V2). */
  obfuscateWithSeededSubstitutionV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const chars = Array.from({ length: 256 }, (_, i) => i);
    const shuffledChars = [...chars];
    this.shuffleArray(shuffledChars, this.bytesToString(seed!), prngFactory!);
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) output[i] = shuffledChars[input[i]];
    return output;
  }
  /** Reverses V2 full-byte substitution (V2). */
  deobfuscateWithSeededSubstitutionV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const shuffledChars = Array.from({ length: 256 }, (_, i) => i);
    this.shuffleArray(shuffledChars, this.bytesToString(seed!), prngFactory!);
    const unsubMap = new Uint8Array(256);
    for (let i = 0; i < 256; i++) unsubMap[shuffledChars[i]] = i;
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) output[i] = unsubMap[input[i]];
    return output;
  }

  /**
   * Fisher-Yates shuffle implementation for deterministic array randomization.
   * @param array The array to shuffle in-place.
   * @param seed The seed string used to initialize the PRNG.
   * @param prngFactory Optional PRNG factory function. Defaults to legacy LCG.
   */
  private shuffleArray<T>(array: T[], seed: string, prngFactory: (s: string) => () => number = this.seededRandomLegacy.bind(this)) {
    const rng = prngFactory(seed);
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Legacy LCG (Linear Congruential Generator) PRNG.
   * Maintained for backward compatibility with V1 obfuscation.
   * @param seed The initialization seed.
   * @returns A parameterless function that generates a pseudo-random float [0, 1).
   */
  private seededRandomLegacy(seed: string) {
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

  /**
   * Mulberry32 PRNG.
   * Provides superior distribution and period length compared to legacy LCG.
   * Used for V2 obfuscation seeding.
   * @param seed The initialization seed.
   * @returns A parameterless function that generates a pseudo-random float [0, 1).
   */
  private mulberry32(seed: string) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    let state = h;

    return function () {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}
