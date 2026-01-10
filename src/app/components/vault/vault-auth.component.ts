import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VaultService } from '../../services/vault';
import { EntropyMeter } from '../entropy-meter/entropy-meter';
import { MaterialModule } from '../../modules/material/material';

@Component({
  selector: 'app-vault-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, EntropyMeter],
  template: `
    <div class="vault-auth-container">
      <div class="auth-card">
        <div class="lock-icon">
          <mat-icon>lock</mat-icon>
        </div>

        <h2>{{ hasVault() ? 'Unlock Vault' : 'Create Vault' }}</h2>
        <p class="subtitle">
          {{ hasVault() ? 'Enter your master password to decrypt your notes.' : 'Set a strong master password. This cannot be recovered if lost.' }}
        </p>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Master Password</mat-label>
          <input matInput [type]="hidePassword ? 'password' : 'text'" [(ngModel)]="password" (keyup.enter)="submit()" />
          <button mat-icon-button matSuffix (click)="hidePassword = !hidePassword">
            <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        </mat-form-field>

        @if (!hasVault()) {
          <app-entropy-meter [value]="password"></app-entropy-meter>
        }

        <div class="actions">
          <button mat-flat-button color="primary" [disabled]="loading || !password" (click)="submit()">
            @if (!loading) {
              <span>{{ hasVault() ? 'Unlock' : 'Create Vault' }}</span>
            }
            @if (loading) {
              <mat-spinner diameter="20"></mat-spinner>
            }
          </button>
        </div>

        @if (vaultService.error()) {
          <p class="error-msg">
            {{ vaultService.error() }}
          </p>
        }

        @if (!hasVault()) {
          <div class="warning"><mat-icon inline>warning</mat-icon> Zero-Knowledge Encryption: We do not store your password.</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .vault-auth-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        background: radial-gradient(circle at center, var(--glass-bg-accent) 0%, transparent 70%);
      }
      .auth-card {
        background: var(--glass-bg);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid var(--glass-border);
        padding: 40px;
        border-radius: 24px;
        width: 100%;
        max-width: 400px;
        text-align: center;
        box-shadow: var(--glass-shadow);

        animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 0;
      }
      .lock-icon {
        background: rgba(var(--mat-sys-primary-rgb), 0.1);
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 0 auto 24px;
        box-shadow: 0 0 20px rgba(var(--mat-sys-primary-rgb), 0.1);

        mat-icon {
          font-size: 40px;
          width: 40px;
          height: 40px;
          color: var(--mat-sys-primary);
        }
      }
      h2 {
        margin: 0 0 8px;
        font-weight: 300;
        color: var(--glass-text);
        letter-spacing: 1px;
      }
      .subtitle {
        color: var(--glass-text-muted);
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 30px;
      }
      .full-width {
        width: 100%;
        margin-bottom: 20px;
      }
      // Custom style for the glass form field
      ::ng-deep .mat-mdc-form-field-focus-indicator {
        display: none !important;
      }
      ::ng-deep .mat-mdc-text-field-wrapper {
        background-color: var(--glass-input-bg) !important;
        border-radius: 12px !important;
      }
      ::ng-deep .mat-mdc-input-element {
        color: var(--glass-text) !important;
      }
      ::ng-deep .mat-mdc-form-field-label {
        color: var(--glass-text-muted) !important;
      }

      .actions {
        display: flex;
        justify-content: center;
        margin-top: 10px;
      }
      button[mat-flat-button] {
        width: 100%;
        height: 52px;
        font-size: 16px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 500;
      }
      .error-msg {
        color: var(--mat-sys-error);
        margin-top: 20px;
        font-size: 14px;
        background: rgba(var(--mat-sys-error-rgb), 0.1);
        padding: 10px;
        border-radius: 8px;
      }
      .warning {
        margin-top: 30px;
        font-size: 12px;
        color: var(--mat-sys-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 12px;
        background: var(--glass-input-bg);
        border-radius: 8px;
        border: 1px solid var(--glass-border);
      }
    `,
  ],
})
export class VaultAuthComponent {
  vaultService = inject(VaultService);

  password = '';
  hidePassword = true;
  loading = false;

  hasVault() {
    return this.vaultService.hasVault();
  }

  async submit() {
    if (!this.password) return;

    this.loading = true;

    setTimeout(async () => {
      try {
        if (this.hasVault()) {
          await this.vaultService.unlock(this.password);
        } else {
          await this.vaultService.createVault(this.password);
        }
      } finally {
        this.loading = false;
      }
    }, 50);
  }
}
