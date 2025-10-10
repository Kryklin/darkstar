import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Home } from './home';
import { MaterialModule } from '../../modules/material/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Theme } from '../../services/theme';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home, MaterialModule, NoopAnimationsModule],
      providers: [Theme]
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    // Do not run detectChanges here, as ngOnInit will be called
    // and the timer will start before we are in fakeAsync
    compiled = fixture.nativeElement;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should show a spinner while loading', () => {
    fixture.detectChanges(); // ngOnInit is called here
    const spinner = compiled.querySelector('mat-spinner');
    expect(spinner).toBeTruthy();
    const card = compiled.querySelector('mat-card.info-card');
    expect(card).toBeFalsy();
  });

  it('should show the info card after loading', fakeAsync(() => {
    fixture.detectChanges(); // ngOnInit is called here
    let spinner = compiled.querySelector('mat-spinner');
    expect(spinner).toBeTruthy();

    tick(500);
    fixture.detectChanges();

    spinner = compiled.querySelector('mat-spinner');
    expect(spinner).toBeFalsy();

    const card = compiled.querySelector('mat-card.info-card');
    expect(card).toBeTruthy();
  }));

  it('should display the correct title after loading', fakeAsync(() => {
    fixture.detectChanges();
    tick(500);
    fixture.detectChanges();
    const title = compiled.querySelector('mat-card-title');
    expect(title?.textContent).toContain('Darkstar');
  }));

  it('should display the creator name after loading', fakeAsync(() => {
    fixture.detectChanges();
    tick(500);
    fixture.detectChanges();
    const subtitle = compiled.querySelector('mat-card-subtitle');
    expect(subtitle?.textContent).toContain('Created by Victor Kane');
  }));

  it('should display the footer after loading', fakeAsync(() => {
    fixture.detectChanges();
    tick(500);
    fixture.detectChanges();
    const footer = compiled.querySelector('.footer');
    expect(footer).toBeTruthy();
    expect(footer?.textContent).toContain('© 2025 Victor Kane. All Rights Reserved.');
    expect(footer?.textContent).toContain('Version 1.2.0');
  }));
});