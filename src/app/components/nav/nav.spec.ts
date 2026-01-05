import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Nav } from './nav';
import { Theme } from '../../services/theme';
import { MaterialModule } from '../../modules/material/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

describe('Nav', () => {
  let component: Nav;
  let fixture: ComponentFixture<Nav>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Nav, MaterialModule, NoopAnimationsModule, RouterTestingModule],
      providers: [Theme],
    }).compileComponents();

    fixture = TestBed.createComponent(Nav);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  // Theme toggle tests removed as the button is no longer in the navbar
  // it('should toggle theme from light to dark', ...);
  // it('should toggle theme from dark to light', ...);
});
