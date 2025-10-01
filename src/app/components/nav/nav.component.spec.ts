import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavComponent } from './nav.component';
import { Theme } from '../../services/theme';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { MaterialModule } from '../../modules/material/material-module';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

describe('NavComponent', () => {
  let component: NavComponent;
  let fixture: ComponentFixture<NavComponent>;
  let mockThemeService: jasmine.SpyObj<Theme>;

  beforeEach(async () => {
    const isDarkThemeSignal = signal(false);
    const logoSrcSignal = signal('public/img/logo-black.png');

    mockThemeService = jasmine.createSpyObj('Theme', ['setDarkTheme'], {
      'isDarkTheme': isDarkThemeSignal,
      'logoSrc': logoSrcSignal
    });

    await TestBed.configureTestingModule({
      imports: [NavComponent, MaterialModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: Theme, useValue: mockThemeService }],
    }).compileComponents();

    fixture = TestBed.createComponent(NavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should inject the Theme service', () => {
    expect(component.theme).toBeTruthy();
    expect(component.theme).toBe(mockThemeService);
  });

  it('should call theme.setDarkTheme when toggleTheme is called', () => {
    component.toggleTheme();
    expect(mockThemeService.setDarkTheme).toHaveBeenCalledWith(true);
  });

  it('should render the logo', () => {
    const logoElement = fixture.debugElement.query(By.css('.navbar-logo'));
    expect(logoElement).toBeTruthy();
    expect(logoElement.nativeElement.src).toContain('public/img/logo-black.png');
  });
});

