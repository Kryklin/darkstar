import { Component, EventEmitter, Output, signal } from '@angular/core';

import { MaterialModule } from '../../modules/material/material';

@Component({
  selector: 'app-virtual-keyboard',
  standalone: true,
  imports: [MaterialModule],
  templateUrl: './virtual-keyboard.html',
  styleUrl: './virtual-keyboard.scss',
})
export class VirtualKeyboard {
  @Output() keyPress = new EventEmitter<string>();
  @Output() backspace = new EventEmitter<void>();

  // Use signals for reactive state
  keys = signal<string[]>([]);
  showSymbols = signal(false);
  showCaps = signal(false);

  private readonly lowerCaseKeys = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '0',
    'q',
    'w',
    'e',
    'r',
    't',
    'y',
    'u',
    'i',
    'o',
    'p',
    'a',
    's',
    'd',
    'f',
    'g',
    'h',
    'j',
    'k',
    'l',
    'z',
    'x',
    'c',
    'v',
    'b',
    'n',
    'm',
  ];

  private readonly specialKeys = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+', '[', ']', '{', '}', '\\', '|', ';', ':', "'", '"', ',', '.', '<', '>', '/', '?'];

  constructor() {
    this.shuffleKeys();
  }

  get currentKeys(): string[] {
    return this.keys();
  }

  toggleCaps() {
    this.showCaps.update((v) => !v);
    this.updateKeyDisplay();
  }

  toggleSymbols() {
    this.showSymbols.update((v) => !v);
    this.shuffleKeys(); // Reshuffle when switching modes
  }

  shuffleKeys() {
    const source = this.showSymbols() ? [...this.specialKeys] : [...this.lowerCaseKeys];

    // Fisher-Yates Shuffle
    for (let i = source.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [source[i], source[j]] = [source[j], source[i]];
    }

    this.keys.set(source);
    this.updateKeyDisplay();
  }

  private updateKeyDisplay() {
    if (this.showSymbols()) return; // Symbols don't have caps state usually

    const current = this.keys();
    if (this.showCaps()) {
      this.keys.set(current.map((k) => k.toUpperCase()));
    } else {
      this.keys.set(current.map((k) => k.toLowerCase()));
    }
  }

  onKeyClick(key: string) {
    this.keyPress.emit(key);
    // Optional: Reshuffle on every click for maximum paranoia
    this.shuffleKeys();
  }

  onBackspace() {
    this.backspace.emit();
  }
}
