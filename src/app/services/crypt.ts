import { Injectable } from '@angular/core';
import CryptoJS from 'crypto-js';

@Injectable({
  providedIn: 'root'
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
        iterations: 1000
    });
    const iv = CryptoJS.lib.WordArray.random(128 / 8);
    const encrypted = CryptoJS.AES.encrypt(data, key, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
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
      iterations: 1000
    });

    const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
      iv: iv,
      padding: CryptoJS.pad.Pkcs7,
      mode: CryptoJS.mode.CBC
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  // --- Main Encryption/Decryption Logic ---

  /**
   * Encrypts a mnemonic phrase.
   * @param mnemonic The BIP39 mnemonic phrase.
   * @param password The password.
   * @returns An object containing the encrypted data and the reverse key.
   */
  encrypt(mnemonic: string, password: string): { encryptedData: string; reverseKey: string } {
    const words = mnemonic.split(' ');
    const obfuscatedWords: string[] = [];
    const reverseKey: number[][] = [];

    const functionIndexes = Array.from({ length: this.obfuscationFunctions.length }, (_, i) => i);

    for (const word of words) {
      // Ensure at least one seeded function (index 9 or 13) is included
      const seededIndexes = [9, 13];
      const nonSeededIndexes = functionIndexes.filter(i => !seededIndexes.includes(i));

      // Shuffle for variety using a seed that is NOT dependent on the word itself
      this.shuffleArray(nonSeededIndexes, password); 

      const randomSeededIndex = seededIndexes[Math.floor(this.seededRandom(password + 's')() * seededIndexes.length)];
      const selectedFunctions = [randomSeededIndex];

      const numFunctions = 11; // 11 + 1 seeded = 12
      for (let i = 0; i < numFunctions; i++) {
        selectedFunctions.push(nonSeededIndexes[i]);
      }

      // Shuffle the final function list using a seed that is NOT dependent on the word
      this.shuffleArray(selectedFunctions, password + 'f'); 

      let currentWord = word;
      const wordReverseKey: number[] = [];

      // Generate a checksum from the selected function indexes
      const checksum = this._generateChecksum(selectedFunctions);
      const combinedSeed = password + checksum;

      for (const funcIndex of selectedFunctions) {
        const func = this.obfuscationFunctions[funcIndex];
        // The seed must be consistent and available during both encryption and decryption.
        // Use the combined seed for specific functions, otherwise use the password.
        const seed = [7, 9, 13].includes(funcIndex) ? combinedSeed : password;
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
   * Decrypts an encrypted mnemonic phrase.
   * @param encryptedData The encrypted data.
   * @param reverseKey The Base64 encoded reverse key.
   * @param password The password.
   * @returns The decrypted mnemonic phrase.
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
        // Use the combined seed for specific functions, consistent with encryption
        const seed = [7, 9, 13].includes(funcIndex) ? combinedSeed : password;
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
      this.obfuscateByReversing.bind(this),
      this.obfuscateToCharCodes.bind(this),
      this.obfuscateToBinary.bind(this),
      this.obfuscateToHex.bind(this),
      this.obfuscateWithCaesarCipher.bind(this),
      this.obfuscateWithAtbashCipher.bind(this),
      this.obfuscateToLeet.bind(this),
      this.obfuscateByInterleaving.bind(this),
      this.obfuscateWithCaesarCipher7.bind(this),
      this.obfuscateByShuffling.bind(this),
      this.obfuscateWithCustomSeparator.bind(this),
      this.obfuscateWithBitwiseNot.bind(this),
      this.obfuscateWithAsciiShift.bind(this),
      this.obfuscateWithXOR.bind(this),
      this.obfuscateToMorseCode.bind(this),
      this.obfuscateWithKeyboardShift.bind(this),
      this.obfuscateToHtmlEntities.bind(this),
      this.obfuscateToOctal.bind(this),
      this.obfuscateWithNibbleSwap.bind(this),
      this.obfuscateWithVowelRotation.bind(this),
      this.obfuscateWithIndexMath.bind(this),
      this.obfuscateWithMirrorCase.bind(this),
      this.obfuscateWithIndexInterleave.bind(this),
      this.obfuscateBySwappingAdjacentChars.bind(this)
    ];
    this.deobfuscationFunctions = [
      this.deobfuscateByReversing.bind(this),
      this.deobfuscateFromCharCodes.bind(this),
      this.deobfuscateFromBinary.bind(this),
      this.deobfuscateFromHex.bind(this),
      this.deobfuscateWithCaesarCipher.bind(this),
      this.deobfuscateWithAtbashCipher.bind(this),
      this.deobfuscateFromLeet.bind(this),
      this.deobfuscateByDeinterleaving.bind(this),
      this.deobfuscateWithCaesarCipher7.bind(this),
      this.deobfuscateByShuffling.bind(this),
      this.deobfuscateWithCustomSeparator.bind(this),
      this.deobfuscateWithBitwiseNot.bind(this),
      this.deobfuscateWithAsciiShift.bind(this),
      this.deobfuscateWithXOR.bind(this),
      this.deobfuscateFromMorseCode.bind(this),
      this.deobfuscateWithKeyboardShift.bind(this),
      this.deobfuscateFromHtmlEntities.bind(this),
      this.deobfuscateFromOctal.bind(this),
      this.deobfuscateWithNibbleSwap.bind(this),
      this.deobfuscateWithVowelRotation.bind(this),
      this.deobfuscateWithIndexMath.bind(this),
      this.deobfuscateWithMirrorCase.bind(this),
      this.deobfuscateWithIndexInterleave.bind(this),
      this.deobfuscateBySwappingAdjacentChars.bind(this)
    ];
  }

  // 1. Reverse String
  obfuscateByReversing(input: string, seed?: string): string {
    return input.split('').reverse().join('');
  }
  deobfuscateByReversing(input: string, seed?: string): string {
    return input.split('').reverse().join('');
  }

  // 2. Character Code
  obfuscateToCharCodes(input: string, seed?: string): string {
    return input.split('').map(char => char.charCodeAt(0)).join(' ');
  }
  deobfuscateFromCharCodes(input: string, seed?: string): string {
    return input.split(' ').map(code => String.fromCharCode(parseInt(code, 10))).join('');
  }

  // 3. Binary
  obfuscateToBinary(input: string, seed?: string): string {
    return input.split('').map(char => char.charCodeAt(0).toString(2)).join(' ');
  }
  deobfuscateFromBinary(input: string, seed?: string): string {
    return input.split(' ').map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
  }

  // 4. Hexadecimal
  obfuscateToHex(input: string, seed?: string): string {
    return input.split('').map(char => char.charCodeAt(0).toString(16)).join(' ');
  }
  deobfuscateFromHex(input: string, seed?: string): string {
    return input.split(' ').map(hex => String.fromCharCode(parseInt(hex, 16))).join('');
  }

  // 5. Caesar Cipher (ROT13)
  obfuscateWithCaesarCipher(input: string, seed?: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const base = code < 91 ? 65 : 97;
      return String.fromCharCode(((code - base + 13) % 26) + base);
    });
  }
  deobfuscateWithCaesarCipher(input: string, seed?: string): string {
    return this.obfuscateWithCaesarCipher(input);
  }

  // 6. Atbash Cipher
  obfuscateWithAtbashCipher(input: string, seed?: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) { // Uppercase
        return String.fromCharCode(90 - (code - 65));
      } else if (code >= 97 && code <= 122) { // Lowercase
        return String.fromCharCode(122 - (code - 97));
      }
      return c; // Not a letter
    });
  }
  deobfuscateWithAtbashCipher(input: string, seed?: string): string {
    return this.obfuscateWithAtbashCipher(input);
  }

  // 7. Leet (1337) Speak
  obfuscateToLeet(input: string, seed?: string): string {
    const leetMap: { [key: string]: string } = {
      'a': '4', 'e': '3', 'g': '6', 'i': '1', 'o': '0', 's': '5', 't': '7',
      'A': '4', 'E': '3', 'G': '6', 'I': '1', 'O': '0', 'S': '5', 'T': '7'
    };
    return input.split('').map(char => leetMap[char] || char).join('');
  }
  deobfuscateFromLeet(input: string, seed?: string): string {
    const unLeetMap: { [key: string]: string } = {
      '4': 'a', '3': 'e', '6': 'g', '1': 'i', '0': 'o', '5': 's', '7': 't'
    };
    return input.split('').map(char => unLeetMap[char.toLowerCase()] || char).join('');
  }

  // 8. Interleave
  obfuscateByInterleaving(input: string, seed?: string): string {
    const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    let rng = this.seededRandom(seed! + input); // Use a seeded RNG
    for (const char of input) {
      const randomChar = randomChars.charAt(Math.floor(rng() * randomChars.length));
      result += char + randomChar;
    }
    return result;
  }
  deobfuscateByDeinterleaving(input: string, seed?: string): string {
    let result = '';
    for (let i = 0; i < input.length; i += 2) {
      result += input[i];
    }
    return result;
  }

  // 9. Caesar Cipher (ROT7)
  obfuscateWithCaesarCipher7(input: string, seed?: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const base = code < 91 ? 65 : 97;
      return String.fromCharCode(((code - base + 7) % 26) + base);
    });
  }
  deobfuscateWithCaesarCipher7(input: string, seed?: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const base = code < 91 ? 65 : 97;
      return String.fromCharCode(((code - base - 7 + 26) % 26) + base);
    });
  }

  // 10. Character Shuffling
  obfuscateByShuffling(input: string, seed: string = 'default_seed'): string {
    const a = input.split('');
    const n = a.length;
    let rng = this.seededRandom(seed);

    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.join('');
  }
  deobfuscateByShuffling(input: string, seed: string = 'default_seed'): string {
    const a = input.split('');
    const n = a.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    let rng = this.seededRandom(seed);

    // Create the same shuffled sequence of indices
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Unshuffle by applying the inverse mapping
    const unshuffled = new Array(n);
    for (let i = 0; i < n; i++) {
      unshuffled[indices[i]] = a[i];
    }

    return unshuffled.join('');
  }

  // 11. Custom Separator
  obfuscateWithCustomSeparator(input: string, seed?: string): string {
    return input.split('').join('<-|->');
  }
  deobfuscateWithCustomSeparator(input: string, seed?: string): string {
    return input.split('<-|->').join('');
  }

  // 12. Bitwise NOT
  obfuscateWithBitwiseNot(input: string, seed?: string): string {
    return input.split('').map(char => String.fromCharCode(~char.charCodeAt(0))).join('');
  }
  deobfuscateWithBitwiseNot(input: string, seed?: string): string {
    return input.split('').map(char => String.fromCharCode(~char.charCodeAt(0))).join('');
  }

  // 13. ASCII Value Shift
  obfuscateWithAsciiShift(input: string, seed = '5'): string {
    const shift = parseInt(seed, 10);
    return input.split('').map(char => String.fromCharCode(char.charCodeAt(0) + shift)).join('');
  }
  deobfuscateWithAsciiShift(input: string, seed = '5'): string {
    const shift = parseInt(seed, 10);
    return input.split('').map(char => String.fromCharCode(char.charCodeAt(0) - shift)).join('');
  }

  // 14. XOR Obfuscation
  obfuscateWithXOR(input: string, key: string = 'default_key'): string {
    return input.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
  }
  deobfuscateWithXOR(input: string, key: string = 'default_key'): string {
    return this.obfuscateWithXOR(input, key);
  }

  // 15. Morse Code
  obfuscateToMorseCode(input: string, seed?: string): string {
    const morseMap: { [key: string]: string } = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....',
        'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.',
        'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
        '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----', ' ': '/'
    };
    return input.toUpperCase().split('').map(char => morseMap[char] || '').join(' ');
  }
  deobfuscateFromMorseCode(input: string, seed?: string): string {
    const unMorseMap: { [key: string]: string } = {
        '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F', '--.': 'G', '....': 'H',
        '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P',
        '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
        '-.--': 'Y', '--..': 'Z', '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5',
        '-....': '6', '--...': '7', '---..': '8', '----.': '9', '-----': '0', '/': ' '
    };
    return input.split(' ').map(code => unMorseMap[code] || '').join('');
  }

  // 16. Keyboard Shift
  obfuscateWithKeyboardShift(input: string, seed?: string): string {
    const qwerty = "qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";
    return input.split('').map(char => {
      const index = qwerty.indexOf(char.toLowerCase());
      return index !== -1 && index < qwerty.length - 1 ? qwerty[index + 1] : char;
    }).join('');
  }
  deobfuscateWithKeyboardShift(input: string, seed?: string): string {
    const qwerty = "qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";
    return input.split('').map(char => {
      const index = qwerty.indexOf(char.toLowerCase());
      return index > 0 ? qwerty[index - 1] : char;
    }).join('');
  }

  // 17. HTML Entities
  obfuscateToHtmlEntities(input: string, seed?: string): string {
    return input.split('').map(char => `&#${char.charCodeAt(0)};`).join('');
  }
  deobfuscateFromHtmlEntities(input: string, seed?: string): string {
    return input.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  }

  // 18. Octal
  obfuscateToOctal(input: string, seed?: string): string {
    return input.split('').map(char => '\\' + char.charCodeAt(0).toString(8)).join('');
  }
  deobfuscateFromOctal(input: string, seed?: string): string {
    return input.split('\\').slice(1).map(oct => String.fromCharCode(parseInt(oct, 8))).join('');
  }

  // 19. Nibble Swap
  obfuscateWithNibbleSwap(input: string, seed?: string): string {
    return input.split('').map(char => {
      const hex = char.charCodeAt(0).toString(16).padStart(2, '0');
      return String.fromCharCode(parseInt(hex[1] + hex[0], 16));
    }).join('');
  }
  deobfuscateWithNibbleSwap(input: string, seed?: string): string {
    return this.obfuscateWithNibbleSwap(input);
  }

  // 20. Vowel Rotation
  obfuscateWithVowelRotation(input: string, seed?: string): string {
    const vowels = 'aeiou';
    return input.split('').map(char => {
      const lowerChar = char.toLowerCase();
      const index = vowels.indexOf(lowerChar);
      if (index !== -1) {
        const newVowel = vowels[(index + 1) % vowels.length];
        return char === lowerChar ? newVowel : newVowel.toUpperCase();
      }
      return char;
    }).join('');
  }
  deobfuscateWithVowelRotation(input: string, seed?: string): string {
    const vowels = 'aeiou';
    return input.split('').map(char => {
      const lowerChar = char.toLowerCase();
      const index = vowels.indexOf(lowerChar);
      if (index !== -1) {
        const newVowel = vowels[(index + vowels.length - 1) % vowels.length];
        return char === lowerChar ? newVowel : newVowel.toUpperCase();
      }
      return char;
    }).join('');
  }

  // 21. Add/Subtract Index
  obfuscateWithIndexMath(input: string, seed?: string): string {
    return input.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) + i)).join('');
  }
  deobfuscateWithIndexMath(input: string, seed?: string): string {
    return input.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) - i)).join('');
  }

  // 22. Mirror Case
  obfuscateWithMirrorCase(input: string, seed?: string): string {
    return input.split('').map(char => {
      if (char === char.toUpperCase()) {
        return char.toLowerCase();
      }
      return char.toUpperCase();
    }).join('');
  }
  deobfuscateWithMirrorCase(input: string, seed?: string): string {
    return this.obfuscateWithMirrorCase(input);
  }

  // 23. Interleave with Index
  obfuscateWithIndexInterleave(input: string, seed?: string): string {
    return input.split('').map((char, i) => char + i).join('');
  }
  deobfuscateWithIndexInterleave(input: string, seed?: string): string {
    let result = '';
    let i = 0;
    while (i < input.length) {
      result += input[i];
      i += 1 + (result.length - 1).toString().length;
    }
    return result;
  }

  // 24. Adjacent Character Swap
  obfuscateBySwappingAdjacentChars(input: string, seed?: string): string {
    const chars = input.split('');
    for (let i = 0; i < chars.length - 1; i += 2) {
      [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    }
    return chars.join('');
  }
  deobfuscateBySwappingAdjacentChars(input: string, seed?: string): string {
    return this.obfuscateBySwappingAdjacentChars(input);
  }

  private shuffleArray(array: any[], seed: string) {
    let rng = this.seededRandom(seed);
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private seededRandom(seed: string) {
    let h = 1779033703, i = 0;
    for (i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    }
    h = h << 13 | h >>> 19;
    return function() {
        h = Math.imul(h ^ h >>> 16, 2246822507);
        h = Math.imul(h ^ h >>> 13, 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    }
  }
}