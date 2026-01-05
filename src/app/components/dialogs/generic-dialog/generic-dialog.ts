import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../modules/material/material';

export interface DialogButton {
  label: string;
  value: any;
  color?: string;
}

export interface DialogData {
  title: string;
  message: string;
  buttons: DialogButton[];
}

@Component({
  selector: 'app-generic-dialog',
  standalone: true,
  imports: [MaterialModule],
  templateUrl: './generic-dialog.html',
  styles: [
    `
      mat-dialog-content {
        font-family: 'Roboto', sans-serif;
        font-size: 16px;
      }
    `,
  ],
})
export class GenericDialog {
  constructor(
    public dialogRef: MatDialogRef<GenericDialog>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {}

  close(value: any): void {
    this.dialogRef.close(value);
  }
}
