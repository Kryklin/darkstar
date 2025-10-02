import { Component, inject } from '@angular/core';
import { MaterialModule } from '../../modules/material-module';
import { Theme } from '../../services/theme';

@Component({
  selector: 'app-home',
  imports: [MaterialModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {
  theme = inject(Theme);
}
