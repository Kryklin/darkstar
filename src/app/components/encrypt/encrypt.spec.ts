import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Encrypt } from './encrypt';

describe('Encrypt', () => {
  let component: Encrypt;
  let fixture: ComponentFixture<Encrypt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Encrypt]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Encrypt);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
