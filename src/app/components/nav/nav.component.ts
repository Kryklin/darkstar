import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MaterialModule } from '../../modules/material-module';
import { Theme } from '../../services/theme';

@Component({
  selector: 'app-nav',
  standalone: true,
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
  imports: [
    MaterialModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
]
})
export class NavComponent {
  theme = inject(Theme);

  toggleTheme() {
    this.theme.setDarkTheme(!this.theme.isDarkTheme());
  }
}
