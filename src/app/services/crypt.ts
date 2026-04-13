import { Injectable } from '@angular/core';

export interface DecryptionResult {
  decrypted: string;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Core cryptographic service for the Darkstar security suite.
 * Implements the definitive D-KASP protocol with hardware binding and performance optimization.
 */
export class CryptService {
  /** Recommended iteration count for PBKDF2 standard layers. */
  public PBKDF2_ITERATIONS = 600000;

  private readonly SALT_SIZE_BYTES = 128 / 8;

  /**
   * Asynchronous AES-256-GCM encryption.
   * Prevents padding oracle attacks via AEAD.
   */
  async encryptAES256GCMAsync(data: string, password: string, iterations: number): Promise<string> {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(this.SALT_SIZE_BYTES));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

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
   * Asynchronous AES-256-GCM decryption.
   */
  async decryptAES256GCMAsync(transitmessage: string, password: string, iterations: number): Promise<string> {
    try {
      const saltHex = transitmessage.substr(0, 32);
      const ivHex = transitmessage.substr(32, 24);
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
      console.error('Decryption failure: Invalid Password or Corrupted Payload.', error);
      return '';
    }
  }

  /**
   * Encrypts binary data (Uint8Array) directly using AES-256-CBC.
   */
  async encryptBinary(data: Uint8Array, password: string): Promise<Uint8Array> {
    const salt = window.crypto.getRandomValues(new Uint8Array(this.SALT_SIZE_BYTES));
    const iv = window.crypto.getRandomValues(new Uint8Array(16));

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.PBKDF2_ITERATIONS,
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
    const iv = payload.slice(this.SALT_SIZE_BYTES, this.SALT_SIZE_BYTES + 16);
    const ciphertext = payload.slice(this.SALT_SIZE_BYTES + 16);

    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']);

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.PBKDF2_ITERATIONS,
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

  private buf2hex(buffer: ArrayBuffer | Uint8Array): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hex2buf(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
  }

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
   * Encrypts a mnemonic phrase using the D-KASP External Engine via IPC.
   * Performs advanced structural permutation and hardware binding.
   */
  async encrypt(mnemonic: string, keyMaterial: string, hwid?: string): Promise<{ encryptedData: string; reverseKey: string }> {
    const engine = localStorage.getItem('dkasp_engine') || 'rust';
    const result = (await window.electronAPI.dKaspEncrypt(mnemonic, keyMaterial, engine, hwid)) as { encryptedData: string, reverseKey: string };
    return {
      encryptedData: result.encryptedData,
      reverseKey: result.reverseKey,
    };
  }

  /**
   * Decrypts and de-obfuscates an encrypted mnemonic payload via IPC.
   */
  async decrypt(encryptedDataRaw: string, reverseKey: string, passwordOrSk: string, hwid?: string): Promise<DecryptionResult> {
    const engine = localStorage.getItem('dkasp_engine') || 'rust';
    let decrypted = await window.electronAPI.dKaspDecrypt(encryptedDataRaw, reverseKey, passwordOrSk, engine, hwid);
    
    if (typeof decrypted !== 'string') {
        decrypted = JSON.stringify(decrypted);
    }

    return {
      decrypted: decrypted as string
    };
  }
}
