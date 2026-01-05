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

  expandedSections = new Set<string>();

  toggleSection(section: string) {
    if (this.expandedSections.has(section)) {
      this.expandedSections.delete(section);
    } else {
      this.expandedSections.add(section);
    }
  }

  isExpanded(section: string): boolean {
    return this.expandedSections.has(section);
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
