
const crypto = globalThis.crypto;

/**
 * DarkstarCrypt - Advanced Encryption Implementation
 * 
 * This class implements the V2 Darkstar encryption, featuring:
 * - 12-layer obfuscation pipeline (dynamic per-word)
 * - Mulberry32 deterministic PRNG
 * - AES-256-CBC encryption with PBKDF2 key derivation
 * - Self-validating checksums
 * 
 * @version 1.0.0
 */
export class DarkstarCrypt {
  ITERATIONS_V1 = 1000;
  ITERATIONS_V2 = 600000;
  KEY_SIZE = 256 / 32;
  SALT_SIZE_BYTES = 128 / 8;
  IV_SIZE_BYTES = 128 / 8;

  constructor() {
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

  // --- V2 Encrypt/Decrypt High Level ---

  /**
   * Encrypts a mnemonic phrase using the Darkstar encryption scheme.
   * 
   * @param {string} mnemonic - The mnemonic phrase to encrypt (space-separated words).
   * @param {string} password - The password for encryption.
   * @returns {Promise<{encryptedData: string, reverseKey: string}>} The encrypted result object.
   */
  async encrypt(mnemonic, password) {
    const words = mnemonic.split(' ');
    const obfuscatedWords = [];
    const reverseKey = [];

    const passwordBytes = this.stringToBytes(password);
    const prngFactory = this.mulberry32.bind(this);

    for (const word of words) {
      let currentWordBytes = this.stringToBytes(word);

      // Select functions
      const selectedFunctions = Array.from({ length: 12 }, (_, i) => i);
      this.shuffleArray(selectedFunctions, password + word, prngFactory);

      const wordReverseKey = [];
      const checksum = this._generateChecksum(selectedFunctions);
      const checksumStr = checksum.toString();
      const checksumBytes = this.stringToBytes(checksumStr);
      
      const combinedSeed = new Uint8Array(passwordBytes.length + checksumBytes.length);
      combinedSeed.set(passwordBytes);
      combinedSeed.set(checksumBytes, passwordBytes.length);

      for (const funcIndex of selectedFunctions) {
        const func = this.obfuscationFunctionsV2[funcIndex];
        const isSeeded = funcIndex >= 6;
        const seed = isSeeded ? combinedSeed : undefined;

        currentWordBytes = func(currentWordBytes, seed, prngFactory);
        wordReverseKey.push(funcIndex);
      }

      obfuscatedWords.push(currentWordBytes);
      reverseKey.push(wordReverseKey);
    }

    // Blob Construction
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
    }

    const binaryString = String.fromCharCode(...finalBlob); // Careful with stack size on huge blobs, but for phrases it's fine
    const base64Content = btoa(binaryString);

    const encryptedContent = await this.encryptAES256Async(base64Content, password, this.ITERATIONS_V2);

    const resultObj = {
      v: 2,
      data: encryptedContent,
    };

    const reverseKeyString = JSON.stringify(reverseKey);
    const encodedReverseKey = btoa(reverseKeyString);

    return { encryptedData: JSON.stringify(resultObj), reverseKey: encodedReverseKey };
  }

