import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavComponent } from './nav.component';
import { Theme } from '../../services/theme';
import { MaterialModule } from '../../modules/material/material-module';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

describe('NavComponent', () => {
  let component: NavComponent;
  let fixture: ComponentFixture<NavComponent>;
  let themeService: Theme;
  let compiled: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavComponent, MaterialModule, NoopAnimationsModule, RouterTestingModule],
      providers: [Theme],
    }).compileComponents();

    fixture = TestBed.createComponent(NavComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(Theme);
    fixture.detectChanges();
    compiled = fixture.nativeElement;
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle theme from light to dark', () => {
    const themeButton = compiled.querySelector('.mat-toolbar button:last-child');
    const icon = themeButton?.querySelector('mat-icon');

    // Initially, should be light theme
    expect(themeService.isDarkTheme()).toBeFalse();
    expect(icon?.textContent).toContain('dark_mode');

    // Click to toggle to dark theme
    (themeButton as HTMLElement).click();
    fixture.detectChanges();

    expect(themeService.isDarkTheme()).toBeTrue();
    expect(icon?.textContent).toContain('light_mode');
  });

  it('should toggle theme from dark to light', () => {
    // Set initial theme to dark
    themeService.setDarkTheme(true);
    fixture.detectChanges();

    const themeButton = compiled.querySelector('.mat-toolbar button:last-child');
    const icon = themeButton?.querySelector('mat-icon');

    // Initially, should be dark theme
    expect(themeService.isDarkTheme()).toBeTrue();
    expect(icon?.textContent).toContain('light_mode');

    // Click to toggle to light theme
    (themeButton as HTMLElement).click();
    fixture.detectChanges();

    expect(themeService.isDarkTheme()).toBeFalse();
    expect(icon?.textContent).toContain('dark_mode');
  });
});

