import { Injectable, signal, inject, effect } from '@angular/core';
import { VaultService } from './vault';

export interface P2PMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  signature?: string;
  publicKey?: JsonWebKey;
  verified?: boolean;
  isSelf?: boolean;
}

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
}
