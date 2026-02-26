import { Component, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VaultService, VaultNote, VaultAttachment } from '../../../services/vault';
import { VaultFileService } from '../../../services/vault-file.service';
import { TimeLockService } from '../../../services/timelock.service';
import { MaterialModule } from '../../../modules/material/material';
import { MarkdownModule } from 'ngx-markdown';
import { MatDialog } from '@angular/material/dialog';
import { GenericDialog } from '../../dialogs/generic-dialog/generic-dialog';
import { MatChipInputEvent } from '@angular/material/chips';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-vault-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MarkdownModule],
  templateUrl: './vault-dashboard.component.html',
  styleUrls: ['./vault-dashboard.component.scss'],
})
export class VaultDashboardComponent {
  vaultService = inject(VaultService);
  fileService = inject(VaultFileService);
  timeLockService = inject(TimeLockService);
  dialog = inject(MatDialog);
  clipboard = inject(Clipboard);
  snackBar = inject(MatSnackBar);
  notes = this.vaultService.notes;
  selectedNote = signal<VaultNote | null>(null);

  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  searchTerm = signal('');

  // Computed signal for search filter
  filteredNotes = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const allNotes = this.notes();
    if (!term) return allNotes;
    return allNotes.filter(n => 
        n.title.toLowerCase().includes(term) || 
        n.content.toLowerCase().includes(term) ||
        n.tags?.some(t => t.toLowerCase().includes(term))
    );
  });

  @ViewChild('editorArea') editorArea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('imageInput') imageInput?: ElementRef<HTMLInputElement>;

  currentTitle = '';
  currentContent = '';
  currentTags: string[] = [];
  currentAttachments: VaultAttachment[] = [];
  showPreview = true;

  isLocking = signal(false);
  lockProgress = signal(0);

  identityFingerprint = signal<string>('Loading Identity...');
  hardwareId = signal<string | null>(null);

  constructor() {
     this.loadIdentity();
     this.loadHardwareId();
  }

  async loadHardwareId() {
      try {
          const hwId = await this.vaultService.getHardwareId();
          if (hwId) {
              this.hardwareId.set(hwId);
          }
      } catch (e) {
          console.error("Failed to load hardware ID", e);
      }
  }

  async loadIdentity() {
      try {
          const key = await this.vaultService.getPublicKey();
          // Create a visual fingerprint (short hash of X coord)
          if (key.x) {
             this.identityFingerprint.set(key.x.substring(0, 24) + '...'); 
          }
      } catch {
          this.identityFingerprint.set('Identity Hidden');
      }
  }

  async copyIdentity() {
      try {
          const key = await this.vaultService.getPublicKey();
          navigator.clipboard.writeText(JSON.stringify(key, null, 2));
      } catch (e) {
          console.error(e);
      }
  }

  backupIdentity() {
      try {
          const identityJson = this.vaultService.exportIdentity();
          const copySuccess = this.clipboard.copy(identityJson);
          if (copySuccess) {
              this.snackBar.open('Identity Backed Up to Clipboard! KEEP THIS SECURE. DO NOT SHARE.', 'OK', {
                  duration: 8000,
                  panelClass: ['legacy-warning-snackbar']
              });
          } else {
              this.snackBar.open('Failed to copy to clipboard.', 'Close', { duration: 3000 });
          }
      } catch (e) {
          console.error(e);
          this.snackBar.open('Error backing up identity.', 'Close', { duration: 3000 });
      }
  }

  async recoverIdentity() {
      try {
          const clipboardText = await navigator.clipboard.readText();
          if (!clipboardText) {
              this.snackBar.open('Clipboard is empty.', 'Close', { duration: 3000 });
              return;
          }

          const success = await this.vaultService.importIdentity(clipboardText);
          if (success) {
              this.loadIdentity();
              this.snackBar.open('Identity recovered successfully!', 'OK', { duration: 3000 });
          } else {
              this.snackBar.open('Invalid identity format in clipboard.', 'Close', { duration: 3000 });
          }
      } catch (e) {
          console.error(e);
          this.snackBar.open('Failed to attach clipboard content.', 'Close', { duration: 3000 });
      }
  }

  selectNote(note: VaultNote) {
    this.selectedNote.set(note);
    this.currentTitle = note.title;
    this.currentContent = note.content;
    this.currentTags = [...(note.tags || [])];
    this.currentAttachments = [...(note.attachments || [])];
    this.showPreview = true;
  }

  createNote() {
    this.vaultService.addNote('', '');
    const newNote = this.notes()[0]; // Assumes added at top
    if (newNote) {
        this.selectNote(newNote);
        this.showPreview = false;
    }
  }

  onContentChange() {
    const note = this.selectedNote();
    if (note) {
      if (note.timeLock?.isLocked) return;
      this.vaultService.updateNote(note.id, this.currentTitle, this.currentContent, this.currentTags, note.timeLock);
    }
  }

  async applyTimeLock(seconds: number) {
    const note = this.selectedNote();
    if (!note) return;
    
    this.isLocking.set(true);
    try {
      const result = await this.timeLockService.lockNoteContent(
        this.currentContent,
        seconds,
        (p) => this.lockProgress.set(p)
      );
      this.currentContent = result.encryptedData;
      this.vaultService.updateNote(note.id, this.currentTitle, this.currentContent, this.currentTags, result.metadata);
      this.showPreview = true;
      this.selectNote(this.vaultService.notes().find(n => n.id === note.id)!);
    } catch (e) {
      console.error(e);
    } finally {
      this.isLocking.set(false);
      this.lockProgress.set(0);
    }
  }

  async unlockCurrentNote() {
    const note = this.selectedNote();
    if (!note || !note.timeLock) return;
    
    this.isLocking.set(true);
    try {
      const decrypted = await this.timeLockService.unlockNoteContent(
        this.currentContent,
        note.timeLock,
        (p) => this.lockProgress.set(p)
      );
      this.currentContent = decrypted;
      note.timeLock.isLocked = false;
      this.vaultService.updateNote(note.id, this.currentTitle, this.currentContent, this.currentTags, note.timeLock);
    } catch (e) {
      console.error(e);
      alert('Failed to unlock. Ensure computation completes.');
    } finally {
      this.isLocking.set(false);
      this.lockProgress.set(0);
    }
  }

  removeTimeLock() {
    const note = this.selectedNote();
    if (note) {
      delete note.timeLock;
      this.vaultService.updateNote(note.id, this.currentTitle, this.currentContent, this.currentTags);
    }
  }

  // --- TAGS ---
  addTag(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value) {
      if (!this.currentTags.includes(value)) {
        this.currentTags.push(value);
        this.onContentChange();
      }
    }
    event.chipInput!.clear();
  }

  removeTag(tag: string): void {
    const index = this.currentTags.indexOf(tag);
    if (index >= 0) {
      this.currentTags.splice(index, 1);
      this.onContentChange();
    }
  }

  // --- ATTACHMENTS ---
  async handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const note = this.selectedNote();
        // Access master key securely
        const password = this.vaultService.getMasterKey();
        if(!note || !password) return;

        try {
            const attachment = await this.fileService.uploadFile(file, password);
            this.vaultService.addAttachment(note.id, attachment);
            this.currentAttachments.push(attachment);
        } catch (err) {
            console.error('Upload failed', err);
        }
    }
  }

  async downloadFile(file: VaultAttachment) {
      const password = this.vaultService.getMasterKey();
      if(!password) return;
      await this.fileService.downloadFile(file, password);
  }

  async deleteFile(file: VaultAttachment) {
      const note = this.selectedNote();
      if(!note) return;
      
      try {
          // Determine if we should also delete from disk? Yes.
          await this.fileService.deleteFile(file);
          this.vaultService.removeAttachment(note.id, file.id);
          this.currentAttachments = this.currentAttachments.filter(a => a.id !== file.id);
      } catch (err) {
          console.error('Delete file failed', err);
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
        const base64 = e.target?.result as string;
        const imageMarkdown = `\n![${file.name}](${base64})\n`;
        this.insertAtCursor(imageMarkdown);
        this.onContentChange();
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
    el.focus();
  }

  private insertAtCursor(textToInsert: string) {
     const el = this.editorArea?.nativeElement;
     if (!el) return;

     const start = el.selectionStart;
     const end = el.selectionEnd;
     const text = el.value;

     this.currentContent = text.substring(0, start) + textToInsert + text.substring(end);
     
     setTimeout(() => {
         el.selectionStart = el.selectionEnd = start + textToInsert.length;
     }, 0);
     
     this.onContentChange();
  }

  onKeyDown(event: KeyboardEvent) {
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
