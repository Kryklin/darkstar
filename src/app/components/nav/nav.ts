import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MaterialModule } from '../../modules/material/material';
import { Theme } from '../../services/theme';

import { MatDrawerMode } from '@angular/material/sidenav';

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
  isElectron = !!(window as unknown as ElectronWindow).electronAPI;
  sidenavMode: MatDrawerMode = 'over';
  hasBackdrop = true;

  toggleTheme() {
    this.theme.setDarkTheme(!this.theme.isDarkTheme());
  }

  minimize() {
    (window as unknown as ElectronWindow).electronAPI.minimize();
  }

  maximize() {
    (window as unknown as ElectronWindow).electronAPI.maximize();
  }

  close() {
    (window as unknown as ElectronWindow).electronAPI.close();
  }
}

interface ElectronWindow extends Window {
  electronAPI: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  }
}
