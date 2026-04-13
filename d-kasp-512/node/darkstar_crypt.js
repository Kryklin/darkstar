import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const crypto = globalThis.crypto || require('node:crypto').webcrypto;
const { ml_kem1024: kyber } = require('@noble/post-quantum/ml-kem.js');

/**
 * DarkstarCrypt - Advanced Encryption Implementation (d-kasp-512)
 *
 * This class implements the d-kasp-512 encryption scheme, featuring:
 * - D: Darkstar ecosystem origin
 * - K: Kyber-1024 (ML-KEM-1024) Root of Trust
 * - A: Augmented 64-layer SPN/ARX gauntlet
 * - S: Sequential word-based path-logic
 * - P: Permutation-based non-linear core
 * - 1024: Post-quantum security bits
 *
 * @version 1.1.0
 */
export class DarkstarCrypt {
  ITERATIONS_V1 = 1000;
  ITERATIONS_V2 = 600000;
  KEY_SIZE = 256 / 8; // 32 bytes (256 bits)
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

    this.SBOX = new Uint8Array([
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
      0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
      0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
      0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
      0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
      0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
      0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
      0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
      0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
      0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
      0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
      0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
      0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
    ]);

    this.INV_SBOX = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
        this.INV_SBOX[this.SBOX[i]] = i;
    }

    this.obfuscationFunctionsV4 = [
      this.obfuscateWithSBoxV4.bind(this),
      this.obfuscateWithModMultV4.bind(this),
      this.obfuscateWithPBoxV4.bind(this),
      this.obfuscateWithCyclicRotationV4.bind(this),
      this.obfuscateWithKeyedXORV4.bind(this),
      this.obfuscateWithFeistelV4.bind(this),
      this.obfuscateWithModAdditionV4.bind(this),
      this.obfuscateWithMatrixHillV4.bind(this),
      this.obfuscateWithGaloisMultV4.bind(this),
      this.obfuscateWithBitFlipMaskingV4.bind(this),
      this.obfuscateWithColumnarShuffleV4.bind(this),
      this.obfuscateWithRecursiveXORV4.bind(this),
    ];

    this.deobfuscationFunctionsV4 = [
      this.deobfuscateWithSBoxV4.bind(this),
      this.deobfuscateWithModMultV4.bind(this),
      this.deobfuscateWithPBoxV4.bind(this),
      this.deobfuscateWithCyclicRotationV4.bind(this),
      this.deobfuscateWithKeyedXORV4.bind(this),
      this.deobfuscateWithFeistelV4.bind(this),
      this.deobfuscateWithModAdditionV4.bind(this),
      this.deobfuscateWithMatrixHillV4.bind(this),
      this.deobfuscateWithGaloisMultV4.bind(this),
      this.deobfuscateWithBitFlipMaskingV4.bind(this),
      this.deobfuscateWithColumnarShuffleV4.bind(this),
      this.deobfuscateWithRecursiveXORV4.bind(this),
    ];

    // V8 SPNA Groups
    this.groupS = [0, 1, 5]; // S-Box, ModMult, Feistel
    this.groupP = [2, 3, 10]; // P-Box, Cyclic, Columnar
    this.groupN = [7, 8, 11]; // Hill, Galois, Recursive
    this.groupA = [4, 6, 9]; // KeyedXOR, ModAdd, Masking
  }

  // --- Cryptographic Helpers ---

  /** HMAC-SHA256: returns 32-byte Uint8Array */
  async hmacSha256Bytes(keyBytes, dataStr) {
    const keyObj = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', keyObj, new TextEncoder().encode(dataStr));
    return new Uint8Array(sig);
  }

  /** SHA-256: returns 32-byte Uint8Array */
  async sha256Bytes(data) {
    const buf = (typeof data === 'string') ? new TextEncoder().encode(data) : data;
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  }

  /** SHA-256: returns hex string */
  async sha256Hex(data) {
    const bytes = await this.sha256Bytes(data);
    return this.buf2hex(bytes);
  }

  // --- V2 Encrypt/Decrypt High Level ---

  /**
   * Encrypts a mnemonic phrase using the Darkstar encryption scheme.
   *
   * @param {string} mnemonic - The mnemonic phrase to encrypt (space-separated words).
   * @param {string} keyMaterial - The password (V1-V4) OR Kyber-1024 Public Key Hex (V5).
   * @returns {Promise<{encryptedData: string, reverseKey: string}>} The encrypted result object.
   */
  async encrypt(mnemonic, keyMaterial, v = 6) {
    const isV5 = v >= 5;
    const isV4 = v === 4;
    const isModern = v >= 3;

    let activePasswordStr = keyMaterial;
    let ctHex = '';

    const obfuscatedWords = [];
    const reverseKey = [];

    let v7HmacKey = null;

    if (isV5) {
        const pkBytes = this.hex2buf(keyMaterial);
        const encap = kyber.encapsulate(pkBytes);
        ctHex = this.buf2hex(encap.cipherText);
        const ss_bytes = encap.sharedSecret; // Uint8Array
        
        if (v >= 7) {
            // V7 Key Derivation
            const cipherKey = await this.sha256Bytes(Buffer.concat([Buffer.from("dkasp-v7-cipher-key"), ss_bytes]));
            const hmacKey = await this.sha256Bytes(Buffer.concat([Buffer.from("dkasp-v7-hmac-key"), ss_bytes]));
            activePasswordStr = this.buf2hex(cipherKey);
            v7HmacKey = hmacKey;
        } else {
            activePasswordStr = this.buf2hex(ss_bytes);
        }
        ss_bytes.fill(0); // Zeroized
    }

    // V6+: Stop splitting by space. Treat as one binary stream.
    const words = (v >= 6) ? [mnemonic] : mnemonic.split(' ');
    
    // PRNG Selection
    const prngFactory = isModern ? this.darkstar_chacha_prng.bind(this) : this.mulberry32.bind(this);

    // Fix 2: Chain state init (V6 only)
    let chainState = v >= 6 ? await this.sha256Bytes("dkasp-chain-v6" + activePasswordStr) : null;

    for (let index = 0; index < words.length; index++) {
      const word = words[index];
      let currentWordBytes = this.stringToBytes(word);

      if (v >= 6) {
        // Fix 1: HMAC-SHA256 key schedule — derive per-word subkey
        const wordKey = await this.hmacSha256Bytes(
          new TextEncoder().encode(activePasswordStr),
          `dkasp-v6-word-${index}`
        );
        const wordKeyHex = this.buf2hex(wordKey);

        // Fix 2: XOR word bytes with chain state before gauntlet
        for (let i = 0; i < currentWordBytes.length; i++) {
          currentWordBytes[i] ^= chainState[i % 32];
        }

        // Fix 4: Generate path with degeneration prevention
        const depthHashBytes = await this.sha256Bytes(wordKeyHex);
        const depthVal = (depthHashBytes[0] << 8) | depthHashBytes[1];
        const cycleDepth = 12 + (depthVal % 501);

        const rngPath = prngFactory(wordKeyHex);
        const path = [];
        const lastThree = [99, 99, 99];
        for (let i = 0; i < cycleDepth; i++) {
          let fi = rngPath() % 12;
          if (lastThree[0] === fi && lastThree[1] === fi && lastThree[2] === fi) {
            fi = (fi + 1 + (rngPath() % 11)) % 12;
          }
          lastThree[0] = lastThree[1]; lastThree[1] = lastThree[2]; lastThree[2] = fi;
          path.push(fi);
        }

        // Fix 4b: Ensure min 6 distinct in first 12 slots
        {
          const first12 = path.slice(0, 12);
          const distinct = new Set(first12);
          if (distinct.size < 6) {
            const missing = Array.from({ length: 12 }, (_, i) => i).filter(x => !distinct.has(x));
            let mi = 0;
            for (let i = 0; i < 12 && mi < missing.length; i++) {
              const count = first12.filter(x => x === path[i]).length;
              if (count > 2) { path[i] = missing[mi++]; }
            }
          }
        }

        // Fix 1: Derive func key via HMAC
        const checksum = this._generateChecksum(Array.from({ length: 12 }, (_, i) => i));
        const funcKey = await this.hmacSha256Bytes(wordKey, `keyed-${checksum}`);
        const combinedSeed = funcKey;

        if (v >= 8) {
          // V8: SPNA Structured Gauntlet (16 Rounds = 64 Layers)
          const rngPath = prngFactory(wordKeyHex);
          for (let i = 0; i < 16; i++) {
            // S: Substitution (Forced S-Box or ModMult every 4 rounds)
            let sIdx;
            if (i % 4 === 0) {
              sIdx = 0;
            } else if (i % 4 === 2) {
              sIdx = 1;
            } else {
              sIdx = this.groupS[rngPath() % this.groupS.length];
            }
            currentWordBytes = this.obfuscationFunctionsV4[sIdx](currentWordBytes, combinedSeed, prngFactory);
            
            // P: Permutation (Always randomized)
            const pIdx = this.groupP[rngPath() % this.groupP.length];
            currentWordBytes = this.obfuscationFunctionsV4[pIdx](currentWordBytes, combinedSeed, prngFactory);
            
            // N: Network (Forced GFMult or MatrixHill every 4 rounds)
            let nIdx;
            if (i % 4 === 1) {
              nIdx = 8;
            } else if (i % 4 === 3) {
              nIdx = 7;
            } else {
              nIdx = this.groupN[rngPath() % this.groupN.length];
            }
            currentWordBytes = this.obfuscationFunctionsV4[nIdx](currentWordBytes, combinedSeed, prngFactory);
            
            // A: Algebraic/AddKey (Always randomized)
            const aIdx = this.groupA[rngPath() % this.groupA.length];
            currentWordBytes = this.obfuscationFunctionsV4[aIdx](currentWordBytes, combinedSeed, prngFactory);
          }
        } else {
          for (const funcIndex of path) {
            const isSeeded = [4, 5, 6, 9].includes(funcIndex);
            const func = this.obfuscationFunctionsV4[funcIndex];
            const seed = isSeeded ? combinedSeed : undefined;
            currentWordBytes = func(currentWordBytes, seed, prngFactory);
          }
        }

        // Fix 2: Update chain state from obfuscated bytes
        const chainInput = new Uint8Array(32 + currentWordBytes.length);
        chainInput.set(chainState, 0);
        chainInput.set(currentWordBytes, 32);
        chainState = await this.sha256Bytes(chainInput);

      } else {
        // Legacy V2-V5 path (unchanged)
        const selectedFunctions = Array.from({ length: 12 }, (_, i) => i);
        const deterministicSeed = activePasswordStr + word + (v >= 5 ? index : "");
        this.shuffleArray(selectedFunctions, deterministicSeed, prngFactory);
        let cycleDepth = selectedFunctions.length;
        if (isModern) {
          const depthHash = await this.sha256Hex(deterministicSeed);
          const depthVal = parseInt(depthHash.substring(0, 4), 16);
          cycleDepth = v >= 5 ? 12 + (depthVal % 501) : 12 + (depthVal % 53);
        }
        const wordReverseKey = [];
        const checksum = this._generateChecksum(selectedFunctions);
        const combinedSeed = this.stringToBytes(activePasswordStr + checksum.toString() + (v >= 5 ? index.toString() : ""));
        const rngPath = prngFactory(activePasswordStr + word + (v >= 5 ? index : ""));
        for (let i = 0; i < cycleDepth; i++) {
          let funcIndex = selectedFunctions[i % selectedFunctions.length];
          if (i >= 12 && !isV4 && !isV5 && [2, 3, 8, 9].includes(funcIndex)) funcIndex = (funcIndex + 2) % 12;
          const isSeeded = (isV4 || isV5) ? [4, 5, 6, 9].includes(funcIndex) : funcIndex >= 6;
          const func = (isV4 || isV5) ? this.obfuscationFunctionsV4[funcIndex] : this.obfuscationFunctionsV2[funcIndex];
          const seed = isSeeded ? combinedSeed : undefined;
          currentWordBytes = func(currentWordBytes, seed, prngFactory);
          wordReverseKey.push(funcIndex);
        }
        obfuscatedWords.push(currentWordBytes);
        reverseKey.push(wordReverseKey);
        continue;
      }

      obfuscatedWords.push(currentWordBytes);
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

    const encodedReverseKey = (v >= 6) ? "" : this.packReverseKey(reverseKey, isModern);
    const aad = (v >= 6) ? null : this.stringToBytes(encodedReverseKey);

    let finalPayload;
    if (finalBlob.length > 16384) {
      throw new Error(`Obfuscated payload exceeds 16384-byte limit (${finalBlob.length} bytes).`);
    }
    if (v >= 6) {
      // V6: encrypt exact blob — no fixed padding needed
      finalPayload = finalBlob.slice(0, offset);
    } else {
      // V1-V5: pad to fixed size to obscure word count from stored reverse key
      const paddedData = new Uint8Array(16384);
      paddedData.set(finalBlob.slice(0, offset));
      finalPayload = paddedData;
    }

    let encryptedContent;
    let macTag = "";

    if (v >= 7) {
      // V7: Post-Quantum Purity (No AES)
      encryptedContent = this.buf2hex(finalPayload);
      const macData = Buffer.concat([
        Buffer.from([v]),
        this.hex2buf(ctHex),
        finalPayload
      ]);
      const mac = require('node:crypto').createHmac('sha256', v7HmacKey).update(macData).digest();
      macTag = this.buf2hex(mac);
    } else {
      const iterations = this.ITERATIONS_V2;
      try {
        encryptedContent = await this.encryptAES256GCMAsync(finalPayload, activePasswordStr, iterations, aad);
      } catch (e) {
        throw e;
      }
    }

    const resObj = {
      v: v,
      data: encryptedContent,
      ct: ctHex,
      mac: macTag
    };

    return {
      encryptedData: resObj,
      reverseKey: encodedReverseKey
    };
  }

  /**
   * Decrypts the encrypted data back to the original mnemonic.
   *
   * @param {string|object} encryptedDataRaw - The JSON string or object containing the encrypted data.
   * @param {string} reverseKeyB64 - The Base64 encoded reverse key.
   * @param {string} keyMaterial - The password (V1-V4) OR Kyber-1024 Private Key Hex (V5).
   * @returns {Promise<string>} The decrypted mnemonic phrase.
   */
  async decrypt(encryptedDataRaw, reverseKeyB64, keyMaterial) {
    let encryptedContent = encryptedDataRaw;
    let isV3 = false;

    let isV4 = false;
    let isV5 = false;
    let detectedVersion = 1;
    let ctHex = "";

    let parsed = null;
    try {
      parsed = (typeof encryptedDataRaw === 'string') ? JSON.parse(encryptedDataRaw) : encryptedDataRaw;
      if (parsed && typeof parsed === 'object') {
        detectedVersion = parsed.v || 1;
        if (detectedVersion === 2 && parsed.data) {
          encryptedContent = parsed.data;
        } else if (detectedVersion === 3 && parsed.data) {
          encryptedContent = parsed.data;
          isV3 = true;
        } else if (detectedVersion === 4 && parsed.data) {
          encryptedContent = parsed.data;
          isV4 = true;
        } else if (detectedVersion >= 5 && parsed.data) {
          encryptedContent = parsed.data;
          isV5 = true;
          ctHex = parsed.ct;
          detectedVersion = parsed.v;
        }
      }
    } catch (e) {}

    const isModern = isV3 || isV4 || isV5 || detectedVersion >= 6;

    let activePasswordStr = keyMaterial;
    let v7HmacKey = null;
    if (isV5) {
      const skBytes = this.hex2buf(keyMaterial);
      const ctBytes = this.hex2buf(ctHex);
      const ss_bytes = kyber.decapsulate(ctBytes, skBytes);
      
      if (detectedVersion >= 7) {
          const cipherKey = await this.sha256Bytes(Buffer.concat([Buffer.from("dkasp-v7-cipher-key"), ss_bytes]));
          const hmacKey = await this.sha256Bytes(Buffer.concat([Buffer.from("dkasp-v7-hmac-key"), ss_bytes]));
          activePasswordStr = this.buf2hex(cipherKey);
          v7HmacKey = hmacKey;
      } else {
          activePasswordStr = this.buf2hex(ss_bytes);
      }
      ss_bytes.fill(0); // Zeroized
    }


    let iterations = this.ITERATIONS_V2;
    const aad = (isV5 && detectedVersion < 6) ? this.stringToBytes(reverseKeyB64) : null;

    // Decrypt Primary layer (AES or HMAC-V7)
    let fullBlob;
    if (detectedVersion >= 7) {
      // V7: Verify HMAC and bypass AES
      const payloadBytes = this.hex2buf(encryptedContent);
      const macData = Buffer.concat([
        Buffer.from([detectedVersion]),
        this.hex2buf(ctHex),
        payloadBytes
      ]);
      const mac = require('node:crypto').createHmac('sha256', v7HmacKey).update(macData).digest();
      const expectedMac = this.hex2buf(parsed.mac || "");
      
      // Constant-time comparison
      if (mac.length !== expectedMac.length || !require('node:crypto').timingSafeEqual(mac, expectedMac)) {
          throw new Error("D-KASP V7: Integrity Check Failed (MAC mismatch)");
      }
      fullBlob = payloadBytes;
    } else {
      try {
        if (isModern) {
          const decrypted = await this.decryptAES256GCMAsync(encryptedContent, activePasswordStr, iterations, aad);
          if (isV5) {
              fullBlob = decrypted; // Uint8Array
          } else {
              // Legacy V3/V4: decrypted data is a base64 string
              const b64 = new TextDecoder().decode(decrypted);
              fullBlob = this.base64ToBuf(b64);
          }
        } else {
          const decryptedString = await this.decryptAES256Async(encryptedContent, activePasswordStr, iterations);
          if (!decryptedString) throw new Error('Decryption failed');
          // Legacy V1/V2: decrypted data is a base64 string
          fullBlob = this.base64ToBuf(decryptedString);
        }
      } catch (e) {
        throw e;
      }
    }


    // Decode Reverse Key
    let reverseKeyJson;
    const isActuallyModern = isModern;
    try {
      // Try to detect Legacy/V2 JSON key format
      const reversedKeyString = atob(reverseKeyB64 || "");
      if (reversedKeyString.trim().startsWith('[')) {
        reverseKeyJson = JSON.parse(reversedKeyString);
      } else {
        reverseKeyJson = this.unpackReverseKey(reverseKeyB64 || "", isActuallyModern);
      }
    } catch (e) {
      // Fallback
      reverseKeyJson = this.unpackReverseKey(reverseKeyB64 || "", isActuallyModern);
    }

    const deobfuscatedWords = [];
    const prngFactory = isModern ? this.darkstar_chacha_prng.bind(this) : this.mulberry32.bind(this);

    // Fix 2: Init chain state for V6 decrypt (must match encrypt)
    let v6ChainState = (detectedVersion >= 6) ? await this.sha256Bytes("dkasp-chain-v6" + activePasswordStr) : null;

    let offset = 0;
    let wordIndex = 0;

    while (offset < fullBlob.length) {
      // V6+: No reverseKeyJson required. Path is regenerated.
      if (detectedVersion < 6 && wordIndex >= reverseKeyJson.length) break;

      if (offset + 2 > fullBlob.length) break;
      const len = (fullBlob[offset] << 8) | fullBlob[offset + 1];
      offset += 2;
      if (offset + len > fullBlob.length) break;

      const cipherWordBytes = fullBlob.slice(offset, offset + len);
      let currentWordBytes = new Uint8Array(cipherWordBytes);
      offset += len;

      if (detectedVersion >= 6) {
        // Fix 1: HMAC key schedule
        const wordKey = await this.hmacSha256Bytes(
          new TextEncoder().encode(activePasswordStr),
          `dkasp-v6-word-${wordIndex}`
        );
        const wordKeyHex = this.buf2hex(wordKey);

        // Fix 4: Regenerate sanitised path (identical to encrypt)
        const depthHashBytes = await this.sha256Bytes(wordKeyHex);
        const depthVal = (depthHashBytes[0] << 8) | depthHashBytes[1];
        const cycleDepth = 12 + (depthVal % 501);

        const rngPath = prngFactory(wordKeyHex);
        const path = [];
        const lastThree = [99, 99, 99];
        for (let i = 0; i < cycleDepth; i++) {
          let fi = rngPath() % 12;
          if (lastThree[0] === fi && lastThree[1] === fi && lastThree[2] === fi) {
            fi = (fi + 1 + (rngPath() % 11)) % 12;
          }
          lastThree[0] = lastThree[1]; lastThree[1] = lastThree[2]; lastThree[2] = fi;
          path.push(fi);
        }
        // Fix 4b: Enforce min 6 distinct in first 12
        {
          const first12 = path.slice(0, 12);
          const distinct = new Set(first12);
          if (distinct.size < 6) {
            const missing = Array.from({ length: 12 }, (_, i) => i).filter(x => !distinct.has(x));
            let mi = 0;
            for (let i = 0; i < 12 && mi < missing.length; i++) {
              if (first12.filter(x => x === path[i]).length > 2) { path[i] = missing[mi++]; }
            }
          }
        }

        // Fix 1: Derive func key via HMAC
        const checksum = this._generateChecksum(Array.from({ length: 12 }, (_, i) => i));
        const funcKey = await this.hmacSha256Bytes(wordKey, `keyed-${checksum}`);
        const combinedSeed = funcKey;

        if (detectedVersion >= 8) {
          // V8: Inverse SPNA Structured Gauntlet
          const rngPath = prngFactory(wordKeyHex);
          const roundPaths = [];
          for (let i = 0; i < 16; i++) {
            let s, p, n, a;
            // S
            if (i % 4 === 0) s = 0;
            else if (i % 4 === 2) s = 1;
            else s = this.groupS[rngPath() % this.groupS.length];
            // P
            p = this.groupP[rngPath() % this.groupP.length];
            // N
            if (i % 4 === 1) n = 8;
            else if (i % 4 === 3) n = 7;
            else n = this.groupN[rngPath() % this.groupN.length];
            // A
            a = this.groupA[rngPath() % this.groupA.length];

            roundPaths.push({ s, p, n, a });
          }
          
          for (let j = 15; j >= 0; j--) {
            const r = roundPaths[j];
            // Inverse Order: A -> N -> P -> S
            currentWordBytes = this.deobfuscationFunctionsV4[r.a](currentWordBytes, combinedSeed, prngFactory);
            currentWordBytes = this.deobfuscationFunctionsV4[r.n](currentWordBytes, combinedSeed, prngFactory);
            currentWordBytes = this.deobfuscationFunctionsV4[r.p](currentWordBytes, combinedSeed, prngFactory);
            currentWordBytes = this.deobfuscationFunctionsV4[r.s](currentWordBytes, combinedSeed, prngFactory);
          }
        } else {
          // Apply inverse transforms in reverse
          for (let j = path.length - 1; j >= 0; j--) {
            const funcIndex = path[j];
            const isSeeded = [4, 5, 6, 9].includes(funcIndex);
            const func = this.deobfuscationFunctionsV4[funcIndex];
            const seed = isSeeded ? combinedSeed : undefined;
            currentWordBytes = func(currentWordBytes, seed, prngFactory);
          }
        }

        // Fix 2: Undo chain XOR (advance chain from cipher bytes, same as encrypt)
        for (let i = 0; i < currentWordBytes.length; i++) {
          currentWordBytes[i] ^= v6ChainState[i % 32];
        }
        const chainInput = new Uint8Array(32 + cipherWordBytes.length);
        chainInput.set(v6ChainState, 0);
        chainInput.set(cipherWordBytes, 32);
        v6ChainState = await this.sha256Bytes(chainInput);

      } else {
        // Legacy V2-V5
        const wordReverseKey = reverseKeyJson[wordIndex];
        const uniqueSet = [...new Set(wordReverseKey)];
        const checksum = this._generateChecksum(uniqueSet.length === 0 ? Array.from({length:12},(_,i)=>i) : uniqueSet);
        const combinedSeed = this.stringToBytes(activePasswordStr + checksum.toString() + (detectedVersion >= 5 ? wordIndex.toString() : ""));
        for (let j = wordReverseKey.length - 1; j >= 0; j--) {
          const funcIndex = wordReverseKey[j];
          const isSeeded = (isV4 || isV5) ? [4,5,6,9].includes(funcIndex) : funcIndex >= 6;
          const func = (isV4 || isV5) ? this.deobfuscationFunctionsV4[funcIndex] : this.deobfuscationFunctionsV2[funcIndex];
          const seed = isSeeded ? combinedSeed : undefined;
          currentWordBytes = func(currentWordBytes, seed, prngFactory);
        }
      }

      deobfuscatedWords.push(this.bytesToString(currentWordBytes));
      wordIndex++;
    }


    const deobfuscatedRes = deobfuscatedWords.join(' ');
    if (isV5) activePasswordStr = "";
    return deobfuscatedRes;
  }

  // --- AES Async (Using WebCrypto) ---

  async encryptAES256Async(data, password, iterations) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_SIZE_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_SIZE_BYTES));

    const pBytes = enc.encode(password);
    const keyMaterial = await crypto.subtle.importKey('raw', pBytes, { name: 'PBKDF2' }, false, ['deriveKey']);
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
    pBytes.fill(0);

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv }, key, enc.encode(data));

    const saltHex = this.buf2hex(salt);
    const ivHex = this.buf2hex(iv);
    const ciphertextBase64 = this.buf2base64(encrypted);

    return saltHex + ivHex + ciphertextBase64;
  }

  async encryptAES256GCMAsync(data, password, iterations, aad = null) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_SIZE_BYTES));
    const iv = crypto.getRandomValues(new Uint8Array(12)); 

    const pBytes = enc.encode(password);
    const keyMaterial = await crypto.subtle.importKey('raw', pBytes, { name: 'PBKDF2' }, false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    pBytes.fill(0);

    const dataToEncrypt = (typeof data === 'string') ? enc.encode(data) : data;
    const encryptParams = { name: 'AES-GCM', iv: iv };
    if (aad) encryptParams.additionalData = aad;

    const encrypted = await crypto.subtle.encrypt(encryptParams, key, dataToEncrypt);

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
      const pBytes = enc.encode(password);
      const keyMaterial = await crypto.subtle.importKey('raw', pBytes, { name: 'PBKDF2' }, false, ['deriveKey']);

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
      pBytes.fill(0);

      const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv }, key, encryptedBytes);

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Async Decryption failed:', error);
      return '';
    }
  }

  async decryptAES256GCMAsync(transitmessage, password, iterations, aad = null) {
    try {
      const saltHex = transitmessage.substr(0, 32);
      const ivHex = transitmessage.substr(32, 24); 
      const encryptedBase64 = transitmessage.substring(56);

      const salt = this.hex2buf(saltHex);
      const iv = this.hex2buf(ivHex);
      const encryptedBytes = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

      const enc = new TextEncoder();
      const pBytes = enc.encode(password);
      const keyMaterial = await crypto.subtle.importKey('raw', pBytes, { name: 'PBKDF2' }, false, ['deriveKey']);

      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      pBytes.fill(0);

      const decryptParams = { name: 'AES-GCM', iv: iv };
      if (aad) decryptParams.additionalData = aad;

      const decrypted = await crypto.subtle.decrypt(decryptParams, key, encryptedBytes);

      return new Uint8Array(decrypted); 
    } catch (error) {
      console.error('Async GCM Decryption failed:', error);
      throw error;
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

  // --- Compression Helpers ---

  packReverseKey(reverseKey, isV3 = true) {
    const wordCount = reverseKey.length;
    let packedSize = 0;
    for (const w of reverseKey) {
        // Modern (V3+) uses 2 bytes for length header
        packedSize += (isV3 ? 2 : 0) + Math.ceil(w.length / 2);
    }
    const buffer = new Uint8Array(packedSize);

    let offset = 0;
    for (const wordKey of reverseKey) {
      if (isV3) {
          // Uint16BE length header
          const l = wordKey.length;
          buffer[offset++] = (l >> 8) & 0xff;
          buffer[offset++] = l & 0xff;
      }

      for (let i = 0; i < wordKey.length; i += 2) {
        const high = wordKey[i]; 
        const low = i + 1 < wordKey.length ? wordKey[i + 1] : 0; 
        buffer[offset++] = (high << 4) | (low & 0x0f);
      }
    }
    return this.buf2base64(buffer.slice(0, offset));
  }

  unpackReverseKey(b64, isV3 = true) {
    const buffer = this.base64ToBuf(b64);
    const reverseKey = [];

    let offset = 0;
    while (offset < buffer.length) {
      let wordKeyLength = 12; // Legacy V2 default
      if (isV3) {
          if (offset + 2 > buffer.length) break;
          // Read Uint16BE
          wordKeyLength = (buffer[offset++] << 8) | buffer[offset++];
      }
      
      const numBytesToRead = Math.ceil(wordKeyLength / 2);
      const wordKey = [];

      for (let i = 0; i < numBytesToRead; i++) {
        if (offset >= buffer.length) break;
        const byte = buffer[offset++];
        const high = (byte >> 4) & 0x0f;
        const low = byte & 0x0f;
        wordKey.push(high);
        if (wordKey.length < wordKeyLength) {
            wordKey.push(low);
        }
      }
      reverseKey.push(wordKey);
    }

    return reverseKey;
  }

  base64ToBuf(b64) {
    const bin = Buffer.from(b64, 'base64');
    return new Uint8Array(bin.buffer, bin.byteOffset, bin.length);
  }

  buf2base64(buf) {
    return Buffer.from(buf).toString('base64');
  }

  hex2buf(hex) {
    return new Uint8Array(Buffer.from(hex, 'hex'));
  }

  buf2hex(buf) {
    return Buffer.from(buf).toString('hex');
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

  obfuscateByReversingV2(input) {
    return input.reverse();
  }
  deobfuscateByReversingV2(input) {
    return input.reverse();
  }

  obfuscateWithAtbashCipherV2(input) {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const code = input[i];
      if (code >= 65 && code <= 90) output[i] = 90 - (code - 65);
      else if (code >= 97 && code <= 122) output[i] = 122 - (code - 97);
      else output[i] = code;
    }
    return output;
  }
  deobfuscateWithAtbashCipherV2(input) {
    return this.obfuscateWithAtbashCipherV2(input);
  }

  obfuscateToCharCodesV2(input) {
    const parts = [];
    for (let i = 0; i < input.length; i++) {
      if (i > 0) parts.push(44);
      const strVal = input[i].toString();
      for (let j = 0; j < strVal.length; j++) parts.push(strVal.charCodeAt(j));
    }
    return new Uint8Array(parts);
  }
  deobfuscateFromCharCodesV2(input) {
    const output = [];
    let currentNumStr = '';
    for (const byte of input) {
      if (byte === 44) {
        if (currentNumStr) {
          output.push(parseInt(currentNumStr, 10));
          currentNumStr = '';
        }
      } else {
        currentNumStr += String.fromCharCode(byte);
      }
    }
    if (currentNumStr) output.push(parseInt(currentNumStr, 10));
    return new Uint8Array(output);
  }

  obfuscateToBinaryV2(input) {
    const parts = [];
    for (let i = 0; i < input.length; i++) {
      if (i > 0) parts.push(44);
      const val = input[i].toString(2);
      for (let j = 0; j < val.length; j++) parts.push(val.charCodeAt(j));
    }
    return new Uint8Array(parts);
  }
  deobfuscateFromBinaryV2(input) {
    const output = [];
    let currentVal = '';
    for (const byte of input) {
      if (byte === 44) {
        if (currentVal) {
          output.push(parseInt(currentVal, 2));
          currentVal = '';
        }
      } else {
        currentVal += String.fromCharCode(byte);
      }
    }
    if (currentVal) output.push(parseInt(currentVal, 2));
    return new Uint8Array(output);
  }

  obfuscateWithCaesarCipherV2(input) {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const code = input[i];
      if (code >= 65 && code <= 90) output[i] = ((code - 65 + 13) % 26) + 65;
      else if (code >= 97 && code <= 122) output[i] = ((code - 97 + 13) % 26) + 97;
      else output[i] = code;
    }
    return output;
  }
  deobfuscateWithCaesarCipherV2(input) {
    return this.obfuscateWithCaesarCipherV2(input);
  }

  obfuscateBySwappingAdjacentBytesV2(input) {
    const output = new Uint8Array(input);
    for (let i = 0; i < output.length - 1; i += 2) {
      [output[i], output[i + 1]] = [output[i + 1], output[i]];
    }
    return output;
  }
  deobfuscateBySwappingAdjacentBytesV2(input) {
    return this.obfuscateBySwappingAdjacentBytesV2(input);
  }

  // Seeded

  obfuscateByShufflingV2(input, seed, prngFactory) {
    const a = new Uint8Array(input);
    const n = a.length;
    const seedStr = this.bytesToString(seed);
    const rng = prngFactory(seedStr);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor((rng() * (i + 1)) / 0x100000000);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  deobfuscateByShufflingV2(input, seed, prngFactory) {
    const a = new Uint8Array(input);
    const n = a.length;
    const indices = Array.from({ length: n }, (_, i) => i);
    const seedStr = this.bytesToString(seed);
    const rng = prngFactory(seedStr);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor((rng() * (i + 1)) / 0x100000000);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const unshuffled = new Uint8Array(n);
    for (let i = 0; i < n; i++) unshuffled[indices[i]] = a[i];
    return unshuffled;
  }

  obfuscateWithXORV2(input, seed) {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) output[i] = input[i] ^ seed[i % seed.length];
    return output;
  }
  deobfuscateWithXORV2(input, seed) {
    return this.obfuscateWithXORV2(input, seed);
  }

  obfuscateByInterleavingV2(input, seed, prngFactory) {
    const randomChars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const seedStr = this.bytesToString(seed);
    const rng = prngFactory(seedStr);
    const output = new Uint8Array(input.length * 2);
    for (let i = 0; i < input.length; i++) {
      output[i * 2] = input[i];
      const randIdx = Math.floor((rng() * randomChars.length) / 0x100000000);
      output[i * 2 + 1] = randomChars.charCodeAt(randIdx);
    }
    return output;
  }
  deobfuscateByDeinterleavingV2(input) {
    const output = new Uint8Array(input.length / 2);
    for (let i = 0; i < input.length; i += 2) output[i / 2] = input[i];
    return output;
  }

  obfuscateWithVigenereCipherV2(input, seed) {
    const parts = [];
    for (let i = 0; i < input.length; i++) {
      if (i > 0) parts.push(44);
      const val = (input[i] + seed[i % seed.length]).toString();
      for (let k = 0; k < val.length; k++) parts.push(val.charCodeAt(k));
    }
    return new Uint8Array(parts);
  }
  deobfuscateWithVigenereCipherV2(input, seed) {
    const output = [];
    let currentValStr = '';
    let byteIndex = 0;
    for (const byte of input) {
      if (byte === 44) {
        if (currentValStr) {
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
    if (currentValStr) {
      const val = parseInt(currentValStr, 10);
      const keyCode = seed[byteIndex % seed.length];
      output.push(val - keyCode);
    }
    return new Uint8Array(output);
  }

  obfuscateWithSeededBlockReversalV2(input, seed, prngFactory) {
    const seedStr = this.bytesToString(seed);
    const rng = prngFactory(seedStr);
    const blockSize = Math.floor((rng() * (input.length / 2)) / 0x100000000) + 2;
    const output = [];
    for (let i = 0; i < input.length; i += blockSize) {
      const chunk = input.slice(i, i + blockSize).reverse();
      chunk.forEach((b) => output.push(b));
    }
    return new Uint8Array(output);
  }
  deobfuscateWithSeededBlockReversalV2(input, seed, prngFactory) {
    return this.obfuscateWithSeededBlockReversalV2(input, seed, prngFactory);
  }

  obfuscateWithSeededSubstitutionV2(input, seed, prngFactory) {
    const chars = Array.from({ length: 256 }, (_, i) => i);
    const seedStr = this.bytesToString(seed);
    const rng = prngFactory(seedStr);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((rng() * (i + 1)) / 0x100000000);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) output[i] = chars[input[i]];
    return output;
  }
  deobfuscateWithSeededSubstitutionV2(input, seed, prngFactory) {
    const chars = Array.from({ length: 256 }, (_, i) => i);
    const seedStr = this.bytesToString(seed);
    const rng = prngFactory(seedStr);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor((rng() * (i + 1)) / 0x100000000);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const unsubMap = new Uint8Array(256);
    for (let i = 0; i < 256; i++) unsubMap[chars[i]] = i;
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) output[i] = unsubMap[input[i]];
    return output;
  }

  // --- Obfuscation V4 (SPN/ARX) ---

  _gf_mult(a, b) {
      let p = 0;
      let hi_bit_set;
      for (let i = 0; i < 8; i++) {
          if ((b & 1) !== 0) p ^= a;
          hi_bit_set = (a & 0x80);
          a <<= 1;
          if (hi_bit_set !== 0) a ^= 0x1B;
          b >>= 1;
          a &= 0xFF;
      }
      return p & 0xFF;
  }

  obfuscateWithSBoxV4(input) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = this.SBOX[input[i]];
      return out;
  }
  deobfuscateWithSBoxV4(input) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = this.INV_SBOX[input[i]];
      return out;
  }

  obfuscateWithModMultV4(input) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = (input[i] * 167) & 0xFF;
      return out;
  }
  deobfuscateWithModMultV4(input) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = (input[i] * 23) & 0xFF;
      return out;
  }

  obfuscateWithPBoxV4(input) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) {
          let b = input[i];
          b = ((b & 0xF0) >> 4) | ((b & 0x0F) << 4);
          b = ((b & 0xCC) >> 2) | ((b & 0x33) << 2);
          b = ((b & 0xAA) >> 1) | ((b & 0x55) << 1);
          out[input.length - 1 - i] = b; 
      }
      return out;
  }
  deobfuscateWithPBoxV4(input) {
      return this.obfuscateWithPBoxV4(input);
  }

  obfuscateWithCyclicRotationV4(input) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = ((input[i] >>> 3) | (input[i] << 5)) & 0xFF;
      return out;
  }
  deobfuscateWithCyclicRotationV4(input) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = ((input[i] << 3) | (input[i] >>> 5)) & 0xFF;
      return out;
  }

  obfuscateWithKeyedXORV4(input, seed) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = input[i] ^ seed[i % seed.length];
      return out;
  }
  deobfuscateWithKeyedXORV4(input, seed) {
      return this.obfuscateWithKeyedXORV4(input, seed);
  }

  obfuscateWithFeistelV4(input, seed) {
      const out = new Uint8Array(input);
      const half = Math.floor(out.length / 2);
      if(half === 0) return out;
      for(let i=0; i<half; i++) {
          const f = (out[half + i] + seed[i % seed.length]) & 0xFF;
          out[i] = out[i] ^ f;
      }
      return out;
  }
  deobfuscateWithFeistelV4(input, seed) {
      return this.obfuscateWithFeistelV4(input, seed);
  }

  obfuscateWithModAdditionV4(input, seed) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = (input[i] + seed[i % seed.length]) & 0xFF;
      return out;
  }
  deobfuscateWithModAdditionV4(input, seed) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = (input[i] - seed[i % seed.length] + 256) & 0xFF;
      return out;
  }

  obfuscateWithMatrixHillV4(input) {
      const out = new Uint8Array(input.length);
      if (input.length === 0) return out;
      out[0] = input[0];
      for (let i = 1; i < input.length; i++) out[i] = (input[i] + out[i-1]) & 0xFF;
      return out;
  }
  deobfuscateWithMatrixHillV4(input) {
      const out = new Uint8Array(input.length);
      if (input.length === 0) return out;
      out[0] = input[0];
      for (let i = input.length - 1; i > 0; i--) out[i] = (input[i] - input[i-1] + 256) & 0xFF;
      return out;
  }

  obfuscateWithGaloisMultV4(input) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = this._gf_mult(input[i], 0x02);
      return out;
  }
  deobfuscateWithGaloisMultV4(input) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) out[i] = this._gf_mult(input[i], 0x8D);
      return out;
  }

  obfuscateWithBitFlipMaskingV4(input, seed) {
      const out = new Uint8Array(input.length);
      for(let i=0; i<input.length; i++) {
          const mask = seed[i % seed.length];
          out[i] = input[i] ^ ((mask & 0xAA) | (~mask & 0x55));
      }
      return out;
  }
  deobfuscateWithBitFlipMaskingV4(input, seed) {
      return this.obfuscateWithBitFlipMaskingV4(input, seed);
  }

  obfuscateWithColumnarShuffleV4(input) {
      const n = input.length;
      const out = new Uint8Array(n);
      const cols = 3;
      let idx = 0;
      for (let c = 0; c < cols; c++) {
          for (let i = c; i < n; i += cols) out[idx++] = input[i];
      }
      return out;
  }
  deobfuscateWithColumnarShuffleV4(input) {
      const n = input.length;
      const out = new Uint8Array(n);
      const cols = 3;
      let idx = 0;
      for (let c = 0; c < cols; c++) {
          for (let i = c; i < n; i += cols) out[i] = input[idx++];
      }
      return out;
  }

  obfuscateWithRecursiveXORV4(input) {
      const out = new Uint8Array(input.length);
      if(input.length === 0) return out;
      out[0] = input[0];
      for(let i=1; i<input.length; i++) out[i] = out[i-1] ^ input[i];
      return out;
  }
  deobfuscateWithRecursiveXORV4(input) {
      const out = new Uint8Array(input.length);
      if(input.length === 0) return out;
      out[0] = input[0];
      for(let i=input.length - 1; i>0; i--) out[i] = input[i] ^ input[i-1];
      return out;
  }

  // --- PRNG ---

  shuffleArray(array, seed, prngFactory) {
    const rng = prngFactory(seed);
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor((rng() * (i + 1)) / 0x100000000);
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
      return ((t ^ (t >>> 14)) >>> 0);
    };
  }

  async sha256Hex(message) {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      return this.buf2hex(hashBuffer);
  }

  darkstar_chacha_prng(seed) {
    // Since this runs synchronously but needs an awaited hash ideally, 
    // we bypass the await by utilizing standard crypto hash or pseudo-buffer. 
    // But since `seed` isn't awaited strictly during map passes, we use an inline shim to emulate Sha256 synchronously for PRNG initialization if needed in Node.
    // For Node specifically we can use native `import crypto from 'crypto'` but we want to stick to the same algorithm exactly.
    let hashHex = "";
    try {
        let nodeCrypto;
        if (typeof require !== 'undefined') {
            nodeCrypto = require('crypto');
        } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            // Synchronous runtime module require workaround for ES modules
            const mod = eval('require("module")');
            const req = mod.createRequire(import.meta.url);
            nodeCrypto = req('crypto');
        }
        if (nodeCrypto) {
            hashHex = nodeCrypto.createHash('sha256').update(seed).digest('hex');
        }
    } catch(e) { }
    
    let state = new Uint32Array(8);
    for (let i = 0; i < 8; i++) {
      state[i] = parseInt(hashHex.substr(i * 8, 8), 16);
    }

    let counter = 0;

    return function () {
      counter++;
      let x = state[(counter + 0) % 8];
      let y = state[(counter + 3) % 8];
      let z = state[(counter + 5) % 8];

      x = (x + y + counter) | 0;
      z = (z ^ x) | 0;
      z = (z << 16) | (z >>> 16);

      y = (y + z + (counter * 3)) | 0;
      x = (x ^ y) | 0;
      x = (x << 12) | (x >>> 20);

      state[(counter + 0) % 8] = x;
      state[(counter + 3) % 8] = y;
      state[(counter + 5) % 8] = z;

      let t = (x + y + z) | 0;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

      return ((t ^ (t >>> 14)) >>> 0);
    };
  }
}

