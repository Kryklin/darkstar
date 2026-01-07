import { Injectable } from '@angular/core';
import CryptoJS from 'crypto-js';

export interface DecryptionResult {
  decrypted: string;
  isLegacy: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CryptService {
  private readonly ITERATIONS_V1 = 1000; // Legacy
  public ITERATIONS_V2 = 600000; // OWASP Recommended

  private readonly KEY_SIZE = 256 / 32;
  private readonly SALT_SIZE_BYTES = 128 / 8;
  private readonly IV_SIZE_BYTES = 128 / 8;

  // --- AES-256 Encryption ---

  /**
   * Encrypts a string using AES-256 with PBKDF2 key derivation.
   * @param data The string to encrypt.
   * @param password The password to use for encryption.
   * @param iterations Number of PBKDF2 iterations.
   * @returns The encrypted string (ciphertext) combined with salt and iv.
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
    // Combine salt, iv and ciphertext for transit
    // string concat: 32 hex chars (salt) + 32 hex chars (iv) + base64 ciphertext
    const transitmessage = salt.toString() + iv.toString() + encrypted.ciphertext.toString(CryptoJS.enc.Base64);
    return transitmessage;
  }

  /**
   * Decrypts a string using AES-256.
   * @param transitmessage The encrypted string (ciphertext) with salt and iv.
   * @param password The password to use for decryption.
   * @param iterations Number of PBKDF2 iterations.
   * @returns The decrypted string.
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
      console.error('Decryption failed:', error);
      return '';
    }
  }

  // --- Async AES-256 Encryption (V2 via Web Crypto) ---

  async encryptAES256Async(data: string, password: string, iterations: number): Promise<string> {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(this.SALT_SIZE_BYTES));
    const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_SIZE_BYTES));

    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        salt: salt as any,
        iterations: iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-CBC', length: 256 },
      false,
      ['encrypt'],
    );

    const encrypted = await window.crypto.subtle.encrypt(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { name: 'AES-CBC', iv: iv as any },
      key,
      enc.encode(data),
    );

    const saltHex = this.buf2hex(salt);
    const ivHex = this.buf2hex(iv);
    const ciphertextBase64 = this.buf2base64(encrypted);

    return saltHex + ivHex + ciphertextBase64;
  }

  async decryptAES256Async(transitmessage: string, password: string, iterations: number): Promise<string> {
    try {
      const saltHex = transitmessage.substr(0, 32);
      const ivHex = transitmessage.substr(32, 32);
      const encryptedBase64 = transitmessage.substring(64);

      const salt = this.hex2buf(saltHex);
      const iv = this.hex2buf(ivHex);
      // Decode Base64 to ArrayBuffer
      const encryptedBytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

      const enc = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          salt: salt as any,
          iterations: iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-CBC', length: 256 },
        false,
        ['decrypt'],
      );

      const decrypted = await window.crypto.subtle.decrypt(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { name: 'AES-CBC', iv: iv as any },
        key,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        encryptedBytes as any,
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Async Decryption failed:', error);
      return '';
    }
  }

  // --- Helpers for Web Crypto ---
  private buf2hex(buffer: ArrayBuffer | Uint8Array): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hex2buf(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  }

  private buf2base64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // --- Main Encryption/Decryption Logic ---

  /**
   * Encrypts a mnemonic phrase by shuffling and obfuscating with a seeded password reference.
   * Uses V2 logic (Strong PRNG + High Iterations).
   * Returns encrypted data wrapped in a V2 envelope and the reverse key.
   */
  async encrypt(mnemonic: string, password: string): Promise<{ encryptedData: string; reverseKey: string }> {
    const words = mnemonic.split(' ');
    const obfuscatedWords: Uint8Array[] = [];
    const reverseKey: number[][] = [];

    // Memory Hardening: Convert sensitive inputs to Uint8Array immediately
    const passwordBytes = this.stringToBytes(password);

    // Use Mulberry32 for V2
    const prngFactory = this.mulberry32.bind(this);

    for (const word of words) {
      let currentWordBytes = this.stringToBytes(word);

      // Create a fresh, ordered list of all 12 function indexes
      const selectedFunctions = Array.from({ length: this.obfuscationFunctionsV2.length }, (_, i) => i);

      // Shuffle deterministically
      // Note: shuffleArray still takes string seed for PRNG because strict number gen is fine with string seed.
      // We used `password + word` as seed string.
      this.shuffleArray(selectedFunctions, password + word, prngFactory);

      const wordReverseKey: number[] = [];

      // Checksum from function indexes
      const checksum = this._generateChecksum(selectedFunctions);
      // Combined seed for operations.
      // V2: "password" (bytes) + "checksum" (stringified? or bytes?)
      // To be consistent with "strong properties", let's append checksum byte?
      // Checksum is 0-996. Can fit in 2 bytes.
      // Let's make combinedSeed a Uint8Array.
      const checksumStr = checksum.toString();
      const checksumBytes = this.stringToBytes(checksumStr);
      const combinedSeed = new Uint8Array(passwordBytes.length + checksumBytes.length);
      combinedSeed.set(passwordBytes);
      combinedSeed.set(checksumBytes, passwordBytes.length);

      for (const funcIndex of selectedFunctions) {
        const func = this.obfuscationFunctionsV2[funcIndex];
        const isSeeded = funcIndex >= 6;
        const seed = isSeeded ? combinedSeed : undefined;

        // Execute V2 function
        const nextWordBytes = func(currentWordBytes, seed, prngFactory);

        // Zero out the *previous* version of data from memory
        // (Unless it was the initial wordBytes, but standardizing: "current" is dead now)
        if (currentWordBytes !== nextWordBytes) {
          // ensure not same ref
          this.zero(currentWordBytes);
        }
        currentWordBytes = nextWordBytes;
        wordReverseKey.push(funcIndex);
      }

      obfuscatedWords.push(currentWordBytes);
      reverseKey.push(wordReverseKey);

      // Zero combinedSeed after use for this word
      this.zero(combinedSeed);
    }

    // Join all obfuscated words with a separator.
    // Using 0xFF as separator (Assuming Obfuscation functions generally produce ASCII or valid content,
    // but Shuffle/XOR can produce 0xFF.
    // Problem: If data contains 0xFF, safe split is impossible.
    // V1 used '§' (C2 A7).
    // Let's use a distinct multi-byte separator that is highly unlikely to be generated?
    // OR: Use Length-Prefixing!
    // [Len][Bytes][Len][Bytes]...
    // Length can be 2 bytes (uint16).
    // This is safer than separators for binary data.

    // Construct the final blob
    let totalLength = 0;
    for (const wb of obfuscatedWords) {
      totalLength += 2 + wb.length; // 2 bytes size + data
    }
    const finalBlob = new Uint8Array(totalLength);
    let offset = 0;
    for (const wb of obfuscatedWords) {
      finalBlob[offset] = (wb.length >> 8) & 0xff;
      finalBlob[offset + 1] = wb.length & 0xff;
      finalBlob.set(wb, offset + 2);
      offset += 2 + wb.length;

      // Zero the word bytes after copying
      this.zero(wb);
    }

    // Convert final binary blob to Base64 String for AES encryption (which expects string)
    // We use a manual base64 conversion or just binary-to-string-latin1 then btoa?
    // To match AES input 'string', we can essentially treat this as a string of bytes.
    // However, clean Base64 is best for transport through AES 'string' parameter.

    // Let's efficiently convert Uint8Array to Binary String then btoa
    let binaryString = '';
    for (const byte of finalBlob) {
      binaryString += String.fromCharCode(byte);
    }
    const base64Content = btoa(binaryString);

    this.zero(finalBlob); // Zero the final blob
    this.zero(passwordBytes); // Zero password

    // Encrypt with V2 iterations (Using Async Web Crypto)
    const encryptedContent = await this.encryptAES256Async(base64Content, password, this.ITERATIONS_V2);

    // V2 Envelope
    const resultObj = {
      v: 2,
      data: encryptedContent,
    };

    const reverseKeyString = JSON.stringify(reverseKey);
    const encodedReverseKey = btoa(reverseKeyString);

    return { encryptedData: JSON.stringify(resultObj), reverseKey: encodedReverseKey };
  }

  /**
   * Decrypts an encrypted mnemonic phrase using the provided reverse key and password.
   * Auto-detects V1 vs V2 format.
   * Returns object containing decrypted text and a flag indicating if it was legacy (V1).
   */
  async decrypt(encryptedDataRaw: string, reverseKey: string, password: string): Promise<DecryptionResult> {
    let iterations = this.ITERATIONS_V1;
    let encryptedContent = encryptedDataRaw;
    let prngFactory = this.seededRandomLegacy.bind(this); // Default to V1
    let isLegacy = true;

    // Check for V2 Envelope
    try {
      if (encryptedDataRaw.trim().startsWith('{')) {
        const parsed = JSON.parse(encryptedDataRaw);
        if (parsed.v === 2 && parsed.data) {
          iterations = this.ITERATIONS_V2;
          encryptedContent = parsed.data;
          prngFactory = this.mulberry32.bind(this); // V2 uses Mulberry32
          isLegacy = false;
        }
      }
    } catch {
      // Not JSON, assume V1 legacy string
    }

    // 1. Decode the reverse key from Base64
    const reverseKeyString = atob(reverseKey);
    const reverseKeyJson: number[][] = JSON.parse(reverseKeyString);

    // 2. Decrypt the main data block
    // 2. Decrypt the main data block
    let decryptedObfuscatedString = '';

    if (isLegacy) {
      // Sync Legacy Decryption
      decryptedObfuscatedString = this.decryptAES256(encryptedContent, password, iterations);
    } else {
      // Async V2 Decryption
      decryptedObfuscatedString = await this.decryptAES256Async(encryptedContent, password, iterations);
    }

    if (!decryptedObfuscatedString) {
      throw new Error('AES decryption failed. Check password.');
    }

    // --- V2 Decryption Logic (Uint8Array) ---
    if (!isLegacy) {
      // V2: decryptedString is Base64 encoded binary blob
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
        if (wordIndex >= reverseKeyJson.length) break; // Safety

        // Read Length (2 bytes)
        const len = (fullBlob[offset] << 8) | fullBlob[offset + 1];
        offset += 2;

        // Read Data
        let currentWordBytes = fullBlob.slice(offset, offset + len);
        offset += len;

        const wordReverseKey = reverseKeyJson[wordIndex];

        // Setup Seed
        const checksum = this._generateChecksum(wordReverseKey);
        const checksumStr = checksum.toString();
        const checksumBytes = this.stringToBytes(checksumStr);
        const combinedSeed = new Uint8Array(passwordBytes.length + checksumBytes.length);
        combinedSeed.set(passwordBytes);
        combinedSeed.set(checksumBytes, passwordBytes.length);

        // Apply Deobfuscation
        for (let j = wordReverseKey.length - 1; j >= 0; j--) {
          const funcIndex = wordReverseKey[j];
          const func = this.deobfuscationFunctionsV2[funcIndex];
          if (!func) throw new Error(`Invalid deobfuscation function index: ${funcIndex}`);

          const isSeeded = funcIndex >= 6;
          const seed = isSeeded ? combinedSeed : undefined;

          // Execute V2 Function
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          currentWordBytes = func(currentWordBytes as any, seed as any, prngFactory) as any;
        }

        deobfuscatedWords.push(this.bytesToString(currentWordBytes));
        wordIndex++;
      }

      return { decrypted: deobfuscatedWords.join(' '), isLegacy };
    }

    // --- V1 Decryption Logic (Legacy/String) ---
    else {
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
          currentWord = func(currentWord, seed, prngFactory); // Pass PRNG factory
        }
        deobfuscatedWords.push(currentWord);
      }

