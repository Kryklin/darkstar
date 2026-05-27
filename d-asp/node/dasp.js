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
  }

  // --- Helpers ---
  hex2buf(hex) {
    if (hex.length % 2 !== 0) hex = '0' + hex;
    const buf = new Uint8Array(hex.length / 2);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return buf;
  }

  buf2hex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async hmacSha256Bytes(keyBytes, dataStr) {
    const keyObj = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', keyObj, new TextEncoder().encode(dataStr));
    return new Uint8Array(sig);
  }

  async hmacSha256Raw(keyBytes, dataBuf) {
    const keyObj = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', keyObj, dataBuf);
    return new Uint8Array(sig);
  }

  async sha256Bytes(data) {
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  }

  async sha512Bytes(data) {
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return new Uint8Array(await crypto.subtle.digest('SHA-512', buf));
  }

  createPRNG(hash) {
    const state = new Uint32Array(16);
    state[0] = 0x61707865; state[1] = 0x3320646e; state[2] = 0x79622d32; state[3] = 0x6b206574;
    const dv = new DataView(hash.buffer, hash.byteOffset, hash.byteLength);
    for (let i = 0; i < 8; i++) {
      state[4+i] = dv.getUint32(i*4, true);
    }
    state[12] = 0; state[13] = 0; state[14] = 0; state[15] = 0;

    let blockIdx = 0;
    let block = new Uint32Array(16);

    const rotate = (v, n) => ((v << n) | (v >>> (32 - n))) >>> 0;
    const chachaBlock = (st) => {
      const x = new Uint32Array(st);
      const qr = (a, b, c, d) => {
        x[a] = (x[a] + x[b]) >>> 0; x[d] ^= x[a]; x[d] = rotate(x[d], 16);
        x[c] = (x[c] + x[d]) >>> 0; x[b] ^= x[c]; x[b] = rotate(x[b], 12);
        x[a] = (x[a] + x[b]) >>> 0; x[d] ^= x[a]; x[d] = rotate(x[d], 8);
        x[c] = (x[c] + x[d]) >>> 0; x[b] ^= x[c]; x[b] = rotate(x[b], 7);
      };
      for (let i = 0; i < 10; i++) {
        qr(0, 4, 8, 12); qr(1, 5, 9, 13);
        qr(2, 6, 10, 14); qr(3, 7, 11, 15);
        qr(0, 5, 10, 15); qr(1, 6, 11, 12);
        qr(2, 7, 8, 13); qr(3, 4, 9, 14);
      }
      for (let i = 0; i < 16; i++) {
        x[i] = (x[i] + st[i]) >>> 0;
      }
      return x;
    };

    block.set(chachaBlock(state));

    return () => {
      if (blockIdx >= 16) {
        state[12] = (state[12] + 1) >>> 0;
        block.set(chachaBlock(state));
        blockIdx = 0;
      }
      return block[blockIdx++];
    };
  }

  daspCascade32(block, roundKeys) {
    const state = new Uint32Array(8);
    const dv = new DataView(block.buffer, block.byteOffset, 32);
    for(let i=0; i<8; i++) state[i] = dv.getUint32(i*4, true);

    const rotate = (v, n) => ((v << n) | (v >>> (32 - n))) >>> 0;

    for (let r = 0; r < 16; r++) {
      for (let j = 0; j < 8; j++) {
        state[j] = (state[j] + roundKeys[r*8 + j]) >>> 0;
      }
      const rc = (0x9E3779B9 + r) >>> 0;
      for (let j = 0; j < 8; j++) {
        state[j] ^= rc;
      }
      for (let j = 0; j < 8; j++) {
        state[j] = rotate(state[j], 11);
      }
      
      const t = state[0];
      state[0] = state[1];
      state[1] = state[2];
      state[2] = state[3];
      state[3] = state[4];
      state[4] = state[5];
      state[5] = state[6];
      state[6] = state[7];
      state[7] = t;
    }

    for(let i=0; i<8; i++) {
      dv.setUint32(i*4, state[i], true);
    }
  }

  async encrypt(payload, keyMaterial, hwidHex = null, telemetry = false) {
    const totalStart = performance.now();
    const pkBytes = this.hex2buf(keyMaterial);
    
    const kemStart = performance.now();
    const encap = kyber.encapsulate(pkBytes);
    const kemDuration = performance.now() - kemStart;
    
    const ctHex = this.buf2hex(encap.cipherText);
    const ss_bytes = encap.sharedSecret;

    const kdfStart = performance.now();
    
    const salt = hwidHex ? this.hex2buf(hwidHex) : new Uint8Array(32);
    const prk = await this.hmacSha256Raw(salt, ss_bytes);
    
    const blended_ss = await this.hmacSha256Raw(prk, new TextEncoder().encode("dasp-identity-v3\x01"));
    const blended_ss_hex = this.buf2hex(blended_ss);

    const cipher_key = await this.sha256Bytes(new Uint8Array([...new TextEncoder().encode("cipher"), ...blended_ss]));
    const hmac_key = await this.sha256Bytes(new Uint8Array([...new TextEncoder().encode("hmac"), ...blended_ss]));
    
    const active_password_str = this.buf2hex(cipher_key);

    for (let i = 0; i < ss_bytes.length; i++) ss_bytes[i] = 0;
    const kdfDuration = performance.now() - kdfStart;

    const word_key = await this.hmacSha256Bytes(new TextEncoder().encode(active_password_str), "dasp-word-0");
    const word_key_hex = this.buf2hex(word_key);

    const chain_state = await this.sha256Bytes(`dasp-chain-${active_password_str}`);
    const hash = await this.sha512Bytes(word_key_hex);
    const nextPRNG = this.createPRNG(hash);
    
    const roundKeys = new Uint32Array(128);
    for(let i=0; i<128; i++) roundKeys[i] = nextPRNG();

    const payloadBytes = new TextEncoder().encode(payload);
    const cascadeStart = performance.now();

    const nonce = new Uint8Array(chain_state);
    for (let i = 0; i < payloadBytes.length; i += 32) {
      const chunkLen = Math.min(32, payloadBytes.length - i);
      const block = new Uint8Array(32);
      block.set(nonce);
      
      this.daspCascade32(block, roundKeys);
      
      for(let j=0; j<chunkLen; j++) {
        payloadBytes[i+j] ^= block[j];
      }
      
      for(let j=0; j<32; j++) {
        nonce[j] = (nonce[j] + 1) & 0xFF;
        if(nonce[j] !== 0) break;
      }
    }

    const cascadeDuration = performance.now() - cascadeStart;

    const macData = new Uint8Array(encap.cipherText.length + payloadBytes.length);
    macData.set(encap.cipherText, 0);
    macData.set(payloadBytes, encap.cipherText.length);
    const macBuf = await this.hmacSha256Raw(hmac_key, macData);
    const mac_tag = this.buf2hex(macBuf);

    if (process.env.DASP_DIAGNOSTIC === '1') {
      console.error(JSON.stringify({
        diagnostics: {
          stage1_blended_ss: blended_ss_hex,
          stage2_word_key: word_key_hex,
          stage4_mac: mac_tag
        }
      }));
    }

    const totalDuration = performance.now() - totalStart;

    const resObj = {
      data: this.buf2hex(payloadBytes),
      ct: ctHex,
      mac: mac_tag,
    };
    if (telemetry) {
      resObj.timings = {
        kem_us: Math.round(kemDuration * 1000),
        kdf_us: Math.round(kdfDuration * 1000),
        cascade_us: Math.round(cascadeDuration * 1000),
        total_us: Math.round(totalDuration * 1000),
      };
    }
    return JSON.stringify(resObj);
  }

  async decrypt(encryptedDataRaw, skHex, hwidHex = null, telemetry = false) {
    const totalStart = performance.now();
    const parsed = JSON.parse(encryptedDataRaw);
    const ctBytes = this.hex2buf(parsed.ct);
    const payloadBytes = this.hex2buf(parsed.data);
    const macHex = parsed.mac;

    let skBytes = this.hex2buf(skHex);

    const kemStart = performance.now();
    const ss_bytes = kyber.decapsulate(ctBytes, skBytes);
    const kemDuration = performance.now() - kemStart;

    const kdfStart = performance.now();
    
    const salt = hwidHex ? this.hex2buf(hwidHex) : new Uint8Array(32);
    const prk = await this.hmacSha256Raw(salt, ss_bytes);
    
    const blended_ss = await this.hmacSha256Raw(prk, new TextEncoder().encode("dasp-identity-v3\x01"));
    const blended_ss_hex = this.buf2hex(blended_ss);

    const cipher_key = await this.sha256Bytes(new Uint8Array([...new TextEncoder().encode("cipher"), ...blended_ss]));
    const hmac_key = await this.sha256Bytes(new Uint8Array([...new TextEncoder().encode("hmac"), ...blended_ss]));
    
    const active_password_str = this.buf2hex(cipher_key);

    for (let i = 0; i < ss_bytes.length; i++) ss_bytes[i] = 0;
    const kdfDuration = performance.now() - kdfStart;

    const word_key = await this.hmacSha256Bytes(new TextEncoder().encode(active_password_str), "dasp-word-0");
    const word_key_hex = this.buf2hex(word_key);

    const macData = new Uint8Array(ctBytes.length + payloadBytes.length);
    macData.set(ctBytes, 0);
    macData.set(payloadBytes, ctBytes.length);
    const macActualBuf = await this.hmacSha256Raw(hmac_key, macData);
    const mac_tag_actual = this.buf2hex(macActualBuf);

    if (process.env.DASP_DIAGNOSTIC === '1') {
      console.error(JSON.stringify({
        diagnostics: {
          stage1_blended_ss: blended_ss_hex,
          stage2_word_key: word_key_hex,
          stage4_mac: mac_tag_actual
        }
      }));
    }

    if (mac_tag_actual !== macHex) {
      throw new Error("Integrity Check Failed");
    }

    const chain_state = await this.sha256Bytes(`dasp-chain-${active_password_str}`);
    const hash = await this.sha512Bytes(word_key_hex);
    const nextPRNG = this.createPRNG(hash);
    
    const roundKeys = new Uint32Array(128);
    for(let i=0; i<128; i++) roundKeys[i] = nextPRNG();

    const cascadeStart = performance.now();

    const nonce = new Uint8Array(chain_state);
    for (let i = 0; i < payloadBytes.length; i += 32) {
      const chunkLen = Math.min(32, payloadBytes.length - i);
      const block = new Uint8Array(32);
      block.set(nonce);
      
      this.daspCascade32(block, roundKeys);
      
      for(let j=0; j<chunkLen; j++) {
        payloadBytes[i+j] ^= block[j];
      }
      
      for(let j=0; j<32; j++) {
        nonce[j] = (nonce[j] + 1) & 0xFF;
        if(nonce[j] !== 0) break;
      }
    }

    const cascadeDuration = performance.now() - cascadeStart;

    const totalDuration = performance.now() - totalStart;
    if (telemetry) {
      console.error(JSON.stringify({
        timings: {
          kem_us: Math.round(kemDuration * 1000),
          kdf_us: Math.round(kdfDuration * 1000),
          cascade_us: Math.round(cascadeDuration * 1000),
          total_us: Math.round(totalDuration * 1000)
        }
      }));
    }

    return new TextDecoder().decode(payloadBytes);
  }
}