  /**
   * Decrypts the encrypted data back to the original mnemonic.
   * 
   * @param {string} encryptedDataRaw - The JSON string containing the encrypted data object.
   * @param {string} reverseKeyB64 - The Base64 encoded reverse key.
   * @param {string} password - The password used for encryption.
   * @returns {Promise<string>} The decrypted mnemonic phrase.
   */
  async decrypt(encryptedDataRaw, reverseKeyB64, password) {
    let iterations = this.ITERATIONS_V2;
    let encryptedContent = encryptedDataRaw;
    
    // Check V2
    try {
        if (encryptedDataRaw.trim().startsWith('{')) {
            const parsed = JSON.parse(encryptedDataRaw);
            if (parsed.v === 2 && parsed.data) {
                encryptedContent = parsed.data;
            }
        }
    } catch (e) {}

    // Decrypt AES
    const decryptedObfuscatedString = await this.decryptAES256Async(encryptedContent, password, iterations);
    if (!decryptedObfuscatedString) throw new Error("Decryption failed");

    // Decrypt V2 Blob
    const binaryString = atob(decryptedObfuscatedString);
    const fullBlob = new Uint8Array(binaryString.length);
    for(let i=0; i<binaryString.length; i++) fullBlob[i] = binaryString.charCodeAt(i);

    // Decode Reverse Key
    const reverseKeyString = atob(reverseKeyB64);
    const reverseKeyJson = JSON.parse(reverseKeyString);

    const deobfuscatedWords = [];
    const passwordBytes = this.stringToBytes(password);
    const prngFactory = this.mulberry32.bind(this);

    let offset = 0;
    let wordIndex = 0;

    while (offset < fullBlob.length) {
        if (wordIndex >= reverseKeyJson.length) break;

        const len = (fullBlob[offset] << 8) | fullBlob[offset + 1];
        offset += 2;

        let currentWordBytes = fullBlob.slice(offset, offset + len);
        offset += len;

        const wordReverseKey = reverseKeyJson[wordIndex];

        const checksum = this._generateChecksum(wordReverseKey);
        const checksumStr = checksum.toString();
        const checksumBytes = this.stringToBytes(checksumStr);
        const combinedSeed = new Uint8Array(passwordBytes.length + checksumBytes.length);
        combinedSeed.set(passwordBytes);
        combinedSeed.set(checksumBytes, passwordBytes.length);

        for (let j = wordReverseKey.length - 1; j >= 0; j--) {
            const funcIndex = wordReverseKey[j];
            const func = this.deobfuscationFunctionsV2[funcIndex];
            const isSeeded = funcIndex >= 6;
            const seed = isSeeded ? combinedSeed : undefined;

            currentWordBytes = func(currentWordBytes, seed, prngFactory);
        }

        deobfuscatedWords.push(this.bytesToString(currentWordBytes));
        wordIndex++;
    }

    return deobfuscatedWords.join(' ');
  }

  // --- AES Async (Using WebCrypto) ---

