import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MaterialModule } from '../../modules/material/material-module';
import { Theme } from '../../services/theme';

@Component({
  selector: 'app-nav',
  standalone: true,
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
  imports: [
    MaterialModule,
    RouterOutlet,
    RouterLink
]
})
export class NavComponent {
  theme = inject(Theme);

  toggleTheme() {
    this.theme.setDarkTheme(!this.theme.isDarkTheme());
  }
}
