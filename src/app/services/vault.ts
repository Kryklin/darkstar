import { Injectable, signal, inject, computed } from '@angular/core';
import { CryptService } from './crypt';

export interface VaultNote {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

interface VaultStorage {
  v: number;
  data: string; // Encrypted blob (salt + iv + ciphertext)
  s?: boolean; // isSafeStorageUsed
}

/**
 * Service responsible for managing the Secure Vault.
 * Implements a session-based Zero-Knowledge architecture with optional hardware-bound OS-level encryption.
 */
@Injectable({
  providedIn: 'root',
})
export class VaultService {
  private crypt = inject(CryptService);
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

  /**
   * Initializes a new vault with a master password.
   * @param {string} password The user-defined password for the primary encryption layer.
   * @throws Will throw if initial storage persistent fails.
   */
  async createVault(password: string): Promise<void> {
    try {
      this.masterKey.set(password);
      this.notes.set([]); // Start empty
      await this.save();
      this.error.set(null);
    } catch (e) {
      console.error('Vault Initialization Error:', e);
      this.error.set('Failed to initialize local vault storage.');
      throw e;
    }
  }

  /**
   * Attempts to decrypt and unlock the vault using the multi-layered security model.
   * 1. OS-Level Decryption (if SafeStorage was used).
   * 2. AES-256 Decryption using the master password.
   * @param {string} password The master password to attempt unlock.
   * @returns {Promise<boolean>} Resolves to true if unlock was successful.
   */
  async unlock(password: string): Promise<boolean> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) throw new Error('No vault storage container detected.');

      const envelope: VaultStorage = JSON.parse(raw);
      let encryptedData = envelope.data;

      /**
       * Primary Layer: Hardware-Bound Protection
       * If 's' flag is true, data was encrypted using the host machine's native security entropy.
       */
      if (envelope.s && window.electronAPI) {
        try {
          encryptedData = await window.electronAPI.safeStorageDecrypt(encryptedData);
        } catch (e) {
          console.error('Hardware Decryption Failure:', e);
          this.error.set('Security Mismatch: This vault is locked to another device or OS user account.');
          return false;
        }
      }

      /**
       * Secondary Layer: Standard AES-256
       * Decrypt the data using the master password and 600,000 PBKDF2 iterations.
       */
      let jsonStr = '';
      if (envelope.v === 2) {
        jsonStr = await this.crypt.decryptAES256Async(encryptedData, password, this.crypt.ITERATIONS_V2);
      } else {
        throw new Error('Unsupported vault format version.');
      }

      if (!jsonStr) throw new Error('Password mismatch or corrupted data.');

      const notes: VaultNote[] = JSON.parse(jsonStr);

      this.masterKey.set(password);
      this.notes.set(notes);
      this.error.set(null);
      return true;
    } catch (e) {
      console.error('Vault Access Error:', e);
      this.lock();
      this.error.set('Authentication failed or vault state is invalid.');
      return false;
    }
  }

  /**
   * Immediately clears the master key and decrypted notes from memory.
   */
  lock() {
    this.masterKey.set(null);
    this.notes.set([]);
  }

  /**
   * Encrypts and persists the current vault state to local storage.
   * Automatically applies available hardware-bound protection layers.
   */
  async save(): Promise<void> {
    const key = this.masterKey();
    if (!key) throw new Error('Access Denied: Vault must be unlocked to persist changes.');

    const notesData = JSON.stringify(this.notes());
    let encrypted = await this.crypt.encryptAES256Async(notesData, key, this.crypt.ITERATIONS_V2);

    /**
     * Optional Layer: OS-Specific SafeStorage
     * Enhances security by binding the blob to the specific machine/user.
     */
    let isSafeStorageUsed = false;
    if (window.electronAPI?.safeStorageAvailable) {
      try {
        const available = await window.electronAPI.safeStorageAvailable();
        if (available) {
          encrypted = await window.electronAPI.safeStorageEncrypt(encrypted);
          isSafeStorageUsed = true;
        }
      } catch (e) {
        console.warn('System-level storage protection unavailable, defaulting to standard encryption.', e);
      }
    }

    const envelope: VaultStorage = {
      v: 2,
      data: encrypted,
      s: isSafeStorageUsed,
    };

    localStorage.setItem(this.storageKey, JSON.stringify(envelope));
  }

  /**
   * Adds a new note to the vault and triggers an asynchronous save.
   * @param {string} title The display title for the note.
   * @param {string} content The secure content of the note.
   */
  addNote(title: string, content: string) {
    const newNote: VaultNote = {
      id: crypto.randomUUID(),
      title,
      content,
      updatedAt: Date.now(),
    };
    this.notes.update((n) => [newNote, ...n]);
    this.save();
  }

  /**
   * Updates an existing note.
   * @param {string} id The UUID of the note to update.
   * @param {string} title New title.
   * @param {string} content New content.
   */
  updateNote(id: string, title: string, content: string) {
    this.notes.update((n) => n.map((note) => (note.id === id ? { ...note, title, content, updatedAt: Date.now() } : note)));
    this.save();
  }

  /**
   * Removes a note from the vault.
   * @param {string} id The UUID of the note to delete.
   */
  deleteNote(id: string) {
    this.notes.update((n) => n.filter((note) => note.id !== id));
    this.save();
  }

  /**
   * Completely destroys the local vault storage.
   * WARN: This action is irreversible.
   */
  deleteVault() {
    localStorage.removeItem(this.storageKey);
    this.lock();
  }
}