  async encryptAES256Async(data, password, iterations) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_SIZE_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_SIZE_BYTES));

    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-CBC', length: 256 },
      false,
      ['encrypt'],
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-CBC', iv: iv },
      key,
      enc.encode(data),
    );

    const saltHex = this.buf2hex(salt);
    const ivHex = this.buf2hex(iv);
    const ciphertextBase64 = this.buf2base64(encrypted);
    
    return saltHex + ivHex + ciphertextBase64;
  }

  async decryptAES256Async(transitmessage, password, iterations) {
    try {
      const saltHex = transitmessage.substr(0, 32);
      const ivHex = transitmessage.substr(32, 32);
      const encryptedBase64 = transitmessage.substring(64);

      const salt = this.hex2buf(saltHex);
      const iv = this.hex2buf(ivHex);
      const encryptedBytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-CBC', length: 256 },
        false,
        ['decrypt'],
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: iv },
        key,
        encryptedBytes,
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Async Decryption failed:', error);
      return '';
    }
  }

  // --- Helpers ---
  buf2hex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  hex2buf(hex) {
    return new Uint8Array(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  }

  buf2base64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  stringToBytes(str) {
    return new TextEncoder().encode(str);
  }

  bytesToString(bytes) {
    return new TextDecoder().decode(bytes);
  }

  _generateChecksum(numbers) {
      if (!numbers || numbers.length === 0) return 0;
      const sum = numbers.reduce((acc, curr) => acc + curr, 0);
      return sum % 997;
  }

  // --- Obfuscation V2 ---
  
  obfuscateByReversingV2(input) { return input.reverse(); }
  deobfuscateByReversingV2(input) { return input.reverse(); }

  obfuscateWithAtbashCipherV2(input) {
    const output = new Uint8Array(input.length);
    for(let i=0; i<input.length; i++) {
        const code = input[i];
        if (code >= 65 && code <= 90) output[i] = 90 - (code - 65);
        else if (code >= 97 && code <= 122) output[i] = 122 - (code - 97);
        else output[i] = code;
    }
    return output;
  }
  deobfuscateWithAtbashCipherV2(input) { return this.obfuscateWithAtbashCipherV2(input); }

  obfuscateToCharCodesV2(input) {
    const parts = [];
    for(let i=0; i<input.length; i++) {
        if(i>0) parts.push(44);
        const strVal = input[i].toString();
        for(let j=0; j<strVal.length; j++) parts.push(strVal.charCodeAt(j));
    }
    return new Uint8Array(parts);
  }
  deobfuscateFromCharCodesV2(input) {
    const output = [];
    let currentNumStr = '';
    for(const byte of input) {
        if(byte === 44) {
            if(currentNumStr) {
                output.push(parseInt(currentNumStr, 10));
                currentNumStr = '';
            }
        } else {
            currentNumStr += String.fromCharCode(byte);
        }
    }
    if(currentNumStr) output.push(parseInt(currentNumStr, 10));
    return new Uint8Array(output);
  }

  obfuscateToBinaryV2(input) {
    const parts = [];
    for(let i=0; i<input.length; i++) {
        if(i>0) parts.push(44);
        const val = input[i].toString(2);
        for(let j=0; j<val.length; j++) parts.push(val.charCodeAt(j));
    }
    return new Uint8Array(parts);
  }
  deobfuscateFromBinaryV2(input) {
      const output = [];
      let currentVal = '';
      for(const byte of input) {
          if(byte === 44) {
              if(currentVal) {
                  output.push(parseInt(currentVal, 2));
                  currentVal = '';
              }
          } else {
              currentVal += String.fromCharCode(byte);
          }
      }
      if(currentVal) output.push(parseInt(currentVal, 2));
      return new Uint8Array(output);
  }

  obfuscateWithCaesarCipherV2(input) {
    const output = new Uint8Array(input.length);
    for(let i=0; i<input.length; i++) {
        const code = input[i];
        if(code >= 65 && code <= 90) output[i] = ((code - 65 + 13) % 26) + 65;
        else if (code >= 97 && code <= 122) output[i] = ((code - 97 + 13) % 26) + 97;
        else output[i] = code;
    }
    return output;
  }
  deobfuscateWithCaesarCipherV2(input) { return this.obfuscateWithCaesarCipherV2(input); }

  obfuscateBySwappingAdjacentBytesV2(input) {
    const output = new Uint8Array(input);
    for(let i=0; i<output.length-1; i+=2) {
        [output[i], output[i+1]] = [output[i+1], output[i]];
    }
    return output;
  }
  deobfuscateBySwappingAdjacentBytesV2(input) { return this.obfuscateBySwappingAdjacentBytesV2(input); }

  // Seeded

  obfuscateByShufflingV2(input, seed, prngFactory) {
    const a = new Uint8Array(input);
    const n = a.length;
    const seedStr = this.bytesToString(seed);
    const rng = prngFactory(seedStr);
    for(let i=n-1; i>0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  deobfuscateByShufflingV2(input, seed, prngFactory) {
      const a = new Uint8Array(input);
      const n = a.length;
      const indices = Array.from({length: n}, (_, i) => i);
      const seedStr = this.bytesToString(seed);
      const rng = prngFactory(seedStr);
      for(let i=n-1; i>0; i--) {
          const j = Math.floor(rng() * (i+1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const unshuffled = new Uint8Array(n);
      for(let i=0; i<n; i++) unshuffled[indices[i]] = a[i];
      return unshuffled;
  }

  obfuscateWithXORV2(input, seed) {
    const output = new Uint8Array(input.length);
    for(let i=0; i<input.length; i++) output[i] = input[i] ^ seed[i % seed.length];
    return output;
  }
  deobfuscateWithXORV2(input, seed) { return this.obfuscateWithXORV2(input, seed); }

  obfuscateByInterleavingV2(input, seed, prngFactory) {
      const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const seedStr = this.bytesToString(seed);
      const rng = prngFactory(seedStr);
      const output = new Uint8Array(input.length * 2);
      for(let i=0; i<input.length; i++) {
          output[i*2] = input[i];
          const randIdx = Math.floor(rng() * randomChars.length);
          output[i*2+1] = randomChars.charCodeAt(randIdx);
      }
      return output;
  }
  deobfuscateByDeinterleavingV2(input) {
      const output = new Uint8Array(input.length/2);
      for(let i=0; i<input.length; i+=2) output[i/2] = input[i];
      return output;
  }

  obfuscateWithVigenereCipherV2(input, seed) {
      const parts = [];
      for(let i=0; i<input.length; i++) {
          if(i>0) parts.push(44);
          const val = (input[i] + seed[i % seed.length]).toString();
          for(let k=0; k<val.length; k++) parts.push(val.charCodeAt(k));
      }
      return new Uint8Array(parts);
  }
  deobfuscateWithVigenereCipherV2(input, seed) {
      const output = [];
      let currentValStr = '';
      let byteIndex = 0;
      for(const byte of input) {
          if(byte === 44) {
              if(currentValStr) {
                  const val = parseInt(currentValStr, 10);
                  const keyCode = seed[byteIndex % seed.length];
                  output.push(val - keyCode);
                  byteIndex++;
                  currentValStr = '';
              }
          } else {
              currentValStr += String.fromCharCode(byte);
          }
      }
      if(currentValStr) {
        const val = parseInt(currentValStr, 10);
        const keyCode = seed[byteIndex % seed.length];
        output.push(val - keyCode);
      }
      return new Uint8Array(output);
  }

  obfuscateWithSeededBlockReversalV2(input, seed, prngFactory) {
      const seedStr = this.bytesToString(seed);
      const rng = prngFactory(seedStr);
      const blockSize = Math.floor(rng() * (input.length / 2)) + 2;
      const output = [];
      for(let i=0; i<input.length; i+=blockSize) {
        const chunk = input.slice(i, i+blockSize).reverse();
        chunk.forEach(b => output.push(b));
      }
      return new Uint8Array(output);
  }
  deobfuscateWithSeededBlockReversalV2(input, seed, prngFactory) { return this.obfuscateWithSeededBlockReversalV2(input, seed, prngFactory); }

  obfuscateWithSeededSubstitutionV2(input, seed, prngFactory) {
      const chars = Array.from({length: 256}, (_, i) => i);
      const seedStr = this.bytesToString(seed);
      const rng = prngFactory(seedStr);
      for(let i=255; i>0; i--) {
          const j = Math.floor(rng() * (i+1));
          [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      const output = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) output[i] = chars[input[i]];
      return output;
  }
  deobfuscateWithSeededSubstitutionV2(input, seed, prngFactory) {
      const chars = Array.from({length: 256}, (_, i) => i);
      const seedStr = this.bytesToString(seed);
      const rng = prngFactory(seedStr);
      for(let i=255; i>0; i--) {
          const j = Math.floor(rng() * (i+1));
          [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      const unsubMap = new Uint8Array(256);
      for(let i=0; i<256; i++) unsubMap[chars[i]] = i;
      const output = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) output[i] = unsubMap[input[i]];
      return output;
  }

  // --- PRNG ---
  
  shuffleArray(array, seed, prngFactory) {
    const rng = prngFactory(seed);
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  mulberry32(seed) {
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

// --- CLI Support ---

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

if (isMain) {
    const args = process.argv.slice(2);
    const command = args[0];
    const crypt = new DarkstarCrypt();

    if (command === 'encrypt') {
        const mnemonic = args[1];
        const password = args[2];
        crypt.encrypt(mnemonic, password).then(res => {
            console.log(JSON.stringify(res));
        }).catch(err => {
            console.error(err);
            process.exit(1);
        });
    } else if (command === 'decrypt') {
        const data = args[1];
        const rk = args[2];
        const password = args[3];
        crypt.decrypt(data, rk, password).then(res => {
            console.log(res);
        }).catch(err => {
            console.error(err);
            process.exit(1);
        });
    } else if (command === 'test') {
        const mnemonic = "cat dog fish bird";
        const password = "MySecre!Password123";
        crypt.encrypt(mnemonic, password).then(res => {
            return crypt.decrypt(res.encryptedData, res.reverseKey, password);
        }).then(decrypted => {
            if (decrypted === "cat dog fish bird") {
                console.log("Test Passed!");
            } else {
                console.error("Test Failed!");
                process.exit(1);
            }
        });
    } else {
        console.log("Usage: node darkstar_crypt.js <encrypt|decrypt|test> ...");
    }
}
