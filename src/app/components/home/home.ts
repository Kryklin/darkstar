import { Component, inject } from '@angular/core';
import { MaterialModule } from '../../modules/material/material';
import { Theme } from '../../services/theme';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  imports: [MaterialModule, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  theme = inject(Theme);
}
