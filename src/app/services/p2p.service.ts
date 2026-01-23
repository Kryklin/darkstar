import { Injectable, signal, inject, effect } from '@angular/core';
import { VaultService } from './vault';
import { P2PMessage } from '../../shared-types';

export interface Contact {
  onionAddress: string;
  name: string;
  status: 'online' | 'offline' | 'unknown';
}

@Injectable({
  providedIn: 'root'
})
export class P2pService {
  status = signal<'offline' | 'connecting' | 'online'>('offline');
  onionAddress = signal<string | null>(null);
  logs = signal<string[]>([]);
  contacts = signal<Contact[]>([]);
  messages = signal<P2PMessage[]>([]);
  bootstrapProgress = signal<{ progress: number; summary: string }>({ progress: 0, summary: 'Initializing...' });
  
  private vaultService = inject(VaultService);

  constructor() {
    // Security: Auto-shutdown P2P if vault locks
    effect(() => {
        const unlocked = this.vaultService.isUnlocked();
        if (!unlocked && this.status() !== 'offline') {
            this.addLog('Vault locked. Stopping P2P Service for security.');
            this.stopService();
        }
    });

    if (window.electronAPI) {
        window.electronAPI.onP2PMessage(async (message: P2PMessage) => {
            // VERIFY SIGNATURE
            if (message.signature && message.publicKey) {
               const isValid = await this.vaultService.verifyResult(
                   message.content, 
                   message.signature, 
                   message.publicKey
               );
               message.verified = isValid;
            } else {
               message.verified = false;
            }
            this.addMessage(message);
        });
        
        window.electronAPI.onTorProgress((data) => {
            this.bootstrapProgress.set(data);
            if (data.progress === 100) {
               this.addLog('Tor Bootstrap Complete.');
            }
        });
    }
  }

  async startService() {
    if (!this.vaultService.isUnlocked()) {
        throw new Error('Vault must be unlocked to start P2P services.');
    }
    
    // We can rely on component to call p2pCreateService for now, or move it here. 
    // For now, checking vault status is the priority.
  }

  async stopService() {
      const onion = this.onionAddress();
      if (onion && window.electronAPI) {
          await window.electronAPI.p2pStopService(onion);
          this.status.set('offline');
          this.onionAddress.set(null);
          this.addLog('Service stopped.');
      }
  }

  addMessage(message: P2PMessage) {
      this.messages.update(msgs => {
          // Dedup
          if (msgs.some(m => m.id === message.id)) return msgs;
          return [...msgs, message];
      });
      if (!message.isSelf) {
        this.addLog(`Received message from ${message.sender}`);
      }
  }

   addLog(log: string) {
       this.logs.update(logs => [`[${new Date().toLocaleTimeString()}] ${log}`, ...logs]);
   }

   async addSelfMessage(content: string) {
       if (!this.vaultService.isUnlocked()) {
           throw new Error('Vault locked. Cannot sign message.');
       }
       
       const signature = await this.vaultService.signMessage(content);
       const publicKey = await this.vaultService.getPublicKey();

       const msg: P2PMessage = {
           id: crypto.randomUUID(),
           sender: 'Me',
           content,
           timestamp: Date.now(),
           signature,
           publicKey,
           verified: true,
           isSelf: true
       };
       this.addMessage(msg);
       return msg; // Return for sending
   }

   async sendFile(onionAddress: string, file: File) {
      const fileId = crypto.randomUUID();
      const chunkSize = 16 * 1024; // 16KB chunks to be safe with Tor latency/reliability
      const totalChunks = Math.ceil(file.size / chunkSize);
      
      const publicKey = await this.vaultService.getPublicKey(); // Identity for file transfer
      
      this.addLog(`Starting file transfer: ${file.name} (${totalChunks} chunks) to ${onionAddress}`);

      // 1. Send FILE_START
      const startMsg: P2PMessage = {
          id: crypto.randomUUID(),
          type: 'FILE_START',
          sender: 'Me', // In a real app we might use a specialized alias
          content: 'FILE_START', 
          timestamp: Date.now(),
          publicKey,
          fileId,
          fileName: file.name,
          totalChunks
      };
      await window.electronAPI.p2pSendMessage(onionAddress, startMsg);

      // 2. Stream Chunks
      let offset = 0;
      for (let i = 0; i < totalChunks; i++) {
          const slice = file.slice(offset, offset + chunkSize);
          const buffer = await slice.arrayBuffer();
          const base64 = this.arrayBufferToBase64(buffer);
          
          const chunkMsg: P2PMessage = {
              id: crypto.randomUUID(), // New ID for each chunk message
              type: 'FILE_CHUNK',
              sender: 'Me',
              content: 'FILE_CHUNK',
              timestamp: Date.now(),
              fileId,
              chunkIndex: i,
              chunkData: base64
          };
          
          await window.electronAPI.p2pSendMessage(onionAddress, chunkMsg);
          offset += chunkSize;
          
          // Optional: Delay to prevent clogging IPC/Tor?
          // await new Promise(r => setTimeout(r, 10)); 
      }

      // 3. Send FILE_END
      const endMsg: P2PMessage = {
          id: crypto.randomUUID(),
          type: 'FILE_END',
          sender: 'Me',
          content: 'FILE_END',
          timestamp: Date.now(),
          fileId
      };
      await window.electronAPI.p2pSendMessage(onionAddress, endMsg);
      this.addLog(`File transfer complete: ${file.name}`);
   }

   private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
