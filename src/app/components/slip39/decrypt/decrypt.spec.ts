import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Slip39Decrypt } from './decrypt';
import { MaterialModule } from '../../../modules/material/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CryptService } from '../../../services/crypt';

describe('Slip39Decrypt', () => {
  let component: Slip39Decrypt;
  let fixture: ComponentFixture<Slip39Decrypt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Slip39Decrypt, MaterialModule, NoopAnimationsModule],
      providers: [CryptService],
    }).compileComponents();

    fixture = TestBed.createComponent(Slip39Decrypt);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize forms', () => {
    expect(component.firstFormGroup).toBeDefined();
    expect(component.secondFormGroup).toBeDefined();
    expect(component.thirdFormGroup).toBeDefined();
  });
});
