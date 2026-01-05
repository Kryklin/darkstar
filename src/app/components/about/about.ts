import { Component } from '@angular/core';
import { MaterialModule } from '../../modules/material/material';
import { CommonModule } from '@angular/common';
import packageJson from '../../../../package.json';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  version = packageJson.version;
  repoUrl = packageJson.repository.url.replace('.git', '');
  licenseType = 'MIT License';
  donationUrl = 'https://blockstream.info/address/bc1qsstnef7gh3rl593t4lm9276zk43rjl3mux9m5f72xp4cvr5gep5skam5hx';
  
  openLink(url: string) {
    window.open(url, '_blank');
  }
}
