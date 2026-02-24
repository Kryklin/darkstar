import { Component, ElementRef, ViewChild, Output, EventEmitter, inject, OnInit, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CryptService } from '../../../services/crypt';
import { VaultService } from '../../../services/vault';
import { MatIconModule } from '@angular/material/icon';
import packageJson from '../../../../../package.json';

interface TerminalLine {
  text: string;
  isCommand: boolean;
  isError?: boolean;
  isSuccess?: boolean;
}

@Component({
  selector: 'app-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './terminal.html',
  styleUrls: ['./terminal.scss']
})
export class TerminalComponent implements OnInit, AfterViewChecked {
  @Output() terminalClosed = new EventEmitter<void>();
  @ViewChild('terminalInput') terminalInput!: ElementRef<HTMLInputElement>;
  @ViewChild('terminalBody') terminalBody!: ElementRef<HTMLDivElement>;

  cryptService = inject(CryptService);
  vaultService = inject(VaultService);

  version = packageJson.version;
  isVisible = false;
  isMaximized = true; // start maximized as requested
  currentInput = '';
  history: TerminalLine[] = [];
  commandHistory: string[] = [];
  historyIndex = -1;

  ngOnInit() {
    this.isVisible = true;
    setTimeout(() => this.focusInput(), 100);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  closeTerminal() {
    this.isVisible = false;
    setTimeout(() => {
      this.terminalClosed.emit();
    }, 300); // Wait for transition
  }

  toggleMaximize() {
    this.isMaximized = !this.isMaximized;
    setTimeout(() => this.focusInput(), 50);
  }

  minimizeTerminal() {
    // Treat minimize as close to simply hide the console from the screen
    this.closeTerminal();
  }

  focusInput(event?: Event) {
    if (event) event.stopPropagation();
    if (this.terminalInput) {
      this.terminalInput.nativeElement.focus();
    }
  }

  private scrollToBottom() {
    if (this.terminalBody) {
      try {
        this.terminalBody.nativeElement.scrollTop = this.terminalBody.nativeElement.scrollHeight;
      } catch {
        // ignore scroll errors
      }
    }
  }

  async handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const command = this.currentInput.trim();
      this.currentInput = '';
      
      if (command) {
        this.history.push({ text: command, isCommand: true });
        this.commandHistory.push(command);
        this.historyIndex = this.commandHistory.length;
        await this.processCommand(command);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.currentInput = this.commandHistory[this.historyIndex];
      }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.currentInput = this.commandHistory[this.historyIndex];
      } else {
        this.historyIndex = this.commandHistory.length;
        this.currentInput = '';
      }
    } else if (event.key === 'c' && event.ctrlKey) {
      // Ctrl+C cancellation
      this.history.push({ text: this.currentInput + '^C', isCommand: true });
      this.currentInput = '';
    }
  }

  private async processCommand(commandLine: string) {
    const args = commandLine.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();

    switch (cmd) {
      case 'help':
        this.history.push({ text: 'Available commands:', isCommand: false });
        this.history.push({ text: '  help      - Show this message', isCommand: false });
        this.history.push({ text: '  clear     - Clear terminal screen', isCommand: false });
        this.history.push({ text: '  whoami    - Display current user context', isCommand: false });
        this.history.push({ text: '  identity  - Display loaded cryptographic identity', isCommand: false });
        this.history.push({ text: '  encrypt   - Obfuscate text (encrypt <message>)', isCommand: false });
        this.history.push({ text: '  decrypt   - De-obfuscate text (decrypt <payload> <reverseKey>)', isCommand: false });
        this.history.push({ text: '  exit/quit - Close terminal', isCommand: false });
        break;

      case 'clear':
        this.history = [];
        break;

      case 'whoami':
        this.history.push({ text: 'guest', isCommand: false });
        break;

      case 'identity':
        if (!this.vaultService.hasVault()) {
          this.history.push({ text: 'Status: NO_IDENTITY_LOADED', isCommand: false, isError: true });
          this.history.push({ text: 'Please unlock the Secure Vault to load identity.', isCommand: false });
        } else {
          try {
            // Stub fingerprint for terminal display
            const pubKey = this.vaultService.getMasterKey() || 'anon-64x9';
            this.history.push({ text: 'Status: IDENTITY_LOADED', isCommand: false, isSuccess: true });
            this.history.push({ text: `Vault Fingerprint: ${pubKey.substring(0, 64)}...`, isCommand: false });
          } catch (e) {
            const err = e as Error;
            this.history.push({ text: 'Error retrieving public fingerprint: ' + err.message, isCommand: false, isError: true });
          }
        }
        break;

      case 'encrypt':
        await this.handleEncrypt(args);
        break;

      case 'decrypt':
        await this.handleDecrypt(args);
        break;

      case 'exit':
      case 'quit':
        this.closeTerminal();
        break;

      default:
        this.history.push({ text: `darkstar: ${cmd}: command not found`, isCommand: false, isError: true });
    }
  }

  private async handleEncrypt(args: string[]) {
    if (!this.vaultService.hasVault()) {
      this.history.push({ text: 'Error: Secure Vault must be unlocked to encrypt.', isCommand: false, isError: true });
      return;
    }

    if (args.length < 2) {
      this.history.push({ text: 'Usage: encrypt <message>', isCommand: false });
      return;
    }

    const message = args.slice(1).join(' ');
    try {
      this.history.push({ text: 'Encrypting payload with Master Identity Obfuscation Engine...', isCommand: false });
      
      const { encryptedData, reverseKey } = await this.cryptService.encrypt(message, this.vaultService.getMasterKey()!);
      
      this.history.push({ text: '--- OBFUSCATED PAYLOAD ---', isCommand: false, isSuccess: true });
      this.history.push({ text: encryptedData, isCommand: false });
      this.history.push({ text: '--- REVERSE KEY (REQUIRED FOR DECRYPTION) ---', isCommand: false, isSuccess: true });
      this.history.push({ text: reverseKey, isCommand: false });
      this.history.push({ text: '-------------------------', isCommand: false, isSuccess: true });
    } catch (e) {
      const err = e as Error;
      this.history.push({ text: 'Encryption failed: ' + err.message, isCommand: false, isError: true });
    }
  }

  private async handleDecrypt(args: string[]) {
    if (!this.vaultService.hasVault()) {
      this.history.push({ text: 'Error: Secure Vault must be unlocked to decrypt.', isCommand: false, isError: true });
      return;
    }

    if (args.length < 3) {
      this.history.push({ text: 'Usage: decrypt <payload> <reverseKey>', isCommand: false });
      return;
    }

    const reverseKey = args.pop()!;
    const payload = args.slice(1).join(' ');

    try {
      this.history.push({ text: 'Attempting de-obfuscation with loaded identities...', isCommand: false });
      const decryptedResult = await this.cryptService.decrypt(payload, reverseKey, this.vaultService.getMasterKey()!);
      
      this.history.push({ text: '--- DECRYPTED MESSAGE ---', isCommand: false, isSuccess: true });
      this.history.push({ text: decryptedResult.decrypted, isCommand: false });
      this.history.push({ text: '-------------------------', isCommand: false, isSuccess: true });
    } catch (e) {
      const err = e as Error;
      this.history.push({ text: 'Decryption failed: ' + err.message, isCommand: false, isError: true });
    }
  }
}
