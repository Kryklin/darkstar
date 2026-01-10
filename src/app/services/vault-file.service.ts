import { Injectable, inject } from '@angular/core';
import { CryptService } from './crypt';
import { VaultAttachment } from './vault';

@Injectable({
  providedIn: 'root',
})
export class VaultFileService {
  private crypt = inject(CryptService);

  /**
   * Reads a File, encrypts it, and saves it to the Vault storage via IPC.
   * returns the attachment metadata.
   */
  async uploadFile(file: File, password: string): Promise<VaultAttachment> {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    // Encrypt
    const encryptedData = await this.crypt.encryptBinary(data, password);
    
    // Generate unique filename
    const ref = `${crypto.randomUUID()}.enc`;
    
    // Save to disk
    await window.electronAPI.vaultEnsureDir();
    await window.electronAPI.vaultSaveFile(ref, encryptedData);
    
    return {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      ref: ref
    };
  }

  /**
   * Reads an encrypted file from disk, decrypts it, and triggers a browser download.
   */
  async downloadFile(attachment: VaultAttachment, password: string): Promise<void> {
    // Read from disk
    const encryptedData = await window.electronAPI.vaultReadFile(attachment.ref);
    
    // Decrypt
    const decryptedData = await this.crypt.decryptBinary(encryptedData, password);
    
    // Create Blob and trigger download
    const blob = new Blob([decryptedData as unknown as BlobPart], { type: attachment.type });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Deletes the physical file from the vault storage.
   */
  async deleteFile(attachment: VaultAttachment): Promise<void> {
    await window.electronAPI.vaultDeleteFile(attachment.ref);
  }
}
