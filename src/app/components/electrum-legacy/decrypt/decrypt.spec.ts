import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElectrumLegacyDecrypt } from './decrypt';
import { MaterialModule } from '../../../modules/material/material';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CryptService } from '../../../services/crypt';

describe('ElectrumLegacyDecrypt', () => {
  let component: ElectrumLegacyDecrypt;
  let fixture: ComponentFixture<ElectrumLegacyDecrypt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ElectrumLegacyDecrypt, MaterialModule, NoopAnimationsModule],
      providers: [CryptService],
    }).compileComponents();

    fixture = TestBed.createComponent(ElectrumLegacyDecrypt);
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
