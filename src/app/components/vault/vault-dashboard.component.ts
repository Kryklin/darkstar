import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VaultService, VaultNote } from '../../services/vault';
import { MaterialModule } from '../../modules/material/material';

@Component({
  selector: 'app-vault-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  template: `
    <div class="vault-container">
      <mat-sidenav-container class="sidenav-container">
        <!-- SIDEBAR: Note List -->
        <mat-sidenav mode="side" opened class="notes-sidebar">
          <div class="sidebar-header">
            <h3>Secure Notes</h3>
            <button mat-icon-button (click)="createNote()" matTooltip="New Note">
              <mat-icon>add</mat-icon>
            </button>
          </div>

          <mat-nav-list>
            @for (note of notes(); track note.id) {
              <a mat-list-item [class.active]="selectedNote()?.id === note.id" (click)="selectNote(note)" (keydown.enter)="selectNote(note)" tabindex="0">
                <h4 matListItemTitle>{{ note.title || 'Untitled Note' }}</h4>
                <p matListItemLine class="note-date">{{ note.updatedAt | date: 'short' }}</p>
              </a>
            }
            @if (notes().length === 0) {
              <div class="empty-state">No notes yet.</div>
            }
          </mat-nav-list>

          <div class="sidebar-footer">
            <button mat-button color="warn" (click)="lock()"><mat-icon>lock</mat-icon> Lock Vault</button>
          </div>
        </mat-sidenav>

        <!-- MAIN: Editor -->
        <mat-sidenav-content class="editor-content">
          @if (selectedNote()) {
            <div class="editor-wrapper">
              <div class="editor-header">
                <input class="title-input" [(ngModel)]="currentTitle" (ngModelChange)="onContentChange()" placeholder="Note Title" />

                <button mat-icon-button color="warn" (click)="deleteCurrentNote()">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>

              <textarea class="content-input" [(ngModel)]="currentContent" (ngModelChange)="onContentChange()" placeholder="Start typing your secure note..."></textarea>
            </div>
          } @else {
            <div class="no-selection-state">
              <mat-icon class="large-icon">verified_user</mat-icon>
              <h2>Vault Unlocked</h2>
              <p>Select a note to view or create a new one.</p>
            </div>
          }
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [
    `
      .vault-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        background: radial-gradient(circle at center, var(--glass-bg-accent) 0%, transparent 80%);
      }
      .sidenav-container {
        flex: 1;
        background: transparent;
      }
      .notes-sidebar {
        width: 320px;
        background: var(--glass-bg);
        backdrop-filter: blur(15px) saturate(160%);
        -webkit-backdrop-filter: blur(15px) saturate(160%);
        border-right: 1px solid var(--glass-border);
        display: flex;
        flex-direction: column;
        box-shadow: var(--glass-shadow);

        animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 0;
      }
      .sidebar-header {
        padding: 24px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--glass-border);

        animation: fadeIn 0.8s ease-out 0.2s forwards;
        opacity: 0;

        h3 {
          margin: 0;
          font-weight: 300;
          color: var(--glass-text);
          letter-spacing: 1px;
          text-transform: uppercase;
          font-size: 1rem;
        }

        button {
          color: var(--glass-text);
        }
      }
      .sidebar-footer {
        padding: 20px;
        border-top: 1px solid var(--glass-border);
        margin-top: auto;

        animation: fadeIn 0.8s ease-out 0.5s forwards;
        opacity: 0;

        button {
          width: 100%;
          border-radius: 12px;
          background: rgba(var(--mat-sys-error-rgb), 0.05);
          border: 1px solid rgba(var(--mat-sys-error-rgb), 0.1);
          color: var(--mat-sys-error);
          &:hover {
            background: rgba(var(--mat-sys-error-rgb), 0.1);
          }
        }
      }
      mat-nav-list {
        padding-top: 10px;
      }
      a[mat-list-item] {
        margin: 4px 12px;
        border-radius: 12px !important;
        transition: all 0.2s ease;
        height: auto !important;
        padding: 12px !important;
        color: var(--glass-text);

        animation: slideInRow 0.4s ease forwards;
        opacity: 0;

        &:nth-child(1) {
          animation-delay: 0.35s;
        }
        &:nth-child(2) {
          animation-delay: 0.4s;
        }
        &:nth-child(3) {
          animation-delay: 0.45s;
        }
        &:nth-child(4) {
          animation-delay: 0.5s;
        }
        &:nth-child(5) {
          animation-delay: 0.55s;
        }

        &:hover {
          background: rgba(var(--mat-sys-primary-rgb), 0.05) !important;
        }

        &.active {
          background: rgba(var(--mat-sys-primary-rgb), 0.1) !important;
          box-shadow:
            var(--glass-shadow),
            inset 0 0 0 1px rgba(var(--mat-sys-primary-rgb), 0.2);

          h4 {
            color: var(--mat-sys-primary);
          }
        }
      }
      h4[matListItemTitle] {
        font-weight: 400;
        margin-bottom: 4px;
        font-size: 0.95rem;
      }
      .note-date {
        font-size: 11px;
        color: var(--glass-text-muted);
      }
      .empty-state {
        padding: 40px 20px;
        text-align: center;
        color: var(--glass-text-muted);
        font-size: 13px;
        animation: fadeIn 0.8s ease-out 0.4s forwards;
        opacity: 0;
      }

      .editor-content {
        background: transparent;
      }
      .editor-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 40px;
        box-sizing: border-box;
        max-width: 900px;
        margin: 0 auto;

        animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
        opacity: 0;
      }
      .editor-header {
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--glass-border);
      }
      .title-input {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--glass-text);
        font-size: 32px;
        font-family: 'Outfit', 'Roboto', sans-serif;
        font-weight: 300;
        outline: none;
        letter-spacing: -0.5px;

        &::placeholder {
          color: var(--glass-text-muted);
          opacity: 0.3;
        }
      }
      .content-input {
        flex: 1;
        background: var(--glass-input-bg);
        border: 1px solid var(--glass-border);
        border-radius: 16px;
        color: var(--glass-text);
        font-size: 17px;
        line-height: 1.7;
        font-family: 'Roboto Mono', monospace;
        outline: none;
        resize: none;
        padding: 30px;
        box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.05);

        &::placeholder {
          color: var(--glass-text-muted);
          opacity: 0.2;
        }

        &:focus {
          background: rgba(var(--mat-sys-primary-rgb), 0.02);
          border-color: rgba(var(--mat-sys-primary-rgb), 0.2);
        }
      }

      .no-selection-state {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: var(--glass-text-muted);

        .large-icon {
          font-size: 80px;
          width: 80px;
          height: 80px;
          margin-bottom: 24px;
          color: rgba(var(--mat-sys-primary-rgb), 0.15);
          filter: drop-shadow(0 0 15px rgba(var(--mat-sys-primary-rgb), 0.1));
        }
        h2 {
          font-weight: 300;
          letter-spacing: 2px;
          text-transform: uppercase;
          font-size: 1.2rem;
          color: var(--glass-text-muted);
        }
      }
    `,
  ],
})
export class VaultDashboardComponent {
  vaultService = inject(VaultService);

  notes = this.vaultService.notes;
  selectedNote = signal<VaultNote | null>(null);

  // Buffer state for editor to avoid jitter update
  currentTitle = '';
  currentContent = '';

  selectNote(note: VaultNote) {
    this.selectedNote.set(note);
    this.currentTitle = note.title;
    this.currentContent = note.content;
  }

  createNote() {
    this.vaultService.addNote('', '');
    // Select the newly created note (first in list)
    const newNote = this.notes()[0];
    if (newNote) this.selectNote(newNote);
  }

  onContentChange() {
    const note = this.selectedNote();
    if (note) {
      this.vaultService.updateNote(note.id, this.currentTitle, this.currentContent);
    }
  }

  deleteCurrentNote() {
    const note = this.selectedNote();
    if (note) {
      if (confirm('Are you sure you want to delete this note?')) {
        this.vaultService.deleteNote(note.id);
        this.selectedNote.set(null);
      }
    }
  }

  lock() {
    this.vaultService.lock();
  }
}
