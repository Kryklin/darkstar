import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Home } from './home';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Theme } from '../../services/theme';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home, MatCardModule, MatListModule, NoopAnimationsModule],
      providers: [Theme]
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
    compiled = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the info card', () => {
    const card = compiled.querySelector('mat-card.info-card');
    expect(card).toBeTruthy();
  });

  it('should display the correct title', () => {
    const title = compiled.querySelector('mat-card-title');
    expect(title?.textContent).toContain('Darkstar');
  });

  it('should display the creator name', () => {
    const subtitle = compiled.querySelector('mat-card-subtitle');
    expect(subtitle?.textContent).toContain('Created by Victor Kane');
  });

});