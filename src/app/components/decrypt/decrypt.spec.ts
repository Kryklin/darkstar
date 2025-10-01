import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Decrypt } from './decrypt';

describe('Decrypt', () => {
  let component: Decrypt;
  let fixture: ComponentFixture<Decrypt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Decrypt]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Decrypt);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
