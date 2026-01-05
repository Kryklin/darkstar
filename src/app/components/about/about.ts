import { Component } from '@angular/core';
import { MaterialModule } from '../../modules/material/material';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [MaterialModule, CommonModule],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {}
