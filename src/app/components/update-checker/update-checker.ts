import { Component, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaterialModule } from '../../modules/material/material';
import { UpdateService } from '../../services/update';

@Component({
  selector: 'app-update-checker',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './update-checker.html',
  styleUrl: './update-checker.scss',
})
export class UpdateChecker implements OnInit {
  updateService = inject(UpdateService);
  router = inject(Router);

  constructor() {
    effect(() => {
      const status = this.updateService.updateStatus();
      if (status === 'not-available') {
        setTimeout(() => {
            this.updateService.resetState();
            this.router.navigate(['/home']);
        }, 2000);
      } else if (status === 'error') {
          // Stay on page to show error
      }
    });
  }

  ngOnInit() {
    // If we landed here accurately, check should be in progress. 
    // If not started (e.g. manual nav), start it.
    if (this.updateService.updateStatus() === 'idle') {
        this.updateService.checkForUpdates();
    }
  }

  restart() {
    this.updateService.quitAndInstall();
  }

  goHome() {
    this.updateService.resetState();
    this.router.navigate(['/home']);
  }
}
