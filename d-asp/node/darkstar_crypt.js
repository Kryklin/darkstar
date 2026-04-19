/*
 * D-ASP (ASP Cascade 16)
 * Implementation: Node.js (Production Bridge Implementation)
 *
 * To the extent possible under law, the author(s) have dedicated all copyright 
 * and related and neighboring rights to this software to the public domain 
 * worldwide. This software is distributed without any warranty.
 * 
 * See <http://creativecommons.org/publicdomain/zero/1.0/>
 */

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const crypto = globalThis.crypto || require('node:crypto').webcrypto;
const { ml_kem1024: kyber } = require('@noble/post-quantum/ml-kem.js');

export class DarkstarCrypt {
  constructor() {
    this.SBOX = new Uint8Array([
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15, 0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
      0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73, 0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
      0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
      0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a, 0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
      0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf, 0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
    ]);

    this.INV_SBOX = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      this.INV_SBOX[this.SBOX[i]] = i;
    }

    this.forwardPipeline = [
      this.transSBox.bind(this),
      this.transModMult.bind(this),
      this.transPBox.bind(this),
      this.transCyclicRot.bind(this),
      this.transKeyedXOR.bind(this),
      this.transFeistel.bind(this),
      this.transModAdd.bind(this),
      this.transMatrixHill.bind(this),
      this.transGFMult.bind(this),
      this.transBitFlip.bind(this),
      this.transColumnar.bind(this),
      this.transRecXOR.bind(this),
      this.transMDSNetwork.bind(this),
    ];

    this.reversePipeline = [
      this.invTransSBox.bind(this),
      this.invTransModMult.bind(this),
      this.invTransPBox.bind(this),
      this.invTransCyclicRot.bind(this),
      this.invTransKeyedXOR.bind(this),
      this.invTransFeistel.bind(this),
      this.invTransModAdd.bind(this),
      this.invTransMatrixHill.bind(this),
      this.invTransGFMult.bind(this),
      this.invTransBitFlip.bind(this),
      this.invTransColumnar.bind(this),
      this.invTransRecXOR.bind(this),
      this.invTransMDSNetwork.bind(this),
    ];

