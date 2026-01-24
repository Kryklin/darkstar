import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { UpdateChecker } from './update-checker';
import { UpdateService } from '../../services/update';

describe('UpdateChecker', () => {
  let component: UpdateChecker;
  let fixture: ComponentFixture<UpdateChecker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateChecker],
      providers: [provideRouter([]), UpdateService, provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateChecker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
