import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../modules/material/material';

@Component({
  selector: 'app-dark-drop',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './dark-drop.component.html',
  styleUrls: ['./dark-drop.component.scss']
})
export class DarkDropComponent {
  @Output() fileSelected = new EventEmitter<File>();
  
  isDragging = false;
  selectedFile: File | null = null;

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File) {
    this.selectedFile = file;
    this.fileSelected.emit(file);
  }

  clearFile() {
      this.selectedFile = null;
  }
}
