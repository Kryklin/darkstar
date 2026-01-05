import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElectrumV2Decrypt } from './decrypt';
import { MaterialModule } from '../../../modules/material/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CryptService } from '../../../services/crypt';

describe('ElectrumV2Decrypt', () => {
  let component: ElectrumV2Decrypt;
  let fixture: ComponentFixture<ElectrumV2Decrypt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElectrumV2Decrypt, MaterialModule, NoopAnimationsModule],
      providers: [CryptService],
    }).compileComponents();

    fixture = TestBed.createComponent(ElectrumV2Decrypt);
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
