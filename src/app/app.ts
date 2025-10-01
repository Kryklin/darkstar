import { Component, signal } from '@angular/core';
import { NavComponent } from './components/nav/nav.component';

@Component({
  selector: 'app-root',
  imports: [NavComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App {
  public readonly title = signal('darkstar');
}
