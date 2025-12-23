import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateChecker } from './update-checker';

describe('UpdateChecker', () => {
  let component: UpdateChecker;
  let fixture: ComponentFixture<UpdateChecker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateChecker],
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateChecker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
