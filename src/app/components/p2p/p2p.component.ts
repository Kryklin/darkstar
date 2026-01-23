import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../modules/material/material'; // Check path if needed
import { MatSnackBar } from '@angular/material/snack-bar';
import { P2pService, P2PMessage, Contact } from '../../services/p2p.service';

@Component({
  selector: 'app-p2p',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MaterialModule
  ],
  templateUrl: './p2p.component.html',
  styleUrls: ['./p2p.component.scss']
})
export class P2pComponent {
  newMessage = '';
  newContact = '';
  isSending = false;

  private cdr = inject(ChangeDetectorRef);
  private snackBar = inject(MatSnackBar);
  public p2pService = inject(P2pService);

  async goOnline() {
    try {
        await this.p2pService.startService(); // Throws if locked
    } catch (e: any) {
        this.snackBar.open(e.message, 'Close', { duration: 3000 });
        return;
    }

    this.p2pService.status.set('connecting');
    this.p2pService.addLog('Initializing Tor Hidden Service...');
    
    try {
      if (!window.electronAPI) throw new Error('Electron API not available');

      const address = await window.electronAPI.p2pCreateService(4200);
      this.p2pService.onionAddress.set(address);
      this.p2pService.status.set('online');
      this.p2pService.addLog(`Service Created: ${address}`);
      this.snackBar.open('You are now online on the Tor Network.', 'Close', { duration: 3000 });
    } catch (error: any) {
      console.error('P2P Error:', error);
      this.p2pService.status.set('offline');
      this.p2pService.addLog(`Error: ${error.message}`);
      this.snackBar.open('Failed to connect to Tor.', 'Close', { duration: 3000 });
    }
  }

  async goOffline() {
    await this.p2pService.stopService();
    this.snackBar.open('You are now offline.', 'Close', { duration: 3000 });
  }

  addContact() {
      if (!this.newContact) return;
      if (!this.newContact.endsWith('.onion')) {
          this.snackBar.open('Invalid Onion Address', 'Close', { duration: 2000 });
          return;
      }
      if (this.p2pService.contacts().some(c => c.onionAddress === this.newContact)) return;
      
      const contact: Contact = { onionAddress: this.newContact, name: 'Unknown Peer', status: 'unknown' };
      this.p2pService.contacts.update(c => [...c, contact]);
      this.newContact = '';
      this.p2pService.addLog(`Contact added`);
      
      this.checkContactStatus(contact);
  }

  deleteContact(contact: Contact) {
      if (!confirm(`Remove ${contact.onionAddress}?`)) return;
      this.p2pService.contacts.update(c => c.filter(x => x.onionAddress !== contact.onionAddress));
      this.p2pService.addLog(`Removed contact...`);
  }

  async checkContactStatus(contact: Contact) {
      if (!window.electronAPI) return;
      
      this.p2pService.addLog(`Checking status...`);
      try {
          const isOnline = await window.electronAPI.p2pCheckStatus(contact.onionAddress);
          this.p2pService.contacts.update(contacts => {
              return contacts.map(c => {
                  if (c.onionAddress === contact.onionAddress) {
                      return { ...c, status: isOnline ? 'online' : 'offline' };
                  }
                  return c;
              });
          });
      } catch (e) {
          console.error(e);
      }
  }

  async sendMessage(contact: Contact) {
      if (!this.newMessage || this.isSending) return;
      
      this.isSending = true; 
      const content = this.newMessage;
      this.newMessage = ''; 

      try {
           // Create, Sign, and Store locally via Service
           // This will THROW if vault is locked
           const signedMsg = await this.p2pService.addSelfMessage(content);

           // Send signed payload
           await window.electronAPI.p2pSendMessage(contact.onionAddress, signedMsg);
           this.p2pService.addLog(`Sent encrypted message.`);
      } catch (e: any) {
          console.error(e);
          this.p2pService.addLog(`Failed to send: ${e.message}`);
          this.snackBar.open(`Failed: ${e.message}`, 'Close', { duration: 3000 });
      } finally {
          this.isSending = false;
      }
  }

  copyAddress() {
    const addr = this.p2pService.onionAddress();
    if (addr) {
      navigator.clipboard.writeText(addr);
      this.snackBar.open('Address copied', 'Close', { duration: 2000 });
    }
  }
}
