import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MaterialModule } from '../../modules/material/material';
import { Theme } from '../../services/theme';

@Component({
  selector: 'app-nav',
  standalone: true,
  templateUrl: './nav.html',
  styleUrls: ['./nav.scss'],
  imports: [
    MaterialModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive
]
})
export class Nav {
  theme = inject(Theme);

  toggleTheme() {
    this.theme.setDarkTheme(!this.theme.isDarkTheme());
  }

  minimize() {
    (window as any).electronAPI.minimize();
  }

  maximize() {
    (window as any).electronAPI.maximize();
  }

  close() {
    (window as any).electronAPI.close();
  }
}