      return { decrypted: deobfuscatedWords.join(' '), isLegacy };
    }
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

  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();

  // --- Uint8Array Helpers ---
  private stringToBytes(str: string): Uint8Array {
    return this.textEncoder.encode(str);
  }

  private bytesToString(bytes: Uint8Array): string {
    return this.textDecoder.decode(bytes);
  }

  private zero(bytes: Uint8Array): void {
    bytes.fill(0);
  }

  /**
   * Helper type for PRNG factory
   */
  public obfuscationFunctions: ((input: string, seed?: string, rngFactory?: (s: string) => () => number) => string)[];
  public deobfuscationFunctions: ((input: string, seed?: string, rngFactory?: (s: string) => () => number) => string)[];

  // V2 Functions (Uint8Array)
  public obfuscationFunctionsV2: ((input: Uint8Array, seed?: Uint8Array, rngFactory?: (s: string) => () => number) => Uint8Array)[];
  public deobfuscationFunctionsV2: ((input: Uint8Array, seed?: Uint8Array, rngFactory?: (s: string) => () => number) => Uint8Array)[];

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

    this.obfuscationFunctionsV2 = [
      // --- 6 Unseeded Functions (V2) ---
      this.obfuscateByReversingV2.bind(this), // 0
      this.obfuscateWithAtbashCipherV2.bind(this), // 1
      this.obfuscateToCharCodesV2.bind(this), // 2 - Behaves differently for bytes? No, logic is adapting.
      this.obfuscateToBinaryV2.bind(this), // 3
      this.obfuscateWithCaesarCipherV2.bind(this), // 4
      this.obfuscateBySwappingAdjacentBytesV2.bind(this), // 5

      // --- 6 Seeded Functions (V2) ---
      this.obfuscateByShufflingV2.bind(this), // 6
      this.obfuscateWithXORV2.bind(this), // 7
      this.obfuscateByInterleavingV2.bind(this), // 8
      this.obfuscateWithVigenereCipherV2.bind(this), // 9
      this.obfuscateWithSeededBlockReversalV2.bind(this), // 10
      this.obfuscateWithSeededSubstitutionV2.bind(this), // 11
    ];

    this.deobfuscationFunctionsV2 = [
      // --- 6 Unseeded Functions (V2) ---
      this.deobfuscateByReversingV2.bind(this), // 0
      this.deobfuscateWithAtbashCipherV2.bind(this), // 1
      this.deobfuscateFromCharCodesV2.bind(this), // 2
      this.deobfuscateFromBinaryV2.bind(this), // 3
      this.deobfuscateWithCaesarCipherV2.bind(this), // 4
      this.deobfuscateBySwappingAdjacentBytesV2.bind(this), // 5

      // --- 6 Seeded Functions (V2) ---
      this.deobfuscateByShufflingV2.bind(this), // 6
      this.deobfuscateWithXORV2.bind(this), // 7
      this.deobfuscateByDeinterleavingV2.bind(this), // 8
      this.deobfuscateWithVigenereCipherV2.bind(this), // 9
      this.deobfuscateWithSeededBlockReversalV2.bind(this), // 10
      this.deobfuscateWithSeededSubstitutionV2.bind(this), // 11
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

  // --- V2 Unseeded Functions (Uint8Array) ---

  // 0. Reverse
  obfuscateByReversingV2(input: Uint8Array): Uint8Array {
    return input.reverse();
  }
  deobfuscateByReversingV2(input: Uint8Array): Uint8Array {
    return input.reverse();
  }

  // 1. Atbash Cipher (Mirrors V1 logic: only affects a-zA-Z)
  obfuscateWithAtbashCipherV2(input: Uint8Array): Uint8Array {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const code = input[i];
      if (code >= 65 && code <= 90) {
        // A-Z
        output[i] = 90 - (code - 65);
      } else if (code >= 97 && code <= 122) {
        // a-z
        output[i] = 122 - (code - 97);
      } else {
        output[i] = code;
      }
    }
    return output;
  }
  deobfuscateWithAtbashCipherV2(input: Uint8Array): Uint8Array {
    return this.obfuscateWithAtbashCipherV2(input);
  }

  // 2. To Char Codes (e.g. [65, 66] -> "65,66" -> bytes of "65,66")
  obfuscateToCharCodesV2(input: Uint8Array): Uint8Array {
    // We construct the string representation manually to avoid string conversion overhead if possible,
    // but using stringToBytes is cleaner for readability and equivalence.
    // However, for memory safety, we should try to avoid the intermediate huge string if possible.
    // But since V2 depends on the output looking like the V1 output (conceptually),
    // we essentially expand the data.
    // Let's use an array of arrays then flatten.

    // Simplest robust impl that matches V1 structure:
    const parts: number[] = [];
    for (let i = 0; i < input.length; i++) {
      if (i > 0) parts.push(44); // comma ','
      const strVal = input[i].toString();
      for (let j = 0; j < strVal.length; j++) {
        parts.push(strVal.charCodeAt(j));
      }
    }
    return new Uint8Array(parts);
  }

  deobfuscateFromCharCodesV2(input: Uint8Array): Uint8Array {
    // Parse "65,66" bytes back to [65, 66]
    // We can just decode to string, split, parse.
    // Since this is DE-obfuscation, the input "65,66" isn't the raw secret,
    // the RESULT [65, 66] is the secret. The input is "safe" to be a string temporarily?
    // Actually, if we want to be fully memory safe, we should avoid turning the WHOLE thing into a string.

    const output: number[] = [];
    let currentNumStr = '';

    for (const byte of input) {
      if (byte === 44) {
        // comma
        if (currentNumStr) {
          output.push(parseInt(currentNumStr, 10));
          currentNumStr = '';
        }
      } else {
        currentNumStr += String.fromCharCode(byte);
      }
    }
    if (currentNumStr) {
      output.push(parseInt(currentNumStr, 10));
    }

    return new Uint8Array(output);
  }

  // 3. To Binary
  obfuscateToBinaryV2(input: Uint8Array): Uint8Array {
    const parts: number[] = [];
    for (let i = 0; i < input.length; i++) {
      if (i > 0) parts.push(44); // comma
      const binVal = input[i].toString(2);
      for (let j = 0; j < binVal.length; j++) {
        parts.push(binVal.charCodeAt(j));
      }
    }
    return new Uint8Array(parts);
  }

  deobfuscateFromBinaryV2(input: Uint8Array): Uint8Array {
    const output: number[] = [];
    let currentBinStr = '';

    for (const byte of input) {
      if (byte === 44) {
        if (currentBinStr) {
          output.push(parseInt(currentBinStr, 2));
          currentBinStr = '';
        }
      } else {
        currentBinStr += String.fromCharCode(byte);
      }
    }
    if (currentBinStr) {
      output.push(parseInt(currentBinStr, 2));
    }
    return new Uint8Array(output);
  }

  // 4. Caesar Cipher (ROT13)
  obfuscateWithCaesarCipherV2(input: Uint8Array): Uint8Array {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const code = input[i];
      if (code >= 65 && code <= 90) {
        output[i] = ((code - 65 + 13) % 26) + 65;
      } else if (code >= 97 && code <= 122) {
        output[i] = ((code - 97 + 13) % 26) + 97;
      } else {
        output[i] = code;
      }
    }
    return output;
  }
  deobfuscateWithCaesarCipherV2(input: Uint8Array): Uint8Array {
    return this.obfuscateWithCaesarCipherV2(input);
  }

  // 5. Adjacent Byte Swap
  obfuscateBySwappingAdjacentBytesV2(input: Uint8Array): Uint8Array {
    const output = new Uint8Array(input); // Copy
    for (let i = 0; i < output.length - 1; i += 2) {
      [output[i], output[i + 1]] = [output[i + 1], output[i]];
    }
    return output;
  }
  deobfuscateBySwappingAdjacentBytesV2(input: Uint8Array): Uint8Array {
    return this.obfuscateBySwappingAdjacentBytesV2(input);
  }

  // --- Seeded Functions ---

  // 6. Character Shuffling
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
  obfuscateWithSeededBlockReversal(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    const rng = prngFactory ? prngFactory(seed!) : this.seededRandomLegacy(seed!);
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
  deobfuscateWithSeededBlockReversal(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    return this.obfuscateWithSeededBlockReversal(input, seed, prngFactory);
  }

  // 11. Seeded Substitution
  obfuscateWithSeededSubstitution(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    const shuffledChars = [...chars];
    this.shuffleArray(shuffledChars, seed!, prngFactory!);
    const subMap = new Map(chars.map((c, i) => [c, shuffledChars[i]]));
    return input
      .split('')
      .map((char) => subMap.get(char) || char)
      .join('');
  }
  deobfuscateWithSeededSubstitution(input: string, seed?: string, prngFactory?: (s: string) => () => number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    const shuffledChars = [...chars];
    this.shuffleArray(shuffledChars, seed!, prngFactory!);
    const unsubMap = new Map(shuffledChars.map((c, i) => [c, chars[i]]));
    return input
      .split('')
      .map((char) => unsubMap.get(char) || char)
      .join('');
  }

  // --- V2 Seeded Functions (Uint8Array) ---

  // 6. Shuffling
  obfuscateByShufflingV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const a = new Uint8Array(input); // Copy
    const n = a.length;
    // Note: We convert seed bytes to string for the PRNG factory to match existing signature
    const seedStr = this.bytesToString(seed!);
    const rng = prngFactory!(seedStr);

    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
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
    for (let i = 0; i < n; i++) {
      unshuffled[indices[i]] = a[i];
    }
    return unshuffled;
  }

  // 7. XOR
  obfuscateWithXORV2(input: Uint8Array, seed?: Uint8Array): Uint8Array {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] ^ seed![i % seed!.length];
    }
    return output;
  }
  deobfuscateWithXORV2(input: Uint8Array, seed?: Uint8Array): Uint8Array {
    return this.obfuscateWithXORV2(input, seed);
  }

  // 8. Interleave
  obfuscateByInterleavingV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789'; // Same set as V1
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
  deobfuscateByDeinterleavingV2(input: Uint8Array): Uint8Array {
    const output = new Uint8Array(input.length / 2);
    for (let i = 0; i < input.length; i += 2) {
      output[i / 2] = input[i];
    }
    return output;
  }

  // 9. Vigenere Cipher (Output: "100,102" as bytes)
  obfuscateWithVigenereCipherV2(input: Uint8Array, seed?: Uint8Array): Uint8Array {
    const parts: number[] = [];
    for (let i = 0; i < input.length; i++) {
      if (i > 0) parts.push(44); // comma
      const charCode = input[i];
      const keyCode = seed![i % seed!.length];
      const val = (charCode + keyCode).toString();
      for (let k = 0; k < val.length; k++) {
        parts.push(val.charCodeAt(k));
      }
    }
    return new Uint8Array(parts);
  }
  deobfuscateWithVigenereCipherV2(input: Uint8Array, seed?: Uint8Array): Uint8Array {
    const output: number[] = [];
    let currentValStr = '';

    // Parse "100,102" bytes
    let byteIndex = 0; // count of logical bytes extracted
    for (const byte of input) {
      if (byte === 44) {
        if (currentValStr) {
          const combinedVal = parseInt(currentValStr, 10);
          const keyCode = seed![byteIndex % seed!.length];
          output.push(combinedVal - keyCode);
          byteIndex++;
          currentValStr = '';
        }
      } else {
        currentValStr += String.fromCharCode(byte);
      }
    }
    if (currentValStr) {
      const combinedVal = parseInt(currentValStr, 10);
      const keyCode = seed![byteIndex % seed!.length];
      output.push(combinedVal - keyCode);
    }

    return new Uint8Array(output);
  }

  // 10. Seeded Block Reversal
  obfuscateWithSeededBlockReversalV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const seedStr = this.bytesToString(seed!);
    const rng = prngFactory!(seedStr);
    const blockSize = Math.floor(rng() * (input.length / 2)) + 2;

    const output: number[] = [];
    for (let i = 0; i < input.length; i += blockSize) {
      // slice is [start, end)
      // reverse
      const chunk = input.slice(i, i + blockSize).reverse();
      chunk.forEach((b) => output.push(b));
    }
    return new Uint8Array(output);
  }
  deobfuscateWithSeededBlockReversalV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    return this.obfuscateWithSeededBlockReversalV2(input, seed, prngFactory);
  }

  // 11. Seeded Substitution
  obfuscateWithSeededSubstitutionV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    // V1 uses 'abcdef...0123' (62 chars). It only substitutes those.
    // V2 Uint8Array logic: We should probably only substitute those bytes if we want to match V1 logic exactly?
    // Or can we substitute ALL bytes 0-255?
    // "Seeded Substitution" implies a mapping.
    // If we only substitute 62 specific bytes, it's weird for a byte-level generic func.
    // BUT, V1 logic was: Map a->x, b->y.
    // If we change this to Map 0->?, 255->?, it's much stronger functionality.
    // Let's Upgrade to Full Byte Substitution (0-255).
    // This is a V2 change, so we can define the behavior.

    // Shuffle array of 0..255
    const chars = Array.from({ length: 256 }, (_, i) => i);
    const shuffledChars = [...chars];
    const seedStr = this.bytesToString(seed!);

    // use internal shuffle
    this.shuffleArray(shuffledChars, seedStr, prngFactory!);

    // Map
    // To optimize: simple lookups
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = shuffledChars[input[i]];
    }
    return output;
  }
  deobfuscateWithSeededSubstitutionV2(input: Uint8Array, seed?: Uint8Array, prngFactory?: (s: string) => () => number): Uint8Array {
    const chars = Array.from({ length: 256 }, (_, i) => i);
    const shuffledChars = [...chars];
    const seedStr = this.bytesToString(seed!);

    this.shuffleArray(shuffledChars, seedStr, prngFactory!);

    // We need Reverse Map: value -> index
    const unsubMap = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      unsubMap[shuffledChars[i]] = i;
    }

    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = unsubMap[input[i]];
    }
    return output;
  }

  private shuffleArray<T>(array: T[], seed: string, prngFactory: (s: string) => () => number = this.seededRandomLegacy.bind(this)) {
    const rng = prngFactory(seed);
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  /**
   * Legacy LCG (Linear Congruential Generator)
   * Used for V1 backward compatibility.
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
   * Mulberry32 PRNG
   * Stronger distribution than simple LCG, suitable for obfuscation seeding.
   */
  private mulberry32(seed: string) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    // Initial mixing
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