    this.groupS = [0, 1, 5];
    this.groupP = [2, 3, 10];
    this.groupN = [12, 12, 11];
    this.groupA = [4, 6, 9];
  }

  // --- Cryptographic Helpers ---

  async hmacSha256Bytes(keyBytes, dataStr) {
    const keyObj = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', keyObj, new TextEncoder().encode(dataStr));
    return new Uint8Array(sig);
  }

  async sha256Bytes(data) {
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  }

  async encrypt(payload, keyMaterial, hwidHex = null) {
    const totalStart = performance.now();
    const pkBytes = this.hex2buf(keyMaterial);
    
    const kemStart = performance.now();
    const encap = kyber.encapsulate(pkBytes);
    const kemDuration = performance.now() - kemStart;
    
    const ctHex = this.buf2hex(encap.cipherText);
    const ss_bytes = encap.sharedSecret;

    const kdfStart = performance.now();
    
    // Stage 1: Blended_SS (K_root)
    const kRootHasher = require('node:crypto').createHash('sha256');
    kRootHasher.update(ss_bytes);
    if (hwidHex) kRootHasher.update(this.hex2buf(hwidHex));
    kRootHasher.update(Buffer.from('dasp-identity-v3'));
    const blendedSS = kRootHasher.digest();
    const blendedSSHex = blendedSS.toString('hex');

    const cipherKey = require('node:crypto').createHash('sha256').update(Buffer.concat([Buffer.from('cipher'), blendedSS])).digest();
    const hmacKey = require('node:crypto').createHash('sha256').update(Buffer.concat([Buffer.from('hmac'), blendedSS])).digest();
    
    const activePasswordStr = cipherKey.toString('hex');
    const activeHmacKey = hmacKey;
    ss_bytes.fill(0);
    const kdfDuration = performance.now() - kdfStart;

    const prngFactory = this.darkstar_chacha_prng.bind(this);
    let chainState = await this.sha256Bytes('dasp-chain-' + activePasswordStr);
    let currentWordBytes = this.stringToBytes(payload);

    // Stage 2: word_key
    const wordKey = await this.hmacSha256Bytes(new TextEncoder().encode(activePasswordStr), 'dasp-word-0');
    const wordKeyHex = this.buf2hex(wordKey);

    for (let i = 0; i < currentWordBytes.length; i++) {
      currentWordBytes[i] ^= chainState[i % 32];
    }

    const checksum = this._generateChecksum(Array.from({ length: 12 }, (_, i) => i));
    const funcKey = await this.hmacSha256Bytes(wordKey, `keyed-${checksum}`);

    const rngPath = prngFactory(wordKeyHex);
    
    // Stage 3: Round Indices
    const roundIndices = [];
    const cascadeStart = performance.now();
    for (let i = 0; i < 16; i++) {
      let sIdx = i % 4 === 0 ? 0 : i % 4 === 2 ? 1 : this.groupS[rngPath() % this.groupS.length];
      let pIdx = this.groupP[rngPath() % this.groupP.length];
      let nIdx = this.groupN[rngPath() % this.groupN.length];
      let aIdx = this.groupA[rngPath() % this.groupA.length];
      
      currentWordBytes = this.forwardPipeline[sIdx](currentWordBytes, funcKey, prngFactory);
      currentWordBytes = this.forwardPipeline[pIdx](currentWordBytes, funcKey, prngFactory);
      currentWordBytes = this.forwardPipeline[nIdx](currentWordBytes, funcKey, prngFactory);
      currentWordBytes = this.forwardPipeline[aIdx](currentWordBytes, funcKey, prngFactory);
      
      roundIndices.push([sIdx, pIdx, nIdx, aIdx]);
    }
    const cascadeDuration = performance.now() - cascadeStart;

    const macData = Buffer.concat([this.hex2buf(ctHex), currentWordBytes]);
    const mac = require('node:crypto').createHmac('sha256', activeHmacKey).update(macData).digest();
    
    // Stage 4: final mac
    const macTagFinal = mac.toString('hex');

    if (process.env.DASP_DIAGNOSTIC === '1') {
      process.stderr.write(JSON.stringify({
        diagnostics: {
          stage1_blended_ss: blendedSSHex,
          stage2_word_key: wordKeyHex,
          stage3_round_indices: roundIndices,
          stage4_mac: macTagFinal
        }
      }) + '\n');
    }

    const totalDuration = performance.now() - totalStart;

    return {
      data: this.buf2hex(currentWordBytes),
      ct: ctHex,
      mac: macTagFinal,
      timings: {
        kem_us: Math.round(kemDuration * 1000),
        kdf_us: Math.round(kdfDuration * 1000),
        cascade_us: Math.round(cascadeDuration * 1000),
        total_us: Math.round(totalDuration * 1000)
      }
    };
  }

  async decrypt(encryptedDataRaw, reverseKeyB64, keyMaterial, hwidHex = null) {
    const totalStart = performance.now();
    const parsed = typeof encryptedDataRaw === 'string' ? JSON.parse(encryptedDataRaw) : encryptedDataRaw;
    const ctHex = parsed.ct;

    const skBytes = this.hex2buf(keyMaterial.length > 6336 ? keyMaterial.slice(0, 6336) : keyMaterial);
    const ctBytes = this.hex2buf(ctHex);
    
    const kemStart = performance.now();
    const ss_bytes = kyber.decapsulate(ctBytes, skBytes);
    const kemDuration = performance.now() - kemStart;

    const kdfStart = performance.now();
    
    // Stage 1: Blended_SS (K_root)
    const kRootHasher = require('node:crypto').createHash('sha256');
    kRootHasher.update(ss_bytes);
    if (hwidHex) kRootHasher.update(this.hex2buf(hwidHex));
    kRootHasher.update(Buffer.from('dasp-identity-v3'));
    const blendedSS = kRootHasher.digest();
    const blendedSSHex = blendedSS.toString('hex');

    const cipherKey = require('node:crypto').createHash('sha256').update(Buffer.concat([Buffer.from('cipher'), blendedSS])).digest();
    const hmacKey = require('node:crypto').createHash('sha256').update(Buffer.concat([Buffer.from('hmac'), blendedSS])).digest();
    
    const activePasswordStr = cipherKey.toString('hex');
    const activeHmacKey = hmacKey;
    ss_bytes.fill(0);
    const kdfDuration = performance.now() - kdfStart;

    const payloadBytes = this.hex2buf(parsed.data);
    const macData = Buffer.concat([this.hex2buf(ctHex), payloadBytes]);
    const macActual = require('node:crypto').createHmac('sha256', activeHmacKey).update(macData).digest();
    
    // Stage 4: final mac
    const macTagActual = macActual.toString('hex');
    
    const prngFactory = this.darkstar_chacha_prng.bind(this);
    let chainState = await this.sha256Bytes('dasp-chain-' + activePasswordStr);
    let currentWordBytes = new Uint8Array(payloadBytes);
    
    // Stage 2: word_key
    const wordKey = await this.hmacSha256Bytes(new TextEncoder().encode(activePasswordStr), 'dasp-word-0');
    const wordKeyHex = this.buf2hex(wordKey);

    const rngPath = prngFactory(wordKeyHex);
    
    // Stage 3: Round Indices
    const roundIndices = [];
    const roundPaths = [];
    for (let i = 0; i < 16; i++) {
      let s = i % 4 === 0 ? 0 : i % 4 === 2 ? 1 : this.groupS[rngPath() % this.groupS.length];
      let p = this.groupP[rngPath() % this.groupP.length];
      let n = this.groupN[rngPath() % this.groupN.length];
      let a = this.groupA[rngPath() % this.groupA.length];
      roundPaths.push({ s, p, n, a });
      roundIndices.push([s, p, n, a]);
    }

    if (process.env.DASP_DIAGNOSTIC === '1') {
      process.stderr.write(JSON.stringify({
        diagnostics: {
          stage1_blended_ss: blendedSSHex,
          stage2_word_key: wordKeyHex,
          stage3_round_indices: roundIndices,
          stage4_mac: macTagActual
        }
      }) + '\n');
    }

    if (!require('node:crypto').timingSafeEqual(macActual, this.hex2buf(parsed.mac || ''))) {
      throw new Error('Integrity Check Failed');
    }

    const checksum = this._generateChecksum(Array.from({ length: 12 }, (_, i) => i));
    const funcKey = await this.hmacSha256Bytes(wordKey, `keyed-${checksum}`);

    const cascadeStart = performance.now();
    for (let j = 15; j >= 0; j--) {
      const r = roundPaths[j];
      currentWordBytes = this.reversePipeline[r.a](currentWordBytes, funcKey, prngFactory);
      currentWordBytes = this.reversePipeline[r.n](currentWordBytes, funcKey, prngFactory);
      currentWordBytes = this.reversePipeline[r.p](currentWordBytes, funcKey, prngFactory);
      currentWordBytes = this.reversePipeline[r.s](currentWordBytes, funcKey, prngFactory);
    }
    const cascadeDuration = performance.now() - cascadeStart;

    for (let i = 0; i < currentWordBytes.length; i++) {
      currentWordBytes[i] ^= chainState[i % 32];
    }
    
    const totalDuration = performance.now() - totalStart;
    process.stderr.write(JSON.stringify({
      timings: {
        kem_us: Math.round(kemDuration * 1000),
        kdf_us: Math.round(kdfDuration * 1000),
        cascade_us: Math.round(cascadeDuration * 1000),
        total_us: Math.round(totalDuration * 1000)
      }
    }) + '\n');

    return this.bytesToString(currentWordBytes);
  }

  // --- Helpers ---
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
    return numbers.reduce((acc, curr) => acc + curr, 0) % 997;
  }

  // --- Transformations ---
  _gf_mult(a, b) {
    let p = 0;
    for (let i = 0; i < 8; i++) {
      // Mask: if b & 1, add a to product p
      p ^= a & -(b & 1);

      // Mask: if hi-bit of a is set, reduce by 0x1B
      const mask = -(a >> 7);
      a = (a << 1) ^ (0x1b & mask);

      b >>= 1;
      a &= 0xff;
      p &= 0xff;
    }
    return p;
  }

  transSBox(input) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = this.SBOX[input[i]];
    return out;
  }
  invTransSBox(input) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = this.INV_SBOX[input[i]];
    return out;
  }
  transModMult(input) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = (input[i] * 167) & 0xff;
    return out;
  }
  invTransModMult(input) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = (input[i] * 23) & 0xff;
    return out;
  }
  transPBox(input) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let b = input[i];
      b = ((b & 0xf0) >> 4) | ((b & 0x0f) << 4);
      b = ((b & 0xcc) >> 2) | ((b & 0x33) << 2);
      b = ((b & 0xaa) >> 1) | ((b & 0x55) << 1);
      out[input.length - 1 - i] = b;
    }
    return out;
  }
  invTransPBox(input) {
    return this.transPBox(input);
  }

  transCyclicRot(input) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = ((input[i] >>> 3) | (input[i] << 5)) & 0xff;
    return out;
  }
  invTransCyclicRot(input) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = ((input[i] << 3) | (input[i] >>> 5)) & 0xff;
    return out;
  }
  transKeyedXOR(input, seed) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = input[i] ^ seed[i % seed.length];
    return out;
  }
  invTransKeyedXOR(input, seed) {
    return this.transKeyedXOR(input, seed);
  }

  transFeistel(input, seed) {
    const out = new Uint8Array(input);
    const half = Math.floor(out.length / 2);
    if (half === 0) return out;
    for (let i = 0; i < half; i++) {
      out[i] ^= (out[half + i] + seed[i % seed.length]) & 0xff;
    }
    return out;
  }
  invTransFeistel(input, seed) {
    return this.transFeistel(input, seed);
  }

  transModAdd(input, seed) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = (input[i] + seed[i % seed.length]) & 0xff;
    return out;
  }
  invTransModAdd(input, seed) {
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = (input[i] - seed[i % seed.length] + 256) & 0xff;
    return out;
  }

  transMatrixHill(input) {
    if (input.length === 0) return new Uint8Array(0);
    const out = new Uint8Array(input.length);
    out[0] = input[0];
    for (let i = 1; i < input.length; i++) out[i] = (input[i] + out[i - 1]) & 0xff;
    return out;
  }
  invTransMatrixHill(input) {
    if (input.length === 0) return new Uint8Array(0);
    const out = new Uint8Array(input.length);
    out[0] = input[0];
    for (let i = input.length - 1; i > 0; i--) out[i] = (input[i] - input[i - 1] + 256) & 0xff;
    return out;
  }

  static MDS_MATRIX = [
    [0x02, 0x03, 0x01, 0x01],
    [0x01, 0x02, 0x03, 0x01],
    [0x01, 0x01, 0x02, 0x03],
    [0x03, 0x01, 0x01, 0x02],
  ];
  static INV_MDS_MATRIX = [
    [0x0e, 0x0b, 0x0d, 0x09],
    [0x09, 0x0e, 0x0b, 0x0d],
    [0x0d, 0x09, 0x0e, 0x0b],
    [0x0b, 0x0d, 0x09, 0x0e],
  ];

  transMDSNetwork(input) {
    if (input.length < 4) return this.transMatrixHill(input);
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i += 4) {
      const block = input.slice(i, i + 4);
      if (block.length < 4) {
        copy(out, input, i);
        continue;
      }
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let c = 0; c < 4; c++) {
          sum ^= this._gf_mult(block[c], DarkstarCrypt.MDS_MATRIX[r][c]);
        }
        out[i + r] = sum;
      }
    }
    return out;
  }
  invTransMDSNetwork(input) {
    if (input.length < 4) return this.invTransMatrixHill(input);
    const out = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i += 4) {
      const block = input.slice(i, i + 4);
      if (block.length < 4) {
        copy(out, input, i);
        continue;
      }
      for (let r = 0; r < 4; r++) {
        let sum = 0;
        for (let c = 0; c < 4; c++) {
          sum ^= this._gf_mult(block[c], DarkstarCrypt.INV_MDS_MATRIX[r][c]);
        }
        out[i + r] = sum;
      }
    }
    return out;
  }
  transGFMult(input) {
    return new Uint8Array(input.map((b) => this._gf_mult(b, 0x02)));
  }
  invTransGFMult(input) {
    return new Uint8Array(input.map((b) => this._gf_mult(b, 0x8d)));
  }
  transBitFlip(input, seed) {
    return new Uint8Array(
      input.map((b, i) => {
        const m = seed[i % seed.length];
        return b ^ ((m & 0xaa) | (~m & 0x55));
      }),
    );
  }
  invTransBitFlip(input, seed) {
    return this.transBitFlip(input, seed);
  }
  transColumnar(input) {
    const n = input.length;
    const out = new Uint8Array(n);
    const cols = 3;
    let idx = 0;
    for (let c = 0; c < cols; c++) {
      for (let i = c; i < n; i += cols) out[idx++] = input[i];
    }
    return out;
  }
  invTransColumnar(input) {
    const n = input.length;
    const out = new Uint8Array(n);
    const cols = 3;
    let idx = 0;
    for (let c = 0; c < cols; c++) {
      for (let i = c; i < n; i += cols) out[i] = input[idx++];
    }
    return out;
  }
  transRecXOR(input) {
    if (input.length === 0) return new Uint8Array(0);
    const out = new Uint8Array(input.length);
    out[0] = input[0];
    for (let i = 1; i < input.length; i++) out[i] = out[i - 1] ^ input[i];
    return out;
  }
  invTransRecXOR(input) {
    if (input.length === 0) return new Uint8Array(0);
    const out = new Uint8Array(input.length);
    out[0] = input[0];
    for (let i = input.length - 1; i > 0; i--) out[i] = input[i] ^ input[i - 1];
    return out;
  }

  darkstar_chacha_prng(seed) {
    let hash = require('crypto').createHash('sha256').update(seed).digest();
    const state = new Uint32Array(16);
    state[0] = 0x61707865;
    state[1] = 0x3320646e;
    state[2] = 0x79622d32;
    state[3] = 0x6b206574;
    for (let i = 0; i < 8; i++) state[4 + i] = hash[i * 4] | (hash[i * 4 + 1] << 8) | (hash[i * 4 + 2] << 16) | (hash[i * 4 + 3] << 24);
    function chacha_block(st) {
      const x = new Uint32Array(st);
      const rot = (v, n) => (v << n) | (v >>> (32 - n));
      const qr = (a, b, c, d) => {
        x[a] = (x[a] + x[b]) | 0;
        x[d] ^= x[a];
        x[d] = rot(x[d], 16);
        x[c] = (x[c] + x[d]) | 0;
        x[b] ^= x[c];
        x[b] = rot(x[b], 12);
        x[a] = (x[a] + x[b]) | 0;
        x[d] ^= x[a];
        x[d] = rot(x[d], 8);
        x[c] = (x[c] + x[d]) | 0;
        x[b] ^= x[c];
        x[b] = rot(x[b], 7);
      };
      for (let i = 0; i < 10; i++) {
        qr(0, 4, 8, 12);
        qr(1, 5, 9, 13);
        qr(2, 6, 10, 14);
        qr(3, 7, 11, 15);
        qr(0, 5, 10, 15);
        qr(1, 6, 11, 12);
        qr(2, 7, 8, 13);
        qr(3, 4, 9, 14);
      }
      for (let i = 0; i < 16; i++) x[i] = (x[i] + st[i]) | 0;
      return x;
    }
    let block = chacha_block(state);
    let blockIdx = 0;
    return function () {
      if (blockIdx >= 16) {
        state[12]++;
        block = chacha_block(state);
        blockIdx = 0;
      }
      return block[blockIdx++] >>> 0;
    };
  }
}

