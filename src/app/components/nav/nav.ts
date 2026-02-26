import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDrawerMode } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { Theme } from '../../services/theme';
import { UpdateService } from '../../services/update';
import { LayoutService } from '../../services/layout.service';
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
  layoutService = inject(LayoutService);
  private breakpointObserver = inject(BreakpointObserver);

  isMobile = toSignal(
    this.breakpointObserver.observe([Breakpoints.Handset, Breakpoints.TabletPortrait, '(max-width: 768px)'])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  isElectron = !!window.electronAPI;
  sidenavMode: MatDrawerMode = 'over';
  hasBackdrop = true;

  expandedSections = new Set<string>();

  toggleSection(section: string) {
    // If it's a top-level category (e.g., 'encryption'), we might want to toggle it independently
    // If it's a sub-item, maybe we want to keep the parent open?
    // Simple toggle logic:
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

  closeOnMobile() {
    if (this.isMobile()) {
      this.layoutService.sidenavOpen.set(false);
    }
  }
}
