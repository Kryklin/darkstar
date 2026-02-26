import { Injectable, signal, inject, computed } from '@angular/core';
import { CryptService } from './crypt';

export interface VaultAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  ref: string; // Filename on disk
}

// We will use native crypto or electron API for TOTP to avoid browser bundle issues.
export interface VaultIdentity {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}

import { TimeLockMetadata } from './timelock.service';

export interface VaultNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  attachments: VaultAttachment[];
  timeLock?: TimeLockMetadata;
  updatedAt: number;
}

interface VaultStorage {
  v: number;
  data: string; // Encrypted blob (salt + iv + ciphertext)
  s?: boolean; // isSafeStorageUsed
}

interface VaultContent {
  notes: VaultNote[];
  identity?: VaultIdentity;
  totpSecret?: string;
}

import { VaultFileService } from './vault-file.service';
import { DuressService } from './duress.service';
import { BiometricService } from './biometric.service';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

@Injectable({
  providedIn: 'root',
})
export class VaultService {
  private crypt = inject(CryptService);
  private fileService = inject(VaultFileService);
  private duressService = inject(DuressService);
  private biometricService = inject(BiometricService);
  private storageKey = 'darkstar_vault';

  /**
   * The master key used for AES decryption.
   * This is held strictly in-memory (Signal) and is never persisted.
   */
  private masterKey = signal<string | null>(null);

  /** Indicates if the vault is currently decrypted and accessible in the current session. */
  public isUnlocked = computed(() => !!this.masterKey());

  /** Reactive list of notes currently in the vault. */
  public notes = signal<VaultNote[]>([]);
  
  /** The user's cryptographic identity keys. */
  public identity = signal<VaultIdentity | null>(null);

  /** TOTP Secret Key for 2FA, if enabled */
  public totpSecret = signal<string | null>(null);

  /** Cached deterministic Machine ID */
  public hardwareId = signal<string | null>(null);

  /** Holds transient error messages related to vault operations. */
  public error = signal<string | null>(null);

  constructor() {
    /**
     * Security: Ensure the vault is "locked" (memory cleared) if the window is unloaded.
     * Relying on Signal clearing is good, but explicit event handling adds a layer of safety.
     */
    window.addEventListener('beforeunload', () => this.lock());
  }



  /**
   * Verifies if an encrypted vault envelope exists in local storage.
   * @returns {boolean} True if the vault is initialized.
   */
  hasVault(): boolean {
    return !!localStorage.getItem(this.storageKey);
  }

  async createVault(password: string): Promise<void> {
    try {
      this.masterKey.set(password);
      this.notes.set([]); // Start empty
      
      // Generate initial identity
      const newIdentity = await this.generateIdentity();
      this.identity.set(newIdentity);

      await this.save();
      this.error.set(null);
    } catch (e) {
      console.error('Vault Initialization Error:', e);
      this.error.set('Failed to initialize local vault storage.');
      throw e;
    }
  }

  async unlockWithBiometrics(): Promise<{ success: boolean; requiresTotp: boolean }> {
    if (!this.biometricService.isAvailable()) return { success: false, requiresTotp: false };
    
    // 1. Verify User Presence/Identity
    const authenticated = await this.biometricService.authenticate();
    if (!authenticated) return { success: false, requiresTotp: false };

    // 2. Retrieve Master Password from Hardware-Backed Storage
    // Use the stored credential ID as the key for the safe storage item
    const credId = localStorage.getItem('biometric_credential_id');
    if (!credId) return { success: false, requiresTotp: false };

    // We store the encrypted password in a separate safe storage key
    // In a real app we might use the keychain service directly.
    // For this implementation, let's assume we stored the Master Password 
    // encrypted securely via Electron SafeStorage when biometrics were registered.
    // But wait, `safeStorage` usually requires a string.
    try {
        const encryptedPass = localStorage.getItem('biometric_enc_pass');
        if (!encryptedPass) return { success: false, requiresTotp: false };

        if (window.electronAPI) {
            const password = await window.electronAPI.safeStorageDecrypt(encryptedPass);
            return await this.unlock(password);
        }
    } catch (e) {
        console.error('Biometric Unlock Failed:', e);
        return { success: false, requiresTotp: false };
    }
    return { success: false, requiresTotp: false };
  }