function copy(dest, src, offset) {
  for (let i = 0; i < src.length - offset; i++) dest[offset + i] = src[offset + i];
}

// --- CLI Support ---
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import fs from 'node:fs';
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);
function resolveArg(arg) {
  if (arg && arg.startsWith('@')) return fs.readFileSync(arg.slice(1), 'utf8').trim();
  return arg;
}

if (isMain) {
  let args = process.argv.slice(2);
  let hwid = null;
  let i = 0;
  while (i < args.length) {
    if (args[i] === '--hwid' && i + 1 < args.length) {
      hwid = resolveArg(args[i + 1]);
      args.splice(i, 2);
    } else if (args[i] === '--diagnostic') {
      process.env.DASP_DIAGNOSTIC = '1';
      args.splice(i, 1);
    } else if ((args[i] === '-v' || args[i] === '--version') && i + 1 < args.length) {
      args.splice(i, 2);
    } else i++;
  }
  const crypt = new DarkstarCrypt();
  const command = args.shift();
  if (command === 'encrypt') {
    crypt
      .encrypt(resolveArg(args[0]), resolveArg(args[1]), hwid)
      .then((res) => console.log(JSON.stringify(res)))
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
  } else if (command === 'decrypt') {
    crypt
      .decrypt(resolveArg(args[0]), '', resolveArg(args[1]), hwid)
      .then((res) => process.stdout.write(res))
      .catch((e) => {
        console.error(e);
        process.exit(1);
      });
  } else if (command === 'keygen') {
    const k = kyber.keygen();
    console.log(`PK: ${Buffer.from(k.publicKey).toString('hex')}\nSK: ${Buffer.from(k.secretKey).toString('hex')}`);
  } else if (command === 'test') {
    const p = 'apple banana cherry date elderberry fig';
    const k = kyber.keygen();
    crypt
      .encrypt(p, Buffer.from(k.publicKey).toString('hex'))
      .then((e) => crypt.decrypt(e, '', Buffer.from(k.secretKey).toString('hex')))
      .then((d) => console.log(`Dec: ${d}\nResult: ${d === p ? 'PASSED' : 'FAILED'}`));
  }
}
