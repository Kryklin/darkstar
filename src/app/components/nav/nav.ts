import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDrawerMode } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { Theme } from '../../services/theme';
import { UpdateService } from '../../services/update';
import { VaultService } from '../../services/vault';
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
  vaultService = inject(VaultService);
  layoutService = inject(LayoutService);
  private breakpointObserver = inject(BreakpointObserver);

  currentTime = signal<Date>(new Date());

  constructor() {
    setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  isMobile = toSignal(this.breakpointObserver.observe([Breakpoints.Handset, Breakpoints.TabletPortrait, '(max-width: 768px)']).pipe(map((result) => result.matches)), { initialValue: false });

  isElectron = !!window.electronAPI;
  sidenavMode: MatDrawerMode = 'over';
  hasBackdrop = true;

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