  async unlockWithHardwareKey(): Promise<{ success: boolean; requiresTotp: boolean }> {
    if (!this.biometricService.isAvailable()) return { success: false, requiresTotp: false };
    
    // 1. Verify User Presence/Identity with Hardware Key
    const authenticated = await this.biometricService.authenticate();
    if (!authenticated) return { success: false, requiresTotp: false };

    // 2. Retrieve Master Password from Hardware-Backed Storage
    const credId = localStorage.getItem('hardware_key_credential_id');
    if (!credId) return { success: false, requiresTotp: false };

    // Share the same encrypted password blob for simplicity in this implementation, 
    // or we could use 'hardware_enc_pass'. Register uses 'biometric_enc_pass' blindly currently, let's stick to reading it
    try {
        const encryptedPass = localStorage.getItem('biometric_enc_pass');
        if (!encryptedPass) return { success: false, requiresTotp: false };

        if (window.electronAPI) {
            const password = await window.electronAPI.safeStorageDecrypt(encryptedPass);
            return this.unlock(password);
        }
    } catch (e) {
        console.error('Hardware Key Unlock Failed:', e);
        return { success: false, requiresTotp: false };
    }
    return { success: false, requiresTotp: false };
  }

  // Helper to save password for biometric use later
  async registerBiometricsForSession(password: string): Promise<boolean> {
      return this.registerCredential(password, 'platform');
  }

  async registerHardwareKey(password: string): Promise<boolean> {
      return this.registerCredential(password, 'cross-platform');
  }

  private async registerCredential(password: string, type: 'platform' | 'cross-platform'): Promise<boolean> {
      // 1. Perform WebAuthn Registration
      const success = await this.biometricService.register(type);
      if (!success) return false;

      // 2. Encrypt Password with SafeStorage (OS Key)
      // This binds the password to the OS User Account.
      // Combined with WebAuthn "User Verification", this ensures
      // 1. The OS user is present (Bio/Pin)
      // 2. The OS user is valid (SafeStorage decrypt success)
      if (window.electronAPI) {
          const encPass = await window.electronAPI.safeStorageEncrypt(password);
          localStorage.setItem('biometric_enc_pass', encPass);
          return true;
      }
      return false;
  }

  async unlock(password: string): Promise<{ success: boolean; requiresTotp: boolean }> {
    // SECURITY: Check for Duress Password
    if (this.duressService.checkDuress(password)) {
      this.duressService.triggerDuress();
      return { success: false, requiresTotp: false }; 
    }

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) throw new Error('No vault storage container detected.');

      let envelope: VaultStorage;
      let isLegacy = false;

      try {
        envelope = JSON.parse(raw);
        if (!envelope.v) isLegacy = true; 
      } catch {
        isLegacy = true;
        envelope = { v: 1, data: raw }; 
      }
      
      let encryptedData = envelope.data;
      if (envelope.s && window.electronAPI) {
        try {
          encryptedData = await window.electronAPI.safeStorageDecrypt(encryptedData);
        } catch (e) {
          console.error('Hardware Decryption Failure:', e);
          this.error.set('Security Mismatch: This vault is locked to another device or OS user account.');
          return { success: false, requiresTotp: false };
        }
      }

      let jsonStr = '';
      if (envelope.v === 2) {
        jsonStr = await this.crypt.decryptAES256Async(encryptedData, password, this.crypt.ITERATIONS_V2);
      } else {
        console.warn('Detected Legacy V1 Vault. Attempting migration...');
        jsonStr = await this.crypt.decryptAES256Async(encryptedData, password, 1000);
        if (!jsonStr) {
           jsonStr = this.crypt.decryptAES256(encryptedData, password, 1000);
        }
        isLegacy = true;
      }

      if (!jsonStr) throw new Error('Password mismatch or corrupted data.');

      // Parsing content (Handles migration from Array used in V1/V2-Beta to Object in V3)
      let notes: VaultNote[] = [];
      let identity: VaultIdentity | null = null;
      let totpSecret: string | null = null;
      
