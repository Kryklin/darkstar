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

  // --- String Obfuscation/Deobfuscation Functions ---

  public deobfuscationFunctions: ((input: string, seed?: string) => string)[];

  constructor() {
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
  obfuscateByReversing(input: string): string {
    return input.split('').reverse().join('');
  }
  deobfuscateByReversing(input: string): string {
    return input.split('').reverse().join('');
  }

  // 2. Character Code
  obfuscateToCharCodes(input: string): string {
    return input.split('').map(char => char.charCodeAt(0)).join(' ');
  }
  deobfuscateFromCharCodes(input: string): string {
    return input.split(' ').map(code => String.fromCharCode(parseInt(code, 10))).join('');
  }

  // 3. Binary
  obfuscateToBinary(input: string): string {
    return input.split('').map(char => char.charCodeAt(0).toString(2)).join(' ');
  }
  deobfuscateFromBinary(input: string): string {
    return input.split(' ').map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
  }

  // 4. Hexadecimal
  obfuscateToHex(input: string): string {
    return input.split('').map(char => char.charCodeAt(0).toString(16)).join(' ');
  }
  deobfuscateFromHex(input: string): string {
    return input.split(' ').map(hex => String.fromCharCode(parseInt(hex, 16))).join('');
  }

  // 5. Caesar Cipher (ROT13)
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

  // 6. Atbash Cipher
  obfuscateWithAtbashCipher(input: string): string {
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
  deobfuscateWithAtbashCipher(input: string): string {
    return this.obfuscateWithAtbashCipher(input);
  }

  // 7. Leet (1337) Speak
  obfuscateToLeet(input: string): string {
    const leetMap: { [key: string]: string } = {
      'a': '4', 'e': '3', 'g': '6', 'i': '1', 'o': '0', 's': '5', 't': '7',
      'A': '4', 'E': '3', 'G': '6', 'I': '1', 'O': '0', 'S': '5', 'T': '7'
    };
    return input.split('').map(char => leetMap[char] || char).join('');
  }
  deobfuscateFromLeet(input: string): string {
    const unLeetMap: { [key: string]: string } = {
      '4': 'a', '3': 'e', '6': 'g', '1': 'i', '0': 'o', '5': 's', '7': 't'
    };
    return input.split('').map(char => unLeetMap[char.toLowerCase()] || char).join('');
  }

  // 8. Interleave
  obfuscateByInterleaving(input: string): string {
    const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (const char of input) {
      const randomChar = randomChars.charAt(Math.floor(Math.random() * randomChars.length));
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

  // 9. Caesar Cipher (ROT7)
  obfuscateWithCaesarCipher7(input: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const base = code < 91 ? 65 : 97;
      return String.fromCharCode(((code - base + 7) % 26) + base);
    });
  }
  deobfuscateWithCaesarCipher7(input: string): string {
    return input.replace(/[a-zA-Z]/g, (c) => {
      const code = c.charCodeAt(0);
      const base = code < 91 ? 65 : 97;
      return String.fromCharCode(((code - base - 7 + 26) % 26) + base);
    });
  }

  // 10. Character Shuffling
  obfuscateByShuffling(input: string, seed: string): string {
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
    let rng = this.seededRandom(seed);
    const swaps = [];

    for (let i = n - 1; i > 0; i--) {
      swaps.push(Math.floor(rng() * (i + 1)));
    }

    for (let i = 1; i < n; i++) {
      const j = swaps.pop()!;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.join('');
  }

  // 11. Custom Separator
  obfuscateWithCustomSeparator(input: string): string {
    return input.split('').join('<-|->');
  }
  deobfuscateWithCustomSeparator(input: string): string {
    return input.split('<-|->').join('');
  }

  // 12. Bitwise NOT
  obfuscateWithBitwiseNot(input: string): string {
    return input.split('').map(char => String.fromCharCode(~char.charCodeAt(0))).join('');
  }
  deobfuscateWithBitwiseNot(input: string): string {
    return input.split('').map(char => String.fromCharCode(~char.charCodeAt(0))).join('');
  }

  // 13. ASCII Value Shift
  obfuscateWithAsciiShift(input: string, shift = 5): string {
    return input.split('').map(char => String.fromCharCode(char.charCodeAt(0) + shift)).join('');
  }
  deobfuscateWithAsciiShift(input: string, seed?: string): string {
    const shift = seed ? parseInt(seed, 10) : 5;
    return input.split('').map(char => String.fromCharCode(char.charCodeAt(0) - shift)).join('');
  }

  // 14. XOR Obfuscation
  obfuscateWithXOR(input: string, key: string): string {
    return input.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
  }
  deobfuscateWithXOR(input: string, key: string): string {
    return this.obfuscateWithXOR(input, key);
  }

  // 15. Morse Code
  obfuscateToMorseCode(input: string): string {
    const morseMap: { [key: string]: string } = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....',
        'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.',
        'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
        '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----', ' ': '/'
    };
    return input.toUpperCase().split('').map(char => morseMap[char] || '').join(' ');
  }
  deobfuscateFromMorseCode(input: string): string {
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
  obfuscateWithKeyboardShift(input: string): string {
    const qwerty = "qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";
    return input.split('').map(char => {
      const index = qwerty.indexOf(char.toLowerCase());
      return index !== -1 && index < qwerty.length - 1 ? qwerty[index + 1] : char;
    }).join('');
  }
  deobfuscateWithKeyboardShift(input: string): string {
    const qwerty = "qwertyuiop[]\\asdfghjkl;'zxcvbnm,./";
    return input.split('').map(char => {
      const index = qwerty.indexOf(char.toLowerCase());
      return index > 0 ? qwerty[index - 1] : char;
    }).join('');
  }

  // 17. HTML Entities
  obfuscateToHtmlEntities(input: string): string {
    return input.split('').map(char => `&#${char.charCodeAt(0)};`).join('');
  }
  deobfuscateFromHtmlEntities(input: string): string {
    return input.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  }

  // 18. Octal
  obfuscateToOctal(input: string): string {
    return input.split('').map(char => '\\' + char.charCodeAt(0).toString(8)).join('');
  }
  deobfuscateFromOctal(input: string): string {
    return input.split('\\').slice(1).map(oct => String.fromCharCode(parseInt(oct, 8))).join('');
  }

  // 19. Nibble Swap
  obfuscateWithNibbleSwap(input: string): string {
    return input.split('').map(char => {
      const hex = char.charCodeAt(0).toString(16).padStart(2, '0');
      return String.fromCharCode(parseInt(hex[1] + hex[0], 16));
    }).join('');
  }
  deobfuscateWithNibbleSwap(input: string): string {
    return this.obfuscateWithNibbleSwap(input);
  }

  // 20. Vowel Rotation
  obfuscateWithVowelRotation(input: string): string {
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
  deobfuscateWithVowelRotation(input: string): string {
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
  obfuscateWithIndexMath(input: string): string {
    return input.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) + i)).join('');
  }
  deobfuscateWithIndexMath(input: string): string {
    return input.split('').map((char, i) => String.fromCharCode(char.charCodeAt(0) - i)).join('');
  }

  // 22. Mirror Case
  obfuscateWithMirrorCase(input: string): string {
    return input.split('').map(char => {
      if (char === char.toUpperCase()) {
        return char.toLowerCase();
      }
      return char.toUpperCase();
    }).join('');
  }
  deobfuscateWithMirrorCase(input: string): string {
    return this.obfuscateWithMirrorCase(input);
  }

  // 23. Interleave with Index
  obfuscateWithIndexInterleave(input: string): string {
    return input.split('').map((char, i) => char + i).join('');
  }
  deobfuscateWithIndexInterleave(input: string): string {
    let result = '';
    let i = 0;
    while (i < input.length) {
      result += input[i];
      i += 1 + (result.length - 1).toString().length;
    }
    return result;
  }

  // 24. Adjacent Character Swap
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

  private seededRandom(seed: string) {
    let h = 1779033703, i = 0, k;
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