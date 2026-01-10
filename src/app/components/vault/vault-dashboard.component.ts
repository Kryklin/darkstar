import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VaultService, VaultNote } from '../../services/vault';
import { MaterialModule } from '../../modules/material/material';
import { MarkdownModule } from 'ngx-markdown';
import { MatDialog } from '@angular/material/dialog';
import { GenericDialog } from '../dialogs/generic-dialog/generic-dialog';

@Component({
  selector: 'app-vault-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MarkdownModule],
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
                
                <div class="header-actions">
                    <button mat-icon-button class="action-btn" (click)="togglePreview()" [matTooltip]="showPreview ? 'Edit' : 'Save'">
                        <mat-icon>{{ showPreview ? 'edit' : 'save' }}</mat-icon>
                    </button>
                    <button mat-icon-button class="delete-btn" (click)="deleteCurrentNote()" matTooltip="Delete Note">
                        <mat-icon>delete</mat-icon>
                    </button>
                </div>
              </div>

              <!-- FORMATTING TOOLBAR (Only in Edit Mode) -->
              @if (!showPreview) {
                <div class="editor-toolbar">
                  <button mat-icon-button (click)="insertFormat('bold')" matTooltip="Bold (Ctrl+B)">
                    <mat-icon>format_bold</mat-icon>
                  </button>
                  <button mat-icon-button (click)="insertFormat('italic')" matTooltip="Italic (Ctrl+I)">
                    <mat-icon>format_italic</mat-icon>
                  </button>
                  <button mat-icon-button (click)="insertFormat('heading')" matTooltip="Heading">
                    <mat-icon>title</mat-icon>
                  </button>
                  <div class="divider"></div>
                  <button mat-icon-button (click)="insertFormat('list')" matTooltip="Bullet List">
                    <mat-icon>format_list_bulleted</mat-icon>
                  </button>
                  <button mat-icon-button (click)="insertFormat('checklist')" matTooltip="Checklist">
                    <mat-icon>check_box</mat-icon>
                  </button>
                   <button mat-icon-button (click)="insertFormat('code')" matTooltip="Code Block">
                    <mat-icon>code</mat-icon>
                  </button>
                  <div class="divider"></div>
                  <button mat-icon-button (click)="triggerImageUpload()" matTooltip="Insert Image">
                    <mat-icon>image</mat-icon>
                  </button>
                  <input type="file" #imageInput hidden (change)="handleImageUpload($event)" accept="image/*" />
                </div>
              }

              <div class="editor-body">
                @if (showPreview) {
                  <article class="markdown-preview custom-scroll">
                     <markdown [data]="currentContent"></markdown>
                  </article>
                } @else {
                  <textarea 
                    #editorArea
                    class="content-input custom-scroll" 
                    [(ngModel)]="currentContent" 
                    (ngModelChange)="onContentChange()" 
                    (keydown)="onKeyDown($event)"
                    placeholder="Start typing your secure note..."></textarea>
                }
              </div>
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
      }
      .sidebar-header {
        padding: 24px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--glass-border);

        h3 {
          margin: 0;
          font-weight: 300;
          color: var(--glass-text);
          letter-spacing: 1px;
          text-transform: uppercase;
          font-size: 1rem;
        }
        button { color: var(--glass-text); }
      }
      .sidebar-footer {
        padding: 20px;
        border-top: 1px solid var(--glass-border);
        margin-top: auto;

        button {
          width: 100%;
          border-radius: 12px;
          background: rgba(var(--mat-sys-error-rgb), 0.05);
          border: 1px solid rgba(var(--mat-sys-error-rgb), 0.1);
          color: var(--mat-sys-error);
          &:hover { background: rgba(var(--mat-sys-error-rgb), 0.1); }
        }
      }
      mat-nav-list { padding-top: 10px; }
      a[mat-list-item] {
        margin: 4px 12px;
        border-radius: 12px !important;
        transition: all 0.2s ease;
        height: auto !important;
        padding: 12px !important;
        color: var(--glass-text);

        &:hover { background: rgba(var(--mat-sys-primary-rgb), 0.05) !important; }
        &.active {
          background: rgba(var(--mat-sys-primary-rgb), 0.1) !important;
          box-shadow: var(--glass-shadow), inset 0 0 0 1px rgba(var(--mat-sys-primary-rgb), 0.2);
          h4 { color: var(--mat-sys-primary); }
        }
      }
      h4[matListItemTitle] { font-weight: 400; margin-bottom: 4px; font-size: 0.95rem; }
      .note-date { font-size: 11px; color: var(--glass-text-muted); }
      .empty-state { padding: 40px 20px; text-align: center; color: var(--glass-text-muted); font-size: 13px; }

      /* Editor Styles */
      .editor-content { background: transparent; }
      .editor-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 30px 50px;
        box-sizing: border-box;
        max-width: 1200px;
        margin: 0 auto;
      }
      .editor-header {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--glass-border);
      }
      .title-input {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--glass-text);
        font-size: 28px;
        font-family: 'Outfit', 'Roboto', sans-serif;
        font-weight: 400;
        outline: none;
        letter-spacing: -0.5px;
        &::placeholder { color: var(--glass-text-muted); opacity: 0.3; }
      }
      .header-actions {
        display: flex;
        gap: 8px;
        
        .action-btn { color: var(--mat-sys-primary); }
        .delete-btn { color: var(--mat-sys-error); opacity: 0.7; &:hover { opacity: 1; } }
      }

      /* Formatting Toolbar */
      .editor-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid var(--glass-border);
        border-radius: 12px 12px 0 0;
        margin-bottom: -1px; /* Overlap border */
        z-index: 1;

        button {
            color: var(--glass-text-muted);
            transform: scale(0.9);
            &:hover { 
                color: var(--glass-text); 
                background: rgba(255,255,255,0.05); 
            }
        }
        .divider {
            width: 1px;
            height: 20px;
            background: var(--glass-border);
            margin: 0 8px;
        }
      }

      .editor-body {
        flex: 1;
        position: relative;
        display: flex;
        flex-direction: column;
        min-height: 0; /* Enable flex scroll */
      }

      .content-input, .markdown-preview {
        flex: 1;
        background: var(--glass-input-bg);
        border: 1px solid var(--glass-border);
        border-radius: 0 0 16px 16px; /* Rounded bottom only if toolbar exists */
        color: var(--glass-text);
        font-size: 16px;
        line-height: 1.6;
        outline: none;
        resize: none;
        padding: 30px;
        box-shadow: inset 0 2px 15px rgba(0, 0, 0, 0.05);
        overflow-y: auto;
      }
      
      .content-input {
        font-family: 'Roboto Mono', monospace;
        &:focus {
           background: rgba(var(--mat-sys-primary-rgb), 0.02);
           border-color: rgba(var(--mat-sys-primary-rgb), 0.3);
        }
      }

      .markdown-preview {
        /* Style the markdown output */
         ::ng-deep img { max-width: 100%; border-radius: 8px; margin: 10px 0; border: 1px solid var(--glass-border); }
         ::ng-deep blockquote { border-left: 4px solid var(--mat-sys-primary); margin: 0; padding-left: 16px; color: var(--glass-text-muted); }
         ::ng-deep code { background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 4px; font-family: 'Roboto Mono'; font-size: 0.9em; }
         ::ng-deep pre { background: rgba(0,0,0,0.3) !important; padding: 16px; border-radius: 8px; overflow-x: auto; }
         ::ng-deep h1, ::ng-deep h2, ::ng-deep h3 { margin-top: 1.5em; margin-bottom: 0.5em; color: var(--glass-text); }
         ::ng-deep ul, ::ng-deep ol { padding-left: 24px; }
         ::ng-deep a { color: var(--mat-sys-primary); }
      }

      /* Custom Scrollbar for editor */
      .custom-scroll::-webkit-scrollbar { width: 8px; }
      .custom-scroll::-webkit-scrollbar-track { background: transparent; }
      .custom-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
      .custom-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }

      .no-selection-state {
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: var(--glass-text-muted);
        .large-icon {
          font-size: 80px; width: 80px; height: 80px; margin-bottom: 24px;
          color: rgba(var(--mat-sys-primary-rgb), 0.15);
          filter: drop-shadow(0 0 15px rgba(var(--mat-sys-primary-rgb), 0.1));
        }
        h2 { font-weight: 300; letter-spacing: 2px; text-transform: uppercase; font-size: 1.2rem; }
      }
    `,
  ],
})
export class VaultDashboardComponent {
  vaultService = inject(VaultService);
  dialog = inject(MatDialog);
  notes = this.vaultService.notes;
  selectedNote = signal<VaultNote | null>(null);

  @ViewChild('editorArea') editorArea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('imageInput') imageInput?: ElementRef<HTMLInputElement>;

  currentTitle = '';
  currentContent = '';
  showPreview = false;

  selectNote(note: VaultNote) {
    this.selectedNote.set(note);
    this.currentTitle = note.title;
    this.currentContent = note.content;
    this.showPreview = true; // Default to View Mode
  }

  createNote() {
    this.vaultService.addNote('', '');
    const newNote = this.notes()[0];
    if (newNote) {
        this.selectNote(newNote);
        this.showPreview = false; // New notes start in Edit Mode for convenience
    }
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
      this.dialog.open(GenericDialog, {
        data: {
          title: 'Delete Note',
          message: 'Are you sure you want to permanently delete this note?',
          buttons: [
            { label: 'Cancel', value: false },
            { label: 'Delete', value: true, color: 'warn' }
          ]
        }
      }).afterClosed().subscribe(confirmed => {
        if (confirmed) {
          this.vaultService.deleteNote(note.id);
          this.selectedNote.set(null);
        }
      });
    }
  }

  lock() { this.vaultService.lock(); }
  togglePreview() { this.showPreview = !this.showPreview; }

  // --- EDITOR TOOLBAR LOGIC ---

  triggerImageUpload() {
    this.imageInput?.nativeElement.click();
  }

  handleImageUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        // Create base64 string
        const base64 = e.target?.result as string;
        // Insert markdown image syntax (User Friendly: Just puts the image there)
        const imageMarkdown = `\n![${file.name}](${base64})\n`;
        this.insertAtCursor(imageMarkdown);
        this.onContentChange(); // Trigger save
      };
      
      reader.readAsDataURL(file);
    }
  }

  insertFormat(type: string) {
    const el = this.editorArea?.nativeElement;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const selectedText = text.substring(start, end);

    let prefix = '';
    let suffix = '';
    let defaultText = '';

    switch (type) {
        case 'bold': prefix = '**'; suffix = '**'; defaultText = 'bold text'; break;
        case 'italic': prefix = '*'; suffix = '*'; defaultText = 'italic text'; break;
        case 'heading': prefix = '## '; suffix = ''; defaultText = 'Heading'; break;
        case 'code': prefix = '```\n'; suffix = '\n```'; defaultText = 'code block'; break;
        case 'list': prefix = '- '; suffix = ''; defaultText = 'list item'; break;
        case 'checklist': prefix = '- [ ] '; suffix = ''; defaultText = 'task'; break;
    }

    const replacement = prefix + (selectedText || defaultText) + suffix;
    
    this.insertAtCursor(replacement);
    
    // Focus back
    el.focus();
    // Move cursor logic if needed
  }

  private insertAtCursor(textToInsert: string) {
     const el = this.editorArea?.nativeElement;
     if (!el) return;

     const start = el.selectionStart;
     const end = el.selectionEnd;
     const text = el.value;

     this.currentContent = text.substring(0, start) + textToInsert + text.substring(end);
     
     // Update Cursor
     setTimeout(() => {
         el.selectionStart = el.selectionEnd = start + textToInsert.length;
     }, 0);
     
     this.onContentChange();
  }

  onKeyDown(event: KeyboardEvent) {
      // Hotkeys
      if (event.ctrlKey || event.metaKey) {
          if (event.key === 'b') {
              event.preventDefault();
              this.insertFormat('bold');
          } else if (event.key === 'i') {
              event.preventDefault();
              this.insertFormat('italic');
          }
      }
  }
}
