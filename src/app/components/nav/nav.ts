import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDrawerMode } from '@angular/material/sidenav';
import { Theme } from '../../services/theme';
import { UpdateService } from '../../services/update';
import { MaterialModule } from '../../modules/material/material';

@Component({
  selector: 'app-nav',
  standalone: true,
  templateUrl: './nav.html',
  styleUrls: ['./nav.scss'],
  imports: [
    CommonModule,
    RouterModule, // Import entire module to ensure outlet is recognized
    MaterialModule,
  ],
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
