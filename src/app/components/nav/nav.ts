import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MaterialModule } from '../../modules/material/material';
import { Theme } from '../../services/theme';
import { UpdateService } from '../../services/update';
import { MatDrawerMode } from '@angular/material/sidenav';

@Component({
  selector: 'app-nav',
  standalone: true,
  templateUrl: './nav.html',
  styleUrls: ['./nav.scss'],
  imports: [MaterialModule, RouterOutlet, RouterLink, RouterLinkActive],
})
export class Nav {
  theme = inject(Theme);
  updateService = inject(UpdateService);
  isElectron = !!window.electronAPI;
  sidenavMode: MatDrawerMode = 'over';
  hasBackdrop = true;

  expandedSection: string | null = null;

  toggleSection(section: string) {
    if (this.expandedSection === section) {
      this.expandedSection = null;
    } else {
      this.expandedSection = section;
    }
  }

  isExpanded(section: string): boolean {
    return this.expandedSection === section;
  }


  minimize() {
    window.electronAPI?.minimize();
  }

  maximize() {
    window.electronAPI?.maximize();
  }

  close() {
    window.electronAPI?.close();
  }
}