// --- CLI Support ---

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

function resolveArg(arg) {
  if (arg && arg.startsWith('@')) {
    const filePath = arg.slice(1);
    try {
      return fs.readFileSync(filePath, 'utf8').trim();
    } catch (err) {
      console.error(`Error reading argument file ${filePath}: ${err.message}`);
      process.exit(1);
    }
  }
  return arg;
}

if (isMain) {
  let args = process.argv.slice(2);
  let forceV2 = false;
  let forceV1 = false;
  let v = 5;
  let format = '';
  let _core = 'aes';

  while (args.length > 0 && args[0].startsWith('-')) {
    const arg = args.shift();
    if (arg === '-h' || arg === '--help') {
      console.log('Darkstar D-KASP-512 (V5) Cryptographic Suite');
      console.log('\nUsage:');
      console.log('  node darkstar_crypt.js [flags] <command> [args]');
      console.log('\nFlags:');
      console.log('  -v, --v <1-5>       D-KASP Protocol Version (default: 5)');
      console.log('  -c, --core <aes|arx> Encryption Core (default: aes)');
      console.log('  -f, --format <json|csv|text> Output format');
      console.log('\nCommands:');
      console.log('  encrypt <mnemonic> <password>    Encrypt a mnemonic phrase');
      console.log('  decrypt <data> <rk> <password>   Decrypt a Darkstar payload');
      console.log('  keygen                          Generate ML-KEM-1024 Keypair');
      console.log('  test                            Run internal self-test');
      process.exit(0);
    }
    if ((arg === '-v' || arg === '--v') && args.length > 0) {
      v = parseInt(args.shift(), 10) || 5;
    } else if ((arg === '-f' || arg === '--format') && args.length > 0) {
      format = args.shift();
    } else if ((arg === '-c' || arg === '--core') && args.length > 0) {
      _core = args.shift();
    } else {
      // Legacy flags
      if (arg === '--v1') v = 1;
      if (arg === '--v2') v = 2;
      if (arg === '--v3') v = 3;
      if (arg === '--v4') v = 4;
      if (arg === '--v5') v = 5;
    }
  }

  const crypt = new DarkstarCrypt();
  const command = args.shift();
  if (command === 'encrypt') {
    const mnemonic = resolveArg(args[0]);
    const password = resolveArg(args[1]);
    if (!mnemonic || !password) {
      console.error('Usage: encrypt <mnemonic> <password>');
      process.exit(1);
    }
    crypt
      .encrypt(mnemonic, password, v)
      .then((res) => {
        const f = format || 'json';
        const resObj = typeof res === 'string' ? JSON.parse(res) : res;
        
        if (f === 'json') {
          console.log(typeof res === 'string' ? res : JSON.stringify(res));
        } else if (f === 'csv') {
          console.log(`${resObj.encryptedData},${resObj.reverseKey}`);
        } else {
          console.log(`Data: ${resObj.encryptedData}\nReverseKey: ${resObj.reverseKey}`);
        }
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else if (command === 'decrypt') {
    const data = resolveArg(args[0]);
    const rk = resolveArg(args[1]);
    const password = resolveArg(args[2]);
    if (!data || rk === undefined || !password) {
      console.error('Usage: decrypt <data> <rk> <password>');
      process.exit(1);
    }
    crypt
      .decrypt(data, rk, password)
      .then((res) => {
        if (format === 'json') {
          process.stdout.write(JSON.stringify({ decrypted: res }));
        } else {
          process.stdout.write(res);
        }
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else if (command === 'test') {
    const mnemonic = 'apple banana cherry date';
    let password = 'MySecre!Password123';
    let decryptPassword = password;

    const runTest = async () => {
      const { ml_kem1024: kyber } = require('@noble/post-quantum/ml-kem.js');
      const keys = kyber.keygen();
      password = Buffer.from(keys.publicKey).toString('hex');
      decryptPassword = Buffer.from(keys.secretKey).toString('hex');

      console.log(`--- Darkstar Node Self-Test (V${v}) ---`);
      try {
        const res = await crypt.encrypt(mnemonic, password, v);
        const decrypted = await crypt.decrypt(res.encryptedData, res.reverseKey, decryptPassword);
        console.log(`Decrypted: '${decrypted}'`);
        if (decrypted === mnemonic) {
          console.log('Result: PASSED');
        } else {
          console.error('Result: FAILED');
          process.exit(1);
        }
      } catch (err) {
        console.error('Test Error:', err);
        process.exit(1);
      }
    };
    runTest();
  } else if (command === 'keygen') {
    const { ml_kem1024: kyber } = require('@noble/post-quantum/ml-kem.js');
    const keys = kyber.keygen();
    const pkHex = Buffer.from(keys.publicKey).toString('hex');
    const skHex = Buffer.from(keys.secretKey).toString('hex');
    
    const f = format || 'text';
    if (f === 'json') {
      process.stdout.write(JSON.stringify({ pk: pkHex, sk: skHex }));
    } else if (f === 'csv') {
      process.stdout.write(`${pkHex},${skHex}`);
    } else {
      process.stdout.write(`PK: ${pkHex}\nSK: ${skHex}\n`);
    }
  } else {
    console.error('Error: Unknown command');
    process.exit(1);
  }
}

