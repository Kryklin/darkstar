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

  /**
   * Asynchronous AES-256-GCM encryption (V3).
   * Implements Authenticated Encryption with Associated Data (AEAD) to prevent padding oracle attacks.
   * @param {string} data Plaintext to encrypt.
   * @param {string} password Secret passphrase.
   * @param {number} iterations PBKDF2 iteration count.
   * @returns {Promise<string>} Hex-encoded Salt + IV + Base64 ciphertext (including auth tag).
   */
  async encryptAES256GCMAsync(data: string, password: string, iterations: number): Promise<string> {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(this.SALT_SIZE_BYTES));
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // GCM standard IV size is 12 bytes (96 bits)

    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );

    const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(data));

    return this.buf2hex(salt) + this.buf2hex(iv) + this.buf2base64(encrypted);
  }

  /**
   * Asynchronous AES-256-GCM decryption (V3).
   * Verifies data integrity implicitly via AEAD auth tag.
   * @param {string} transitmessage Combined payload string.
   * @param {string} password Secret passphrase.
   * @param {number} iterations PBKDF2 iteration count.
   * @returns {Promise<string>} Decrypted plaintext.
   */
  async decryptAES256GCMAsync(transitmessage: string, password: string, iterations: number): Promise<string> {
    try {
      const saltHex = transitmessage.substr(0, 32);
      const ivHex = transitmessage.substr(32, 24); // 12 bytes = 24 hex chars
      const encryptedBase64 = transitmessage.substring(56);

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
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
      );

      const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, encryptedBytes);

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Async GCM Decryption failure: Invalid Password or Corrupted Auth Tag.', error);
      return '';
    }
  }

  /**
   * Encrypts binary data (Uint8Array) directly using AES-256-CBC.
   * Returns a combined Uint8Array: [Salt(16) | IV(16) | Ciphertext(...)].
   */
  async encryptBinary(data: Uint8Array, password: string): Promise<Uint8Array> {
    const salt = window.crypto.getRandomValues(new Uint8Array(this.SALT_SIZE_BYTES));
    const iv = window.crypto.getRandomValues(new Uint8Array(this.IV_SIZE_BYTES));

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.ITERATIONS_V2,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-CBC', length: 256 },
      false,
      ['encrypt'],
    );

    const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv }, key, data as unknown as BufferSource);
    const encryptedBytes = new Uint8Array(encrypted);

    const result = new Uint8Array(salt.length + iv.length + encryptedBytes.length);
    result.set(salt, 0);
    result.set(iv, salt.length);
    result.set(encryptedBytes, salt.length + iv.length);

    return result;
  }

  /**
   * Decrypts a binary payload (Salt+IV+Ciphertext).
   */
  async decryptBinary(payload: Uint8Array, password: string): Promise<Uint8Array> {
    const salt = payload.slice(0, this.SALT_SIZE_BYTES);
    const iv = payload.slice(this.SALT_SIZE_BYTES, this.SALT_SIZE_BYTES + this.IV_SIZE_BYTES);
    const ciphertext = payload.slice(this.SALT_SIZE_BYTES + this.IV_SIZE_BYTES);

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.ITERATIONS_V2,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-CBC', length: 256 },
      false,
      ['decrypt'],
    );

    const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv }, key, ciphertext);
    return new Uint8Array(decrypted);
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
   * Encrypts a mnemonic phrase using the D-KASP-512 External Engine via IPC.
   * Extracted out to high-performance localized binaries (Rust/Go/Node).
   * @param {string} mnemonic The space-separated recovery phrase.
   * @param {string} keyMaterial The user-defined master password (legacy) or PK hex (V5).
   * @param {number} version The protocol version (default 8).
   * @returns {Promise<{ encryptedData: string; reverseKey: string }>} JSON envelope + B64 packed key.
   */
  async encrypt(mnemonic: string, keyMaterial: string, version: number = 8): Promise<{ encryptedData: string; reverseKey: string }> {
    const engine = localStorage.getItem('dkasp_engine') || 'rust';
    const result = (await window.electronAPI.dKaspEncrypt(mnemonic, keyMaterial, engine, version)) as { encryptedData: string, reverseKey: string };
    return {
      encryptedData: result.encryptedData,
      reverseKey: result.reverseKey,
    };
  }

  /**
   * Decrypts and de-obfuscates an encrypted mnemonic payload via IPC.
   * Auto-identifies protocol version (V1-V5).
   * @param {string} encryptedDataRaw The ciphertext string or JSON envelope.
   * @param {string} reverseKey The functional map required for de-obfuscation.
   * @param {string} passwordOrSk The master password or SK hex (V5).
   * @param {number} version Optional protocol version override.
   * @returns {Promise<DecryptionResult>} Decrypted phrase and legacy flag.
   */
  async decrypt(encryptedDataRaw: string, reverseKey: string, passwordOrSk: string, version?: number): Promise<DecryptionResult> {
    let isLegacy = true;
    let v = version;

    try {
      if (encryptedDataRaw.trim().startsWith('{')) {
        const parsed = JSON.parse(encryptedDataRaw);
        v = v || parsed.v;
        if (parsed.v >= 5) {
          isLegacy = false;
        }
      }
    } catch {
      // Ignore parse errors, legacy data might not be JSON
    }

    const engine = localStorage.getItem('dkasp_engine') || 'rust';
    const decrypted = (await window.electronAPI.dKaspDecrypt(encryptedDataRaw, reverseKey, passwordOrSk, engine, v || 8)) as string;
    
    return {
      decrypted,
      isLegacy,
    };
  }
}
