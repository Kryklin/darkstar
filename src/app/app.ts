import { Component, signal } from '@angular/core';
import { Nav } from './components/nav/nav';

@Component({
  selector: 'app-root',
  imports: [Nav],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App {
  public readonly title = signal('darkstar');
}