// --- CLI Execution ---
if (process.argv[1] && process.argv[1].endsWith('dasp.js')) {
  const args = process.argv.slice(2);
  let hwid = null;
  let diagnostic = false;
  let telemetry = false;

  const parsedArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hwid' && i + 1 < args.length) {
      let val = args[i + 1];
      if (val.startsWith('@')) {
        const fs = require('fs');
        val = fs.readFileSync(val.slice(1), 'utf-8').trim();
      }
      hwid = val;
      i++;
    } else if (args[i] === '--diagnostic') {
      process.env.DASP_DIAGNOSTIC = '1';
      diagnostic = true;
    } else if (args[i] === '--telemetry') {
      telemetry = true;
    } else {
      parsedArgs.push(args[i]);
    }
  }

  if (parsedArgs.length === 0) {
    console.log("Usage: node dasp.js <command> [args]");
    process.exit(1);
  }

  const command = parsedArgs[0];
  const crypt = new DarkstarCrypt();

  const resolveArg = (arg) => {
    if (arg && arg.startsWith('@')) {
      const fs = require('fs');
      return fs.readFileSync(arg.slice(1), 'utf-8').trim();
    }
    return arg;
  };

  (async () => {
    try {
      if (command === 'encrypt') {
        const payload = resolveArg(parsedArgs[1]);
        const pkHex = resolveArg(parsedArgs[2]);
        const res = await crypt.encrypt(payload, pkHex, hwid, telemetry);
        console.log(res);
      } else if (command === 'decrypt') {
        const data = resolveArg(parsedArgs[1]);
        const skHex = resolveArg(parsedArgs[2]);
        const res = await crypt.decrypt(data, skHex, hwid, telemetry);
        process.stdout.write(res);
      } else if (command === 'keygen') {
        const keypair = kyber.keygen();
        const pk = crypt.buf2hex(keypair.publicKey);
        const sk = crypt.buf2hex(keypair.secretKey);
        console.log(JSON.stringify({ pk, sk }));
      } else if (command === 'test') {
        const keypair = kyber.keygen();
        const pk = crypt.buf2hex(keypair.publicKey);
        const sk = crypt.buf2hex(keypair.secretKey);
        
        console.log("--- Darkstar Node Self-Test ---");
        const payload = "apple banana cherry date elderberry fig grape honeydew";
        const enc = await crypt.encrypt(payload, pk, null, telemetry);
        console.log("Encrypted!");
        const dec = await crypt.decrypt(enc, sk, null, telemetry);
        console.log(`Decrypted: '${dec}'`);
        if (dec === payload) {
          console.log("Result: PASSED");
        } else {
          console.log("Result: FAILED");
          process.exit(1);
        }
      } else {
        console.error(`Unknown command: ${command}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}
