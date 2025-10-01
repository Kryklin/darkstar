import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { Theme } from '../../services/theme';

@Component({
  selector: 'app-home',
  imports: [MatCardModule, MatListModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  theme = inject(Theme);
}