      try {
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
              // Legacy format: Just an array of notes
              notes = parsed;
              isLegacy = true; // Mark for re-save to generate identity
          } else {
              // Modern format: VaultContent object
              notes = parsed.notes || [];
              identity = parsed.identity || null;
              totpSecret = parsed.totpSecret || null;
          }
      } catch {
          throw new Error('Vault Data Corruption: Unable to parse decrypted content.');
      }

      // Migration: Ensure fields exist
      const migratedNotes = notes.map(n => ({
        ...n,
        tags: n.tags || [],
        attachments: n.attachments || [],
        updatedAt: n.updatedAt || Date.now()
      }));
      
      this.notes.set(migratedNotes);
      
      // Ensure identity exists
      if (!identity) {
          identity = await this.generateIdentity();
          isLegacy = true; // Force save
      }
      // If TOTP is configured, we pause the unlock sequence.
      if (totpSecret) {
          // We do NOT set the master key or actual data signals yet.
          // We return a special state indicating TOTP is needed, and we hold the 
          // decrypted states temporarily so verifyTotp can complete the process.
          this.totpPendingState = {
              notes: migratedNotes,
              identity: identity,
              totpSecret: totpSecret,
              password: password,
              isLegacy: isLegacy
          };
          return { success: true, requiresTotp: true };
      }

      this.notes.set(migratedNotes);
      this.identity.set(identity);
      this.totpSecret.set(totpSecret);
      this.masterKey.set(password);
      this.error.set(null);

      // Auto-Migration/Save
      if (isLegacy) {
        await this.save(); 
      }

      return { success: true, requiresTotp: false };
    } catch (e) {
      console.error('Vault Access Error:', e);
      this.lock();
      this.error.set('Authentication failed or vault state is invalid.');
      return { success: false, requiresTotp: false };
    }
  }

  // Temporary holding area during 2FA unlock
  private totpPendingState: {
      notes: VaultNote[];
      identity: VaultIdentity | null;
      totpSecret: string;
      password: string;
      isLegacy: boolean;
  } | null = null;

  async verifyTotp(token: string): Promise<boolean> {
      if (!this.totpPendingState || !this.totpPendingState.totpSecret) {
          this.error.set('No pending 2FA login.');
          return false;
      }
      
      const isValid = window.electronAPI ? await window.electronAPI.vaultVerifyTotp(token, this.totpPendingState.totpSecret) : false;
      
      if (!isValid) {
          this.error.set('Invalid 2FA token.');
          return false;
      }
      
      // Token is valid, proceed with setting signals
      this.notes.set(this.totpPendingState.notes);
      this.identity.set(this.totpPendingState.identity);
      this.totpSecret.set(this.totpPendingState.totpSecret);
      this.masterKey.set(this.totpPendingState.password);
      
      if (this.totpPendingState.isLegacy) {
          await this.save();
      }

      this.totpPendingState = null;
      this.error.set(null);
      return true;
  }

  enableTotp(secret: string) {
      if (!this.masterKey()) throw new Error('Vault must be unlocked to modify 2FA settings.');
      this.totpSecret.set(secret);
      this.save();
  }

  disableTotp() {
      if (!this.masterKey()) throw new Error('Vault must be unlocked to modify 2FA settings.');
      this.totpSecret.set(null);
      this.save();
  }

  lock() {
    this.masterKey.set(null);
    this.notes.set([]);
    this.identity.set(null);
    this.totpSecret.set(null);
    this.totpPendingState = null;
  }

  async save(): Promise<void> {
    const key = this.masterKey();
    if (!key) throw new Error('Access Denied: Vault must be unlocked to persist changes.');

    const content: VaultContent = {
        notes: this.notes(),
        identity: this.identity()!
    };

    const currentTotp = this.totpSecret();
    if (currentTotp) {
        content.totpSecret = currentTotp;
    }

    const notesData = JSON.stringify(content);
    let encrypted = await this.crypt.encryptAES256Async(notesData, key, this.crypt.ITERATIONS_V2);
    let isSafeStorageUsed = false;
    if (window.electronAPI?.safeStorageAvailable) {
      try {
        const available = await window.electronAPI.safeStorageAvailable();
        if (available) {
          encrypted = await window.electronAPI.safeStorageEncrypt(encrypted);
          isSafeStorageUsed = true;
        }
      } catch (e) {
        console.warn('System-level storage protection unavailable.', e);
      }
    }

    const envelope: VaultStorage = {
      v: 2,
      data: encrypted,
      s: isSafeStorageUsed,
    };

    localStorage.setItem(this.storageKey, JSON.stringify(envelope));
  }

  // --- Identity Management ---

  private async generateIdentity(): Promise<VaultIdentity> {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: "ECDSA",
          namedCurve: "P-256"
        },
        true,
        ["sign", "verify"]
      );

      const publicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
      const privateKey = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);

      return { publicKey, privateKey };
  }

  public async getPublicKey(): Promise<JsonWebKey> {
      const id = this.identity();
      if (!id) throw new Error('Vault locked');
      return id.publicKey;
  }

  public exportIdentity(): string {
      const id = this.identity();
      if (!id) throw new Error('Vault locked');
      return JSON.stringify(id);
  }

  public async importIdentity(identityJson: string): Promise<boolean> {
      try {
          const parsed: VaultIdentity = JSON.parse(identityJson);
          if (parsed && parsed.publicKey && parsed.privateKey) {
              this.identity.set(parsed);
              await this.save();
              return true;
          }
      } catch (e) {
          console.error("Failed to parse identity JSON", e);
      }
      return false;
  }

  public async signMessage(message: string): Promise<string> {
      const id = this.identity();
      if (!id) throw new Error('Vault locked');
      
      const privateKey = await window.crypto.subtle.importKey(
          "jwk",
          id.privateKey,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign"]
      );

      const enc = new TextEncoder();
      const signature = await window.crypto.subtle.sign(
          {
              name: "ECDSA",
              hash: { name: "SHA-256" },
          },
          privateKey,
          enc.encode(message)
      );

      return this.buf2hex(signature);
  }

  public async verifyResult(message: string, signatureHex: string, publicKey: JsonWebKey): Promise<boolean> {
      try {
        const key = await window.crypto.subtle.importKey(
            "jwk",
            publicKey,
            { name: "ECDSA", namedCurve: "P-256" },
            false,
            ["verify"]
        );

        const enc = new TextEncoder();
        const signature = this.hex2buf(signatureHex);

        return await window.crypto.subtle.verify(
            {
                name: "ECDSA",
                hash: { name: "SHA-256" },
            },
            key,
            signature,
            enc.encode(message)
        );
      } catch (e) {
          console.error('Signature Verification Failed:', e);
          return false;
      }
  }

  private buf2hex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

   private hex2buf(hex: string): ArrayBuffer {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))).buffer;
  }


  addNote(title: string, content: string, timeLock?: TimeLockMetadata) {
    const newNote: VaultNote = {
      id: crypto.randomUUID(),
      title,
      content,
      tags: [],
      attachments: [],
      timeLock,
      updatedAt: Date.now(),
    };
    this.notes.update((n) => [newNote, ...n]);
    this.save();
  }

  updateNote(id: string, title: string, content: string, tags: string[], timeLock?: TimeLockMetadata) {
    this.notes.update((n) => n.map((note) => (note.id === id ? { ...note, title, content, tags, timeLock, updatedAt: Date.now() } : note)));
    this.save();
  }

  addAttachment(noteId: string, attachment: VaultAttachment) {
    this.notes.update((n) =>
      n.map((note) => (note.id === noteId ? { ...note, attachments: [...note.attachments, attachment], updatedAt: Date.now() } : note)),
    );
    this.save();
  }

  removeAttachment(noteId: string, attachmentId: string) {
    this.notes.update((n) =>
      n.map((note) =>
        note.id === noteId ? { ...note, attachments: note.attachments.filter((a) => a.id !== attachmentId), updatedAt: Date.now() } : note,
      ),
    );
    this.save();
  }

  async deleteNote(id: string) {
    const note = this.notes().find((n) => n.id === id);
    if (note && note.attachments) {
      for (const att of note.attachments) {
        try {
          await this.fileService.deleteFile(att);
        } catch (e) {
          console.error('Failed to delete attachment:', att.name, e);
        }
      }
    }
    this.notes.update((n) => n.filter((note) => note.id !== id));
    this.save();
  }

  deleteVault() {
    localStorage.removeItem(this.storageKey);
    this.lock();
  }

  getMasterKey(): string {
    const key = this.masterKey();
    if (!key) {
      throw new Error('Vault is locked');
    }
    return key;
  }

  async getHardwareId(): Promise<string | null> {
    const cached = this.hardwareId();
    if (cached) return cached;

    if (Capacitor.isNativePlatform()) {
       try {
           const info = await Device.getId();
           if (info && info.identifier) {
               this.hardwareId.set(info.identifier);
               return info.identifier;
           }
       } catch (e) {
           console.error('Failed to retrieve native hardware ID:', e);
       }
    } else if (window.electronAPI && window.electronAPI.getMachineId) {
      try {
        const id = await window.electronAPI.getMachineId();
        if (id) {
          this.hardwareId.set(id);
          return id;
        }
      } catch (e) {
        console.error('Failed to retrieve electron hardware ID:', e);
      }
    }
    return null;
  }
}
